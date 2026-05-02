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
const rawPathPrefix = "/Users/example";
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
    cwd: `${rawPathPrefix}/private-project`,
    permission_mode: "default",
    hook_event_name: "UserPromptSubmit",
    prompt: `Fix ${rawPathPrefix}/private-project/src/secret.ts with token ${rawSecret}. Run pnpm test.`,
  });
  await ingest(serverBaseUrl, "/api/v1/ingest/codex", {
    session_id: "browser-e2e-codex",
    turn_id: "turn-1",
    transcript_path: `${rawPathPrefix}/.codex/sessions/session.jsonl`,
    cwd: `${rawPathPrefix}/private-project`,
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
  await assertText(
    page,
    "Average prompt score",
    "Dashboard should show average prompt score.",
  );
  await assertText(
    page,
    "Prompt habit command center",
    "Dashboard should show prompt habit command center.",
  );
  await assertText(
    page,
    "Fix these next",
    "Dashboard should show next habit fixes.",
  );
  await assertText(
    page,
    "Bad prompt review queue",
    "Dashboard should show low score review queue.",
  );
  await assertText(
    page,
    "Archive score review",
    "Dashboard should show archive score review.",
  );
  await page.getByRole("button", { name: "Evaluate archive" }).click();
  await assertText(
    page,
    "Lowest scoring prompts",
    "Dashboard should show lowest scoring prompts.",
  );
  await assertBrowserSafe(page, "dashboard");

  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("heading", { name: "Projects" }).waitFor();
  await assertBrowserSafe(page, "projects");
  await page.getByRole("button", { name: "capture on" }).click();
  await page.getByRole("button", { name: "paused" }).waitFor();

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
