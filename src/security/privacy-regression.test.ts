import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { exportForCli } from "../cli/commands/export.js";
import {
  importDryRunForCli,
  showImportJobForCli,
} from "../cli/commands/import.js";
import { initializePromptMemory } from "../config/config.js";
import { runClaudeCodeHook } from "../hooks/wrapper.js";
import { redactPrompt } from "../redaction/redact.js";
import { createServer } from "../server/create-server.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";

const tempDirs: string[] = [];

const rawSecret = "sk-proj-privacy1234567890abcdef";
const rawCwd = "/Users/example/private-project";
const rawPromptPath = `${rawCwd}/src/secret.ts`;
const rawPrompt = `Fix ${rawPromptPath} with token ${rawSecret}. Run pnpm test.`;

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("privacy regression fixture", () => {
  it("keeps raw secrets and prompt-body paths out of Markdown, SQLite, and FTS", async () => {
    const { dataDir, storage, id } = await createStoredPrivacyFixture();

    try {
      const row = storage.listPromptRows()[0]!;
      const markdown = readFileSync(row.markdown_path, "utf8");
      const dbSnapshot = readSqlitePrivacySnapshot(dataDir);

      expect(markdown).toContain("[REDACTED:api_key]");
      expect(markdown).toContain("[REDACTED:path]");
      expectNoRawFixture(markdown, { includeCwd: false });
      expectNoRawFixture(dbSnapshot, { includeCwd: false });

      expect(storage.searchPromptIds(rawSecret)).toEqual([]);
      expect(storage.searchPromptIds(rawPromptPath)).toEqual([]);
      expect(storage.searchPromptIds("REDACTED")).toEqual([id]);
    } finally {
      storage.close();
    }
  });

  it("keeps browser API responses raw-free", async () => {
    const { dataDir, storage, id } = await createStoredPrivacyFixture();
    const server = createServer({
      dataDir,
      auth: {
        appToken: "app-token",
        ingestToken: "ingest-token",
        webSessionSecret: "web-session-secret",
      },
      storage,
      redactionMode: "mask",
    });

    try {
      const list = await server.inject({
        method: "GET",
        url: "/api/v1/prompts",
        headers: authedHeaders(),
      });
      const detail = await server.inject({
        method: "GET",
        url: `/api/v1/prompts/${id}`,
        headers: authedHeaders(),
      });
      const quality = await server.inject({
        method: "GET",
        url: "/api/v1/quality",
        headers: authedHeaders(),
      });
      const combined = [list.body, detail.body, quality.body].join("\n");

      expect(list.statusCode).toBe(200);
      expect(detail.statusCode).toBe(200);
      expect(quality.statusCode).toBe(200);
      expect(combined).toContain("[REDACTED:path]");
      expect(combined).toContain("[REDACTED:api_key]");
      expectNoRawFixture(combined, { includeCwd: true });
    } finally {
      await server.close();
      storage.close();
    }
  });

  it("keeps export and import CLI job surfaces raw-free", async () => {
    const { dataDir, storage } = await createStoredPrivacyFixture();
    storage.close();

    const preview = JSON.parse(
      exportForCli({
        anonymized: true,
        dataDir,
        json: true,
        preset: "anonymized_review",
        preview: true,
      }),
    ) as { id: string };
    const exported = exportForCli({
      anonymized: true,
      dataDir,
      job: preview.id,
      json: true,
    });

    const importFile = join(dataDir, "privacy-import.jsonl");
    writeFileSync(
      importFile,
      `${JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "session-import-privacy",
        cwd: rawCwd,
        prompt: rawPrompt,
      })}\n`,
    );
    const importPreview = JSON.parse(
      importDryRunForCli({
        dataDir,
        dryRun: true,
        file: importFile,
        json: true,
        saveJob: true,
        source: "manual-jsonl",
      }),
    ) as { job_id: string };
    const importJob = showImportJobForCli(importPreview.job_id, {
      dataDir,
      json: true,
    });
    const combined = [JSON.stringify(preview), exported, importJob].join("\n");

    expect(exported).toContain("[REDACTED:path]");
    expect(exported).toContain("[REDACTED:api_key]");
    expect(importJob).toContain("[REDACTED:path]");
    expect(importJob).toContain("[REDACTED:api_key]");
    expectNoRawFixture(combined, { includeCwd: true });
    expect(combined).not.toContain("prmt_");
  });

  it("keeps hook failure output empty for raw prompt fixtures", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const result = await runClaudeCodeHook({
      dataDir,
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "session-hook-privacy",
        cwd: rawCwd,
        prompt: rawPrompt,
      }),
      postPayload: async () => {
        throw new Error("server down");
      },
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expectNoRawFixture(JSON.stringify(result), { includeCwd: true });
  });
});

async function createStoredPrivacyFixture(): Promise<{
  dataDir: string;
  storage: ReturnType<typeof createSqlitePromptStorage>;
  id: string;
}> {
  const dataDir = createTempDir();
  initializePromptMemory({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: "test-secret",
    now: () => new Date("2026-05-02T10:00:00.000Z"),
  });
  const event = normalizeClaudeCodePayload(
    {
      session_id: "session-privacy-regression",
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd: rawCwd,
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: rawPrompt,
    },
    new Date("2026-05-02T09:59:59.000Z"),
  );
  const stored = await storage.storePrompt({
    event,
    redaction: redactPrompt(event.prompt, "mask"),
  });

  return { dataDir, storage, id: stored.id };
}

function readSqlitePrivacySnapshot(dataDir: string): string {
  const db = new Database(join(dataDir, "prompt-memory.sqlite"));

  try {
    return JSON.stringify({
      prompts: db.prepare("SELECT * FROM prompts").all(),
      prompt_fts: db.prepare("SELECT * FROM prompt_fts").all(),
      prompt_analyses: db.prepare("SELECT * FROM prompt_analyses").all(),
      redaction_events: db.prepare("SELECT * FROM redaction_events").all(),
      export_jobs: db.prepare("SELECT * FROM export_jobs").all(),
      import_jobs: db.prepare("SELECT * FROM import_jobs").all(),
    });
  } finally {
    db.close();
  }
}

function expectNoRawFixture(
  value: string,
  options: { includeCwd: boolean },
): void {
  expect(value).not.toContain(rawSecret);
  expect(value).not.toContain(rawPromptPath);

  if (options.includeCwd) {
    expect(value).not.toContain(rawCwd);
  }
}

function authedHeaders(): Record<string, string> {
  return {
    authorization: "Bearer app-token",
    host: "127.0.0.1:17373",
  };
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-privacy-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
