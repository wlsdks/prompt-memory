#!/usr/bin/env node
import Database from "better-sqlite3";
import { performance } from "node:perf_hooks";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  analyzePrompt,
  EXPERIMENTAL_RULE_IDS,
} from "../dist/analysis/analyze.js";
import { improvePrompt } from "../dist/analysis/improve.js";
import { coachPromptTool } from "../dist/mcp/score-tool.js";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cliPath = join(repoRoot, "dist", "cli", "index.js");
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
);
const tempRoot = mkdtempSync(join(tmpdir(), "prompt-coach-benchmark-"));
const dataDir = join(tempRoot, "data");
const homeDir = join(tempRoot, "home");
const rawPathPrefix = "/Users/example";
const rawSecret = "sk-proj-benchmark1234567890abcdef";
const fixtureSet = parseFixtureSet(process.argv);
const dataset = fixtureSet === "real" ? "benchmark-v1-real" : "benchmark-v1";
const jsonOutput = process.argv.includes("--json");
const cliEnv = {
  ...process.env,
  HOME: homeDir,
  USERPROFILE: homeDir,
};
const thresholds = {
  privacy_leak_count: 0,
  retrieval_top3: 0.8,
  coach_gap_fix_rate: 0.8,
  coach_prompt_actionability: 0.8,
  prompt_quality_score_calibration: 0.8,
  analytics_score: 0.75,
  ingest_p95_ms: 500,
  search_p95_ms: 250,
  dashboard_ms: 500,
  export_ms: 1000,
};

const fixtures = [
  {
    label: "secret_bugfix",
    adapter: "claude-code",
    query: "token pnpm test",
    prompt: `Fix ${rawPathPrefix}/benchmark-project/src/secret.ts with token ${rawSecret}. Run pnpm test.`,
  },
  {
    label: "export_ui",
    adapter: "codex",
    query: "export layout markdown",
    prompt: `Review ${rawPathPrefix}/benchmark-project/src/web/App.tsx export layout and return Markdown summary.`,
  },
  {
    label: "database_migration",
    adapter: "claude-code",
    query: "sqlite migration",
    prompt:
      "Add SQLite migration for prompt_improvement_drafts. Include rollback notes and verification criteria: pnpm test.",
  },
  {
    label: "vague_prompt",
    adapter: "codex",
    query: "make better",
    prompt: "Make this better",
  },
  {
    label: "release_docs",
    adapter: "claude-code",
    query: "release checklist docs",
    prompt:
      "Update release checklist docs for benchmark workflow. Output a concise Markdown summary.",
  },
];
const coachCases = [
  "Make this better",
  `Fix ${rawPathPrefix}/benchmark-project/src/secret.ts with token ${rawSecret}.`,
  "Review export UI.",
  "Check the DB part",
  "Fix the tests",
];

if (fixtureSet === "real") {
  const realFixturesPath = join(repoRoot, "docs/benchmark-fixtures/real.json");
  if (!existsSync(realFixturesPath)) {
    const message = {
      dataset,
      fixture_set: fixtureSet,
      status: "no_fixtures",
      detail:
        "No real fixtures registered yet. Add docs/benchmark-fixtures/real.json (consent-bearing redacted prompts) and re-run.",
    };
    if (jsonOutput) {
      console.log(JSON.stringify(message, null, 2));
    } else {
      console.log(`prompt-coach benchmark ${dataset}`);
      console.log("status: no_fixtures");
      console.log(message.detail);
    }
    rmSync(tempRoot, { recursive: true, force: true });
    process.exit(0);
  }
}

let serverProcess;

try {
  assert(existsSync(cliPath), "Run `pnpm build` before benchmark.");
  mkdirSync(homeDir, { recursive: true });
  const serverPort = await freePort();
  const serverBaseUrl = `http://127.0.0.1:${serverPort}`;

  runCli(["init", "--data-dir", dataDir]);
  configurePort(serverPort);
  serverProcess = startServer();
  await waitForHealth(`${serverBaseUrl}/api/v1/health`);

  const auth = readJson(join(dataDir, "hook-auth.json"));
  const fixtureIds = new Map();
  const ingestDurations = [];

  for (const fixture of fixtures) {
    const duration = await timed(async () => {
      const id = await ingest(serverBaseUrl, auth.ingest_token, fixture);
      fixtureIds.set(fixture.label, id);
    });
    ingestDurations.push(duration);
  }

  const list = await apiGet(serverBaseUrl, auth.app_token, "/api/v1/prompts");
  const details = [];
  for (const item of list.data.items) {
    details.push(
      await apiGet(serverBaseUrl, auth.app_token, `/api/v1/prompts/${item.id}`),
    );
  }

  const searchDurations = [];
  const retrievalCases = [];
  let retrievalHits = 0;
  for (const fixture of fixtures) {
    const expectedId = fixtureIds.get(fixture.label);
    let searchResult;
    const duration = await timed(async () => {
      searchResult = await apiGet(
        serverBaseUrl,
        auth.app_token,
        `/api/v1/prompts?q=${encodeURIComponent(fixture.query)}`,
      );
    });
    searchDurations.push(duration);
    const top3 = searchResult.data.items.slice(0, 3).map((item) => item.id);
    const rank =
      searchResult.data.items.findIndex((item) => item.id === expectedId) + 1;
    const hit = top3.includes(expectedId);
    retrievalCases.push({
      label: fixture.label,
      query: fixture.query,
      hit,
      rank: rank > 0 ? rank : null,
    });
    if (hit) {
      retrievalHits += 1;
    }
  }

  let dashboard;
  const dashboardMs = await timed(async () => {
    dashboard = await apiGet(serverBaseUrl, auth.app_token, "/api/v1/quality");
  });

  const {
    preview,
    exported,
    duration: exportMs,
  } = await runExportFlow(serverBaseUrl);

  const coachScore = scorePromptCoach();
  const coachPromptActionability = scoreCoachPromptActionability();
  const scoreCalibration = scorePromptQualityCalibration({ list, details });
  const analyticsScore = scoreAnalytics(dashboard.data);
  const privacyLeakCount = countPrivacyLeaks({
    list,
    details,
    dashboard,
    preview,
    exported,
  });

  const scores = {
    privacy_leak_count: privacyLeakCount,
    retrieval_top3: roundScore(retrievalHits / fixtures.length),
    coach_gap_fix_rate: coachScore,
    coach_prompt_actionability: coachPromptActionability,
    prompt_quality_score_calibration: scoreCalibration,
    analytics_score: analyticsScore,
    ingest_p95_ms: Math.round(p95(ingestDurations)),
    search_p95_ms: Math.round(p95(searchDurations)),
    dashboard_ms: Math.round(dashboardMs),
    export_ms: Math.round(exportMs),
  };
  const experimentalComparison = scoreExperimentalRulesAB();

  const report = {
    version: packageJson.version,
    dataset,
    fixture_set: fixtureSet,
    soft_signal: fixtureSet === "real",
    generated_at: new Date().toISOString(),
    pass: passes(scores),
    scores,
    thresholds,
    counts: {
      prompts: fixtures.length,
      retrieval_cases: fixtures.length,
      coach_cases: coachCases.length,
    },
    details: {
      retrieval_cases: retrievalCases,
      experimental_rules_ab: experimentalComparison,
    },
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (!report.pass) {
    if (fixtureSet === "real") {
      console.warn(
        "warning: real fixture set failed thresholds — exiting 0 (soft signal). Synthetic remains the hard gate.",
      );
    } else {
      process.exitCode = 1;
    }
  }
} finally {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await waitForExit(serverProcess);
  }
  rmSync(tempRoot, { recursive: true, force: true });
}

function scoreExperimentalRulesAB() {
  const cases = [
    ...fixtures.map((fixture) => ({
      label: fixture.label,
      prompt: fixture.prompt,
    })),
    ...coachCases.map((prompt, index) => ({
      label: `coach_case_${index + 1}`,
      prompt,
    })),
  ];
  const now = new Date().toISOString();
  const ruleResults = {};
  for (const rule of EXPERIMENTAL_RULE_IDS) {
    let liftCount = 0;
    let totalDelta = 0;
    let unchangedCount = 0;
    const liftedLabels = [];
    for (const fixture of cases) {
      const baseline = analyzePrompt({
        prompt: fixture.prompt,
        createdAt: now,
      }).quality_score.value;
      const experimental = analyzePrompt({
        prompt: fixture.prompt,
        createdAt: now,
        experimentalRules: [rule],
      }).quality_score.value;
      const delta = experimental - baseline;
      if (delta > 0) {
        liftCount += 1;
        liftedLabels.push(`${fixture.label}+${delta}`);
      } else if (delta === 0) {
        unchangedCount += 1;
      }
      totalDelta += delta;
    }
    ruleResults[rule] = {
      cases: cases.length,
      lifted: liftCount,
      unchanged: unchangedCount,
      regressed: cases.length - liftCount - unchangedCount,
      total_delta: totalDelta,
      average_delta: roundScore(totalDelta / cases.length),
      examples: liftedLabels.slice(0, 5),
    };
  }
  return ruleResults;
}

function scorePromptCoach() {
  let passed = 0;
  for (const prompt of coachCases) {
    const result = improvePrompt({
      prompt,
      createdAt: new Date().toISOString(),
    });
    const text = result.improved_prompt;
    const hasSections = [
      "## Goal",
      "## Context",
      "## Scope",
      "## Verification",
      "## Output",
    ].every((section) => text.includes(section));
    const safe = !text.includes(rawSecret);
    if (hasSections && safe) {
      passed += 1;
    }
  }
  return roundScore(passed / coachCases.length);
}

function scoreCoachPromptActionability() {
  const result = coachPromptTool(
    { max_prompts: 100, low_score_limit: 3 },
    { dataDir },
  );
  const serialized = JSON.stringify(result);
  const checks = [
    result.mode === "agent_coach",
    result.status.status === "ready",
    result.agent_brief.headline.includes("Latest prompt score"),
    typeof result.agent_brief.first_fix?.instruction === "string" &&
      result.agent_brief.first_fix.instruction.length > 20,
    typeof result.agent_brief.review_target?.prompt_id === "string" &&
      result.agent_brief.review_target.prompt_id.length > 0,
    typeof result.agent_brief.next_request_template === "string" &&
      result.agent_brief.next_request_template.includes("Goal:") &&
      result.agent_brief.next_request_template.includes("Verification:"),
    result.agent_brief.next_actions.length >= 3,
    !serialized.includes(rawSecret) && !serialized.includes(rawPathPrefix),
  ];

  return roundScore(checks.filter(Boolean).length / checks.length);
}

function scoreAnalytics(dashboard) {
  const checks = [
    dashboard.total_prompts === fixtures.length,
    dashboard.sensitive_prompts >= 1,
    dashboard.distribution.by_tool.length >= 2,
    dashboard.distribution.by_project.some(
      (bucket) => bucket.label === "benchmark-project",
    ),
    dashboard.missing_items.length > 0,
    dashboard.instruction_suggestions.length > 0,
  ];
  return roundScore(checks.filter(Boolean).length / checks.length);
}

function scorePromptQualityCalibration({ list, details }) {
  const listItems = list.data.items;
  const detailItems = details.map((detail) => detail.data);
  const scores = detailItems
    .map((detail) => detail.analysis?.quality_score?.value)
    .filter((value) => typeof value === "number");
  const vagueId = listItems.find((item) =>
    item.snippet.includes("Make this better"),
  )?.id;
  const vagueScore = detailItems.find((item) => item.id === vagueId)?.analysis
    ?.quality_score?.value;
  const listScoresMatchDetails = listItems.every((item) => {
    const detail = detailItems.find((candidate) => candidate.id === item.id);
    return (
      detail &&
      item.quality_score === detail.analysis?.quality_score?.value &&
      item.quality_score_band === detail.analysis?.quality_score?.band
    );
  });
  const checks = [
    scores.length === fixtures.length,
    scores.every((score) => score >= 0 && score <= 100),
    listScoresMatchDetails,
    typeof vagueScore === "number" && vagueScore <= 20,
    Math.max(...scores) - Math.min(...scores) >= 50,
  ];

  return roundScore(checks.filter(Boolean).length / checks.length);
}

function countPrivacyLeaks(surfaces) {
  let leakCount = 0;
  const browserAndExport = JSON.stringify(surfaces);
  for (const forbidden of [rawPathPrefix, rawSecret]) {
    if (browserAndExport.includes(forbidden)) {
      leakCount += 1;
    }
  }

  const db = new Database(join(dataDir, "prompt-coach.sqlite"));
  try {
    for (const table of ["prompts", "prompt_analyses", "redaction_events"]) {
      const rows = JSON.stringify(db.prepare(`SELECT * FROM ${table}`).all());
      if (rows.includes(rawSecret)) {
        leakCount += 1;
      }
    }
  } finally {
    db.close();
  }

  return leakCount;
}

async function runExportFlow(serverBaseUrl) {
  const session = await fetch(`${serverBaseUrl}/api/v1/session`);
  const cookie = session.headers.get("set-cookie");
  const csrfToken = (await session.json()).data.csrf_token;
  let preview;
  let exported;
  const duration = await timed(async () => {
    preview = await apiPost(
      serverBaseUrl,
      "/api/v1/exports/preview",
      { preset: "anonymized_review" },
      cookie,
      csrfToken,
    );
    exported = await apiPost(
      serverBaseUrl,
      "/api/v1/exports",
      { job_id: preview.data.id },
      cookie,
      csrfToken,
    );
  });
  return { preview, exported, duration };
}

async function ingest(serverBaseUrl, ingestToken, fixture) {
  const payload = {
    session_id: `benchmark-${fixture.label}`,
    transcript_path:
      fixture.adapter === "claude-code"
        ? `${rawPathPrefix}/.claude/session.jsonl`
        : `${rawPathPrefix}/.codex/sessions/session.jsonl`,
    cwd: `${rawPathPrefix}/benchmark-project`,
    hook_event_name: "UserPromptSubmit",
    prompt: fixture.prompt,
  };
  if (fixture.adapter === "claude-code") {
    payload.permission_mode = "default";
  } else {
    payload.turn_id = `turn-${fixture.label}`;
    payload.model = "gpt-5.5";
  }

  const response = await fetch(
    `${serverBaseUrl}/api/v1/ingest/${fixture.adapter}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ingestToken}`,
      },
      body: JSON.stringify(payload),
    },
  );
  const body = await response.json();
  if (!response.ok || !body.data?.stored) {
    throw new Error(`Ingest failed: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

async function apiGet(serverBaseUrl, appToken, path) {
  const response = await fetch(`${serverBaseUrl}${path}`, {
    headers: {
      authorization: `Bearer ${appToken}`,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${JSON.stringify(body)}`);
  }
  return body;
}

async function apiPost(serverBaseUrl, path, payload, cookie, csrfToken) {
  const response = await fetch(`${serverBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${JSON.stringify(body)}`);
  }
  return body;
}

function runCli(args) {
  const result = spawnSync("node", [cliPath, ...args], {
    env: cliEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `CLI failed: prompt-coach ${args.join(" ")}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function configurePort(port) {
  const configPath = join(dataDir, "config.json");
  const config = readJson(configPath);
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

function parseFixtureSet(argv) {
  const flag = argv.find(
    (entry) => entry === "--fixture-set" || entry.startsWith("--fixture-set="),
  );
  if (!flag) return "synthetic";
  const value = flag.includes("=")
    ? flag.split("=", 2)[1]
    : argv[argv.indexOf(flag) + 1];
  if (!value || value === "synthetic") return "synthetic";
  if (value === "real") return "real";
  throw new Error(
    `Unknown --fixture-set value: ${value}. Expected synthetic or real.`,
  );
}

function passes(scores) {
  return (
    scores.privacy_leak_count === thresholds.privacy_leak_count &&
    scores.retrieval_top3 >= thresholds.retrieval_top3 &&
    scores.coach_gap_fix_rate >= thresholds.coach_gap_fix_rate &&
    scores.coach_prompt_actionability >=
      thresholds.coach_prompt_actionability &&
    scores.prompt_quality_score_calibration >=
      thresholds.prompt_quality_score_calibration &&
    scores.analytics_score >= thresholds.analytics_score &&
    scores.ingest_p95_ms <= thresholds.ingest_p95_ms &&
    scores.search_p95_ms <= thresholds.search_p95_ms &&
    scores.dashboard_ms <= thresholds.dashboard_ms &&
    scores.export_ms <= thresholds.export_ms
  );
}

function printReport(report) {
  console.log(`prompt-coach benchmark ${report.dataset}`);
  console.log(`pass: ${report.pass ? "yes" : "no"}`);
  for (const [key, value] of Object.entries(report.scores)) {
    console.log(`${key}: ${value}`);
  }
  const misses = report.details.retrieval_cases.filter((item) => !item.hit);
  if (misses.length > 0) {
    console.log(
      `retrieval_misses: ${misses.map((item) => `${item.label}@${item.query}`).join(", ")}`,
    );
  }
  const ab = report.details.experimental_rules_ab ?? {};
  for (const [rule, data] of Object.entries(ab)) {
    console.log(
      `experimental_rules_ab.${rule}: lifted ${data.lifted}/${data.cases}, avg_delta ${data.average_delta}`,
    );
    if (data.examples.length > 0) {
      console.log(`  examples: ${data.examples.join(", ")}`);
    }
  }
}

async function timed(fn) {
  const started = performance.now();
  await fn();
  return performance.now() - started;
}

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * 0.95) - 1,
  );
  return sorted[index] ?? 0;
}

function roundScore(value) {
  return Math.round(value * 1000) / 1000;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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
