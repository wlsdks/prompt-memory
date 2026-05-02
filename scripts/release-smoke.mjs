#!/usr/bin/env node
import Database from "better-sqlite3";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const cliPath = join(repoRoot, "dist", "cli", "index.js");
const tempRoot = mkdtempSync(join(tmpdir(), "prompt-memory-release-smoke-"));
const dataDir = join(tempRoot, "data");
const homeDir = join(tempRoot, "home");
const serverPort = 18_000 + Math.floor(Math.random() * 10_000);
const serverBaseUrl = `http://127.0.0.1:${serverPort}`;
const cliEnv = {
  ...process.env,
  HOME: homeDir,
  USERPROFILE: homeDir,
};
let serverProcess;

try {
  assertFileExists(cliPath, "Run `pnpm build` before release smoke.");
  mkdirSync(homeDir, { recursive: true });

  step("Initialize isolated data directory");
  runCli(["init", "--data-dir", dataDir]);
  configureSmokePort();

  step("Preview hook installers without touching real user config");
  runCli(["install-hook", "claude-code", "--data-dir", dataDir, "--dry-run"]);
  runCli(["install-hook", "codex", "--data-dir", dataDir, "--dry-run"]);

  step("Start local server");
  serverProcess = startServer();
  await waitForHealth(`${serverBaseUrl}/api/v1/health`);

  step("Capture Claude Code and Codex prompt payloads");
  const claudeId = await ingest("/api/v1/ingest/claude-code", {
    session_id: "release-smoke-claude-session",
    transcript_path: join(homeDir, ".claude", "session.jsonl"),
    cwd: join(homeDir, "project"),
    permission_mode: "default",
    hook_event_name: "UserPromptSubmit",
    prompt:
      "Release smoke Claude prompt with secret sk-proj-1234567890abcdef. Add tests and return a concise Markdown summary.",
  });
  const codexId = await ingest("/api/v1/ingest/codex", {
    session_id: "release-smoke-codex-session",
    turn_id: "turn-1",
    transcript_path: join(homeDir, ".codex", "sessions", "session.jsonl"),
    cwd: join(homeDir, "project"),
    hook_event_name: "UserPromptSubmit",
    model: "gpt-5.5",
    prompt:
      "Release smoke Codex prompt for FTS search. Verify CLI list and web API detail.",
  });

  step("Verify CLI list/search/show/rebuild-index");
  const list = parseJson(runCli(["list", "--data-dir", dataDir, "--json"]));
  assertEqual(list.items.length, 2, "CLI list should show two prompts.");
  assertIncludes(
    list.items.map((item) => item.id),
    claudeId,
    "CLI list should contain Claude prompt.",
  );
  assertIncludes(
    list.items.map((item) => item.id),
    codexId,
    "CLI list should contain Codex prompt.",
  );

  const search = parseJson(
    runCli(["search", "Codex", "--data-dir", dataDir, "--json"]),
  );
  assertIncludes(
    search.items.map((item) => item.id),
    codexId,
    "CLI search should find Codex prompt.",
  );

  const shown = parseJson(
    runCli(["show", claudeId, "--data-dir", dataDir, "--json"]),
  );
  assertIncludes(
    shown.markdown,
    "[REDACTED:api_key]",
    "Show should return redacted Markdown.",
  );
  assertNotIncludes(
    JSON.stringify(shown),
    "sk-proj-1234567890abcdef",
    "Show output must not contain raw secret.",
  );
  assertEqual(
    shown.analysis?.analyzer,
    "local-rules-v1",
    "Show output should include local analysis preview.",
  );

  const rebuild = parseJson(
    runCli(["rebuild-index", "--data-dir", dataDir, "--json"]),
  );
  assertEqual(
    rebuild.hashMismatches.length,
    0,
    "Rebuild should not quarantine clean prompts.",
  );

  step("Execute transcript import and verify imported-only filter");
  const importFile = join(tempRoot, "import.jsonl");
  const importSecret = "sk-proj-import1234567890abcdef";
  writeFileSync(
    importFile,
    [
      JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "release-smoke-import-session",
        cwd: join(homeDir, "project"),
        prompt: `Imported release smoke prompt for ${join(homeDir, "project", "src", "secret.ts")} with ${importSecret}`,
      }),
      JSON.stringify({
        role: "assistant",
        content: "assistant output should not import",
      }),
    ].join("\n"),
  );
  const importDryRun = parseJson(
    runCli([
      "import",
      "--data-dir",
      dataDir,
      "--dry-run",
      "--file",
      importFile,
      "--save-job",
      "--json",
    ]),
  );
  const executedImport = parseJson(
    runCli([
      "import",
      "--data-dir",
      dataDir,
      "--resume",
      importDryRun.job_id,
      "--file",
      importFile,
      "--json",
    ]),
  );
  assertEqual(
    executedImport.imported_count,
    1,
    "Import execution should store one prompt.",
  );
  assertEqual(
    executedImport.skipped_count,
    1,
    "Import execution should skip assistant output.",
  );
  const importedOnly = parseJson(
    runCli([
      "list",
      "--data-dir",
      dataDir,
      "--import-job",
      importDryRun.job_id,
      "--json",
    ]),
  );
  assertEqual(
    importedOnly.items.length,
    1,
    "Imported-only list should show one prompt.",
  );
  assertNotIncludes(
    JSON.stringify(importedOnly),
    importSecret,
    "Imported-only output must not contain raw import secret.",
  );
  verifyImportRecords(importDryRun.job_id, importSecret);

  step("Preview and execute anonymized export");
  const exportPreview = parseJson(
    runCli([
      "export",
      "--data-dir",
      dataDir,
      "--anonymized",
      "--preset",
      "anonymized_review",
      "--preview",
      "--json",
    ]),
  );
  assertEqual(
    exportPreview.counts.prompt_count,
    3,
    "Export preview should include three live prompts.",
  );
  assertNotIncludes(
    JSON.stringify(exportPreview),
    "prmt_",
    "Export preview must not contain stable prompt ids.",
  );
  const exported = parseJson(
    runCli([
      "export",
      "--data-dir",
      dataDir,
      "--anonymized",
      "--job",
      exportPreview.id,
      "--json",
    ]),
  );
  assertEqual(exported.count, 3, "Executed export count should match preview.");
  assertIncludes(
    JSON.stringify(exported),
    "[REDACTED:path]",
    "Executed export should anonymize filesystem paths.",
  );
  assertNotIncludes(
    JSON.stringify(exported),
    importSecret,
    "Executed export must not contain raw import secret.",
  );
  assertNotIncludes(
    JSON.stringify(exported),
    homeDir,
    "Executed export must not contain raw home directory paths.",
  );
  verifyExportJobs(importSecret);

  step("Verify SQLite, Markdown, FTS, and delete cleanup");
  verifyDatabaseBeforeDelete(claudeId);
  const claudeMarkdownPath = getMarkdownPath(claudeId);
  assertFileExists(
    claudeMarkdownPath,
    "Claude Markdown should exist before delete.",
  );
  runCli(["delete", claudeId, "--data-dir", dataDir, "--json"]);
  assert(
    !existsSync(claudeMarkdownPath),
    "Claude Markdown should be removed after delete.",
  );
  verifyPromptDeleted(claudeId);

  const afterDeleteSearch = parseJson(
    runCli(["search", "Release", "--data-dir", dataDir, "--json"]),
  );
  assert(
    afterDeleteSearch.items.every((item) => item.id !== claudeId),
    "Deleted prompt should not appear in FTS search.",
  );
  assertIncludes(
    afterDeleteSearch.items.map((item) => item.id),
    codexId,
    "Remaining Codex prompt should still appear in search.",
  );

  console.log("release smoke passed");
} finally {
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

async function ingest(path, payload) {
  const hookAuth = readJson(join(dataDir, "hook-auth.json"));
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

function verifyDatabaseBeforeDelete(promptId) {
  const db = openDb();
  try {
    assertEqual(
      scalar(db, "SELECT COUNT(*) FROM prompts WHERE id = ?", promptId),
      1,
      "Prompt row should exist before delete.",
    );
    assertEqual(
      scalar(
        db,
        "SELECT COUNT(*) FROM prompt_fts WHERE prompt_id = ?",
        promptId,
      ),
      1,
      "FTS row should exist before delete.",
    );
    assertEqual(
      scalar(
        db,
        "SELECT COUNT(*) FROM prompt_analyses WHERE prompt_id = ?",
        promptId,
      ),
      1,
      "Analysis row should exist before delete.",
    );
    assertEqual(
      scalar(
        db,
        "SELECT COUNT(*) FROM redaction_events WHERE prompt_id = ?",
        promptId,
      ),
      1,
      "Redaction event should exist before delete.",
    );
    assertNotIncludes(
      JSON.stringify(db.prepare("SELECT * FROM prompts").all()),
      "sk-proj-1234567890abcdef",
      "Prompt rows must not contain raw secret.",
    );
    assertNotIncludes(
      JSON.stringify(db.prepare("SELECT * FROM prompt_analyses").all()),
      "sk-proj-1234567890abcdef",
      "Analysis rows must not contain raw secret.",
    );
  } finally {
    db.close();
  }
}

function verifyImportRecords(jobId, rawSecret) {
  const db = openDb();
  try {
    assertEqual(
      scalar(db, "SELECT COUNT(*) FROM import_records WHERE job_id = ?", jobId),
      1,
      "Import records should track imported prompt.",
    );
    assertNotIncludes(
      JSON.stringify(db.prepare("SELECT * FROM import_jobs").all()),
      rawSecret,
      "Import jobs must not contain raw import secret.",
    );
    assertNotIncludes(
      JSON.stringify(db.prepare("SELECT * FROM import_records").all()),
      rawSecret,
      "Import records must not contain raw import secret.",
    );
  } finally {
    db.close();
  }
}

function verifyExportJobs(rawSecret) {
  const db = openDb();
  try {
    const rows = JSON.stringify(db.prepare("SELECT * FROM export_jobs").all());
    assertEqual(
      scalar(db, "SELECT COUNT(*) FROM export_jobs"),
      1,
      "Export preview should create one export job.",
    );
    assertNotIncludes(
      rows,
      "prmt_",
      "Export jobs must not contain stable prompt ids.",
    );
    assertNotIncludes(
      rows,
      rawSecret,
      "Export jobs must not contain raw import secret.",
    );
    assertNotIncludes(
      rows,
      homeDir,
      "Export jobs must not contain raw home directory paths.",
    );
  } finally {
    db.close();
  }
}

function verifyPromptDeleted(promptId) {
  const db = openDb();
  try {
    for (const table of [
      "prompts",
      "prompt_fts",
      "prompt_analyses",
      "redaction_events",
      "prompt_tags",
    ]) {
      const column = table === "prompts" ? "id" : "prompt_id";
      assertEqual(
        scalar(
          db,
          `SELECT COUNT(*) FROM ${table} WHERE ${column} = ?`,
          promptId,
        ),
        0,
        `${table} should not retain deleted prompt.`,
      );
    }
  } finally {
    db.close();
  }
}

function getMarkdownPath(promptId) {
  const db = openDb();
  try {
    const row = db
      .prepare("SELECT markdown_path FROM prompts WHERE id = ?")
      .get(promptId);
    assert(row?.markdown_path, "Prompt markdown path should be present.");
    return row.markdown_path;
  } finally {
    db.close();
  }
}

function openDb() {
  const db = new Database(join(dataDir, "prompt-memory.sqlite"));
  const walMode = db.pragma("journal_mode = WAL", { simple: true });
  assertEqual(
    String(walMode).toLowerCase(),
    "wal",
    "SQLite WAL should be enabled.",
  );
  db.prepare(
    "CREATE VIRTUAL TABLE IF NOT EXISTS smoke_fts USING fts5(body)",
  ).run();
  db.prepare("DROP TABLE smoke_fts").run();
  return db;
}

function scalar(db, sql, ...params) {
  const row = db.prepare(sql).get(...params);
  return Object.values(row)[0];
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function configureSmokePort() {
  const configPath = join(dataDir, "config.json");
  const config = readJson(configPath);
  config.server.port = serverPort;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

function parseJson(output) {
  return JSON.parse(output);
}

function assertFileExists(path, message) {
  assert(existsSync(path) && statSync(path).isFile(), message);
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
