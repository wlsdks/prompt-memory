#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cliPath = join(repoRoot, "dist", "cli", "index.js");
const tempRoot = mkdtempSync(join(tmpdir(), "prompt-memory-browser-e2e-"));
const dataDir = join(tempRoot, "data");
const homeDir = join(tempRoot, "home");
const rawPathPrefix = join(tempRoot, "workspace");
const privateProjectDir = join(rawPathPrefix, "private-project");
const rawSecret = "sk-proj-1234567890abcdef";
const cliEnv = {
  ...process.env,
  HOME: homeDir,
  USERPROFILE: homeDir,
};

let serverProcess;
let browser;

try {
  assert(existsSync(cliPath), "Run `pnpm build` before browser E2E.");
  mkdirSync(homeDir, { recursive: true });
  mkdirSync(privateProjectDir, { recursive: true });
  writeFileSync(
    join(privateProjectDir, "AGENTS.md"),
    [
      "# prompt-memory",
      "prompt-memory is a local-first developer tool built with TypeScript and SQLite.",
      "Agents plan in tasks/todo.md, avoid reverting user changes, commit, and push.",
      "Run pnpm test, pnpm lint, pnpm build, and Playwright E2E after UI changes.",
      "Never expose secrets, prompt bodies, raw paths, tokens, stdout, or stderr leaks.",
      "Respond with concise verification evidence.",
    ].join("\n"),
  );
  const serverPort = await freePort();
  const serverBaseUrl = `http://127.0.0.1:${serverPort}`;

  step("Initialize isolated data directory");
  runCli(["init", "--data-dir", dataDir]);
  configurePort(serverPort);

  step("Start local server");
  serverProcess = startServer();
  await waitForHealth(`${serverBaseUrl}/api/v1/health`);

  step("Capture prompt fixtures");
  await ingest(serverBaseUrl, "/api/v1/ingest/claude-code", {
    session_id: "browser-e2e-claude",
    transcript_path: `${rawPathPrefix}/.claude/session.jsonl`,
    cwd: privateProjectDir,
    permission_mode: "default",
    hook_event_name: "UserPromptSubmit",
    prompt: `Fix ${rawPathPrefix}/private-project/src/secret.ts with token ${rawSecret}. Run pnpm test.`,
  });
  await ingest(serverBaseUrl, "/api/v1/ingest/codex", {
    session_id: "browser-e2e-codex",
    turn_id: "turn-1",
    transcript_path: `${rawPathPrefix}/.codex/sessions/session.jsonl`,
    cwd: privateProjectDir,
    hook_event_name: "UserPromptSubmit",
    model: "gpt-5.5",
    prompt: `Review ${rawPathPrefix}/private-project/src/web/App.tsx and return Markdown summary.`,
  });

  step("Run browser flow");
  browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context
    .grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: serverBaseUrl,
    })
    .catch(() => undefined);
  const page = await context.newPage();
  const consoleErrors = [];
  const requestErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      requestErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(serverBaseUrl);
  await page.getByRole("heading", { name: "Prompt archive" }).waitFor();
  await page.getByRole("button", { name: "KO" }).click();
  await page.getByRole("heading", { name: "프롬프트 아카이브" }).waitFor();
  await page.getByRole("button", { name: "EN" }).click();
  await page.getByRole("heading", { name: "Prompt archive" }).waitFor();
  await page.getByText("private-project").first().waitFor();
  await assertBrowserSafe(page, "archive");
  await assertText(
    page,
    "private-project",
    "Archive should show project label.",
  );
  await assertText(
    page,
    "[REDACTED:path]",
    "Archive should mask prompt paths.",
  );

  await page.getByRole("row", { name: /claude-code private-project/ }).click();
  await page
    .getByRole("heading", { name: "Improvement draft for manual resubmission" })
    .waitFor();
  await assertText(page, "Prompt score", "Detail should show prompt score.");
  await assertBrowserSafe(page, "detail");
  await page.getByRole("button", { name: "Copy draft" }).click();
  await page.getByRole("button", { name: "Copied" }).waitFor();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Saved" }).waitFor();

  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("heading", { name: "Quality dashboard" }).waitFor();
  await page.getByText("Average prompt score").waitFor();
  await assertText(
    page,
    "Average prompt score",
    "Dashboard should show average prompt score.",
  );
  await assertText(
    page,
    "Improve the next prompt",
    "Dashboard should route users to prompt coaching.",
  );
  await assertText(
    page,
    "Draft with live score",
    "Dashboard should route users to prompt practice.",
  );
  await assertText(
    page,
    "Review archive quality",
    "Dashboard should route users to score review.",
  );
  await assertText(
    page,
    "Find reuse and project patterns",
    "Dashboard should route users to insights.",
  );
  await assertChartVisible(page, "dashboard", 1);
  await assertBrowserSafe(page, "dashboard");

  await page.getByRole("button", { name: "Coach", exact: true }).click();
  await page.getByRole("heading", { name: "Prompt coach" }).waitFor();
  await page.getByText("Prompt habit command center").waitFor();
  await assertText(
    page,
    "Prompt habit command center",
    "Coach should show prompt habit command center.",
  );
  await assertText(
    page,
    "Fix these next",
    "Coach should show next habit fixes.",
  );
  await assertText(
    page,
    "Bad prompt review queue",
    "Coach should show low score review queue.",
  );
  await assertTextAny(
    page,
    ["Next request brief", "다음 요청 브리프"],
    "Coach should expose a copyable next request brief.",
  );
  await assertTextAny(
    page,
    [
      "Preview and copy an approval-ready coaching prompt",
      "승인 가능한 코칭 프롬프트 미리보기와 복사",
    ],
    "Coach should show the brief preview before copying.",
  );
  await assertTextAny(
    page,
    ["First fix", "첫 보완"],
    "Coach should show the first habit fix in the brief preview.",
  );
  await assertTextAny(
    page,
    ["Review target", "리뷰 대상"],
    "Coach should show the review target in the brief preview.",
  );
  await page.getByRole("button", { name: /Copy brief|브리프 복사/ }).click();
  await assertTextAny(
    page,
    ["Copied brief", "브리프 복사됨"],
    "Coach should confirm that the next request brief was copied.",
  );
  await assertBrowserSafe(page, "coach");

  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("heading", { name: "Prompt practice" }).waitFor();
  await assertTextAny(
    page,
    ["Prompt practice workspace", "프롬프트 연습 작업면"],
    "Practice should expose a prompt drafting workspace.",
  );
  await assertTextAny(
    page,
    ["Live local score", "실시간 로컬 점수"],
    "Practice should show local prompt score preview.",
  );
  await assertTextAny(
    page,
    ["Practice history", "연습 기록"],
    "Practice should show local score history.",
  );
  await page.getByLabel("Practice draft").fill("fix it");
  await assertTextAny(
    page,
    ["One-click builder", "원클릭 빌더"],
    "Practice should expose one-click missing section fixes.",
  );
  await assertTextAny(
    page,
    ["Add all missing sections", "부족한 섹션 모두 추가"],
    "Practice should offer an all-fixes builder action.",
  );
  await page
    .getByRole("button", { name: /Add Verification|검증 추가/ })
    .click();
  assertIncludes(
    await page.getByLabel("Practice draft").inputValue(),
    "Verification: name commands or acceptance checks.",
    "Practice should append selected quick-fix snippets to the draft.",
  );
  await page
    .getByLabel("Practice draft")
    .fill(
      [
        "Goal: improve the archive practice plan UI.",
        "Context: use src/web/src/App.tsx and src/web/src/styles.css.",
        "Scope: keep changes limited to the Practice screen.",
        "Verification: run pnpm test and pnpm e2e:browser.",
        "Output: concise Markdown summary with risks.",
      ].join("\n"),
    );
  await assertTextAny(
    page,
    ["Excellent", "우수"],
    "Practice should update the score preview while drafting.",
  );
  await page
    .getByRole("button", { name: /Copy practice draft|연습 초안 복사/ })
    .waitFor();
  await page
    .getByRole("button", { name: /Copy practice draft|연습 초안 복사/ })
    .click();
  await assertTextAny(
    page,
    ["1 copied drafts", "1 copied draft", "복사한 초안"],
    "Practice should record copied draft score metadata.",
  );
  await page.waitForTimeout(2600);
  await page
    .getByRole("button", { name: /Copy practice draft|연습 초안 복사/ })
    .click();
  await assertTextAny(
    page,
    ["2 copied drafts", "복사한 초안"],
    "Practice should keep multiple copied draft score points.",
  );
  await assertChartVisible(page, "practice", 1);
  await assertTextAny(
    page,
    [
      "Practice history stores scores and missing labels only",
      "점수와 부족 항목 라벨만 저장",
    ],
    "Practice history should explain that draft text is not stored.",
  );
  await assertTextAny(
    page,
    ["Did the copied draft work?", "복사한 초안이 실제로 도움이 됐나요?"],
    "Practice should ask for outcome feedback after copied drafts.",
  );
  await page.getByRole("button", { name: /Worked|성공/ }).click();
  await assertTextAny(
    page,
    ["Latest outcome:", "최근 결과:"],
    "Practice should show the latest copied draft outcome.",
  );
  await assertTextAny(
    page,
    ["Worked", "성공"],
    "Practice should record worked outcomes.",
  );
  await assertBrowserSafe(page, "practice");

  await page.getByRole("button", { name: "Scores", exact: true }).click();
  await page.getByRole("heading", { name: "Prompt scores" }).waitFor();
  await page.getByText("Archive score review").waitFor();
  await assertText(
    page,
    "Archive score review",
    "Scores should show archive score review.",
  );
  await page.getByRole("button", { name: "Evaluate archive" }).click();
  await assertText(
    page,
    "Prompts to review",
    "Scores should show prompts that need review.",
  );
  await assertText(
    page,
    "Practice plan",
    "Scores should show actionable practice plan.",
  );
  await page.getByRole("button", { name: "Copy practice template" }).waitFor();
  await assertChartVisible(page, "scores", 3);
  await assertBrowserSafe(page, "scores");

  await page.getByRole("button", { name: "Benchmark", exact: true }).click();
  await page.getByRole("heading", { name: "Prompt benchmark" }).waitFor();
  await page.getByText("Measure your prompt habits").waitFor();
  await assertText(
    page,
    "Measure now",
    "Benchmark should expose a live measurement action.",
  );
  await assertText(
    page,
    "Auto-updates every 12s while open",
    "Benchmark should explain live measurement refresh.",
  );
  await page.getByRole("button", { name: "Measure now" }).click();
  await page.getByText(/^Measured /).waitFor();
  await assertText(
    page,
    "What this measures",
    "Benchmark should explain the live archive measurement.",
  );
  await assertBrowserSafe(page, "benchmark");

  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page.getByRole("heading", { name: "Prompt insights" }).waitFor();
  await page.getByText("Project quality profile").waitFor();
  await assertText(
    page,
    "Project quality profile",
    "Insights should show project quality profiles.",
  );
  await assertText(
    page,
    "Reuse candidates",
    "Insights should show reuse candidates.",
  );
  await assertChartVisible(page, "insights", 2);
  await assertBrowserSafe(page, "insights");

  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("heading", { name: "Projects" }).waitFor();
  await page.getByText("Agent rules").waitFor();
  await page.getByRole("button", { name: "Analyze rules" }).click();
  await page.getByText("rules file").waitFor();
  await assertBrowserSafe(page, "projects");
  await page.getByRole("button", { name: "capture on" }).click();
  await page.getByRole("button", { name: "paused" }).waitFor();

  await page.getByRole("button", { name: "MCP", exact: true }).click();
  await page.getByRole("heading", { name: "MCP tools" }).waitFor();
  await assertText(
    page,
    "MCP readiness",
    "MCP page should show live readiness before the tool catalog.",
  );
  await assertTextAny(
    page,
    ["Stored prompts", "저장된 프롬프트"],
    "MCP page should expose archive readiness metrics.",
  );
  await assertTextAny(
    page,
    ["First MCP call", "첫 MCP 호출"],
    "MCP page should recommend the next agent tool call.",
  );
  await assertText(
    page,
    "Recommended call order",
    "MCP page should show recommended tool call order.",
  );
  await assertText(
    page,
    "improve_prompt",
    "MCP page should expose approval-ready prompt rewriting.",
  );
  await assertText(
    page,
    "get_prompt_memory_status",
    "MCP page should expose the preflight status tool.",
  );
  await assertTextAny(
    page,
    ["structured JSON", "구조화 JSON"],
    "MCP page should explain the structured tool result contract.",
  );
  await assertTextAny(
    page,
    ["output schema", "출력 스키마"],
    "MCP page should explain the MCP output schema contract.",
  );
  await assertTextAny(
    page,
    ["read-only", "읽기 전용"],
    "MCP page should expose read-only tool behavior.",
  );
  await assertText(
    page,
    "review_project_instructions",
    "MCP page should expose project instruction review.",
  );
  await assertBrowserSafe(page, "mcp");

  await page.getByRole("button", { name: "Export" }).click();
  await page
    .getByRole("heading", { name: "Anonymized export", level: 1 })
    .waitFor();
  await page.getByRole("button", { name: "Create preview" }).click();
  await page.getByRole("heading", { name: "Preview job" }).waitFor();
  await assertBrowserSafe(page, "export preview");
  await page.getByRole("button", { name: "Run export" }).click();
  await page.getByRole("heading", { name: "Export JSON" }).waitFor();
  await assertBrowserSafe(page, "export result");
  await assertText(
    page,
    "[REDACTED:path]",
    "Export JSON preview should include anonymized paths.",
  );

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("heading", { name: "Settings" }).waitFor();
  await page.getByText("[local path]").first().waitFor();
  await assertBrowserSafe(page, "settings");
  await assertText(
    page,
    "[local path]",
    "Settings should show masked local paths.",
  );
  await assertNotText(page, tempRoot, "Settings must not show raw temp paths.");

  await page.setViewportSize({ width: 390, height: 844 });
  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert(
    viewport.scrollWidth <= viewport.innerWidth,
    `Mobile layout should not overflow horizontally. scrollWidth=${viewport.scrollWidth}, innerWidth=${viewport.innerWidth}.`,
  );

  assertEqual(
    consoleErrors.length,
    0,
    `Browser console errors: ${consoleErrors.join("\n")}`,
  );
  assertEqual(
    requestErrors.length,
    0,
    `Browser request errors: ${requestErrors.join("\n")}`,
  );

  console.log("browser e2e passed");
} finally {
  if (browser) {
    await browser.close();
  }
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await waitForExit(serverProcess);
  }
  rmSync(tempRoot, { recursive: true, force: true });
}

function step(message) {
  console.log(`- ${message}`);
}

function runCli(args) {
  const result = spawnSync("node", [cliPath, ...args], {
    env: cliEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `CLI failed: prompt-memory ${args.join(" ")}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function configurePort(port) {
  const configPath = join(dataDir, "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.server.port = port;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

function startServer() {
  const child = spawn("node", [cliPath, "server", "--data-dir", dataDir], {
    env: cliEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.on("data", (chunk) => {
    const text = Buffer.from(chunk).toString("utf8").trim();
    if (text) {
      console.error(text);
    }
  });
  return child;
}

async function ingest(serverBaseUrl, path, payload) {
  const hookAuth = JSON.parse(
    readFileSync(join(dataDir, "hook-auth.json"), "utf8"),
  );
  const response = await fetch(`${serverBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${hookAuth.ingest_token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || !body.data?.stored) {
    throw new Error(`Ingest failed for ${path}: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      headless: process.env.PWDEBUG !== "1",
    });
  } catch (error) {
    throw new Error(
      `Unable to launch Playwright Chromium. Run \`pnpm exec playwright install chromium\` and retry.\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function assertBrowserSafe(page, label) {
  const text = await page.locator("body").innerText();
  assertNotIncludes(text, rawPathPrefix, `${label} must not show raw paths.`);
  assertNotIncludes(text, rawSecret, `${label} must not show raw secrets.`);
}

async function assertText(page, expected, message) {
  const text = await page.locator("body").innerText();
  assertIncludes(text, expected, message);
}

async function assertTextAny(page, expectedOptions, message) {
  const text = await page.locator("body").innerText();
  const normalized = text.toLowerCase();
  if (
    expectedOptions.some((expected) =>
      normalized.includes(expected.toLowerCase()),
    )
  ) {
    return;
  }
  throw new Error(`${message} Missing one of ${expectedOptions.join(", ")}.`);
}

async function assertChartVisible(page, label, minCount) {
  await page.locator(".recharts-surface").first().waitFor();
  const count = await page.locator(".recharts-surface").count();
  assert(
    count >= minCount,
    `${label} should render at least ${minCount} Recharts SVG chart(s). Found ${count}.`,
  );
}

async function assertNotText(page, unexpected, message) {
  const text = await page.locator("body").innerText();
  assertNotIncludes(text, unexpected, message);
}

async function waitForHealth(url) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the server starts listening.
    }
    await delay(100);
  }
  throw new Error("Server did not become healthy within 10 seconds.");
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
    server.on("error", reject);
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}.`);
  }
}

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(`${message} Missing ${expected}.`);
  }
}

function assertNotIncludes(value, unexpected, message) {
  if (value.includes(unexpected)) {
    throw new Error(`${message} Found ${unexpected}.`);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function waitForExit(child) {
  return new Promise((resolveExit) => {
    if (child.exitCode !== null) {
      resolveExit();
      return;
    }
    child.once("exit", () => resolveExit());
  });
}
