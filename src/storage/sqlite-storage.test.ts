import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { redactPrompt } from "../redaction/redact.js";
import { createServer } from "../server/create-server.js";
import { initializePromptMemory } from "../config/config.js";
import { createSqlitePromptStorage } from "./sqlite.js";
import Database from "better-sqlite3";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SQLite prompt storage", () => {
  it("initializes directories, applies migration, stores Markdown, indexes FTS, and deduplicates", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:30:00.000Z"),
    });

    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-1",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Please store this prompt with email test@example.com",
      },
      new Date("2026-05-01T10:29:59.000Z"),
    );
    const redaction = redactPrompt(event.prompt, "mask");

    const first = await storage.storePrompt({ event, redaction });
    const duplicate = await storage.storePrompt({ event, redaction });

    expect(first.duplicate).toBe(false);
    expect(duplicate).toEqual({ id: first.id, duplicate: true });
    expect(storage.getAppliedMigrations()).toEqual([
      { version: 1, name: "001_initial" },
    ]);

    const prompts = storage.listPromptRows();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({
      id: first.id,
      tool: "claude-code",
      idempotency_key: event.idempotency_key,
      redaction_policy: "mask",
    });

    const markdown = readFileSync(prompts[0]!.markdown_path, "utf8");
    expect(markdown).toContain("schema_version: 1");
    expect(markdown).toContain("[REDACTED:email]");
    expect(markdown).not.toContain("test@example.com");

    expect(storage.searchPromptIds("store")).toEqual([first.id]);
    expect(storage.searchPromptIds("test@example.com")).toEqual([]);
    expect(storage.searchPromptIds('"unterminated OR email')).toEqual([]);
  });

  it("keeps detected raw secrets out of Markdown, SQLite rows, redaction events, and FTS", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:30:00.000Z"),
    });
    const rawSecret = "sk-proj-1234567890abcdef";
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-secret-regression",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: `Please handle this token ${rawSecret}`,
      },
      new Date("2026-05-01T10:29:59.000Z"),
    );

    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    const row = storage.listPromptRows()[0]!;
    const markdown = readFileSync(row.markdown_path, "utf8");
    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    const promptRows = db.prepare("SELECT * FROM prompts").all();
    const redactionRows = db.prepare("SELECT * FROM redaction_events").all();
    db.close();

    expect(markdown).toContain("[REDACTED:api_key]");
    expect(markdown).not.toContain(rawSecret);
    expect(JSON.stringify(promptRows)).not.toContain(rawSecret);
    expect(JSON.stringify(redactionRows)).not.toContain(rawSecret);
    expect(storage.searchPromptIds("sk-proj")).toEqual([]);
    expect(storage.searchPromptIds(rawSecret)).toEqual([]);
    expect(storage.searchPromptIds("REDACTED")).toEqual([stored.id]);
  });

  it("connects Claude ingest to real Markdown, SQLite, and FTS storage", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:30:00.000Z"),
    });
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

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: {
        session_id: "session-1",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Index this prompt for later search",
      },
    });

    expect(response.statusCode).toBe(200);
    const id = response.json<{ data: { id: string } }>().data.id;

    expect(storage.listPromptRows()).toHaveLength(1);
    expect(storage.searchPromptIds("later")).toEqual([id]);
  });

  it("connects Codex ingest to real Markdown, SQLite, and FTS storage", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:31:00.000Z"),
    });
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

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/codex",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: {
        session_id: "codex-session-1",
        turn_id: "turn-1",
        transcript_path: "/Users/example/.codex/sessions/session.jsonl",
        cwd: "/Users/example/project",
        hook_event_name: "UserPromptSubmit",
        model: "gpt-5.5",
        prompt: "Index this Codex beta prompt",
      },
    });

    expect(response.statusCode).toBe(200);
    const id = response.json<{ data: { id: string } }>().data.id;
    const rows = storage.listPromptRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      tool: "codex",
      source_event: "UserPromptSubmit",
      session_id: "codex-session-1",
      cwd: "/Users/example/project",
      adapter_version: "codex-v1",
    });
    expect(storage.searchPromptIds("beta")).toEqual([id]);
  });

  it("rebuilds FTS with redaction validation and quarantines hash mismatches", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:30:00.000Z"),
    });

    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-1",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "safe prompt",
      },
      new Date("2026-05-01T10:29:59.000Z"),
    );
    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    const row = storage.listPromptRows()[0]!;

    writeFileSync(
      row.markdown_path,
      `${readFileSync(row.markdown_path, "utf8")}\nleaked sk-proj-1234567890abcdef\n`,
    );

    const result = storage.rebuildIndex({ redactionMode: "mask" });

    expect(result.hashMismatches).toEqual([stored.id]);
    expect(storage.listPromptRows()[0]?.index_status).toBe("hash_mismatch");
    expect(storage.searchPromptIds("sk-proj")).toEqual([]);
  });

  it("marks missing markdown files during reconciliation", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:30:00.000Z"),
    });

    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-1",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "safe prompt",
      },
      new Date("2026-05-01T10:29:59.000Z"),
    );
    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    const row = storage.listPromptRows()[0]!;
    unlinkSync(row.markdown_path);

    expect(storage.reconcileStorage()).toEqual({ missingFiles: [stored.id] });
    expect(storage.listPromptRows()[0]?.index_status).toBe("missing_file");
  });

  it("lists, searches, reads, and deletes stored prompts", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T10:01:00.000Z",
        "2026-05-01T10:02:00.000Z",
      ]),
    });

    const alpha = await storeClaudePrompt(storage, {
      prompt: "alpha prompt",
      receivedAt: "2026-05-01T10:00:00.000Z",
    });
    const beta = await storeClaudePrompt(storage, {
      prompt: "beta prompt",
      receivedAt: "2026-05-01T10:01:00.000Z",
    });
    const gamma = await storeClaudePrompt(storage, {
      prompt: "gamma prompt",
      receivedAt: "2026-05-01T10:02:00.000Z",
    });

    const firstPage = storage.listPrompts({ limit: 2 });
    expect(firstPage.items.map((item) => item.id)).toEqual([gamma.id, beta.id]);
    expect(firstPage.nextCursor).toBeTypeOf("string");

    const secondPage = storage.listPrompts({
      limit: 2,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.items.map((item) => item.id)).toEqual([alpha.id]);
    expect(secondPage.nextCursor).toBeUndefined();

    expect(storage.searchPrompts("beta", { limit: 10 }).items).toMatchObject([
      { id: beta.id, prompt_length: "beta prompt".length },
    ]);

    const detail = storage.getPrompt(beta.id);
    expect(detail?.markdown).toContain("beta prompt");
    expect(detail?.markdown).not.toContain("schema_version");
    expect(detail?.cwd).toBe("/Users/example/project");

    const betaPath = storage
      .listPromptRows()
      .find((row) => row.id === beta.id)?.markdown_path;
    expect(betaPath).toBeTypeOf("string");
    expect(storage.deletePrompt(beta.id)).toEqual({ deleted: true });
    expect(storage.getPrompt(beta.id)).toBeUndefined();
    expect(storage.searchPrompts("beta", { limit: 10 }).items).toEqual([]);
    expect(existsSync(betaPath!)).toBe(false);
    expect(storage.deletePrompt(beta.id)).toEqual({ deleted: false });

    const sensitive = await storeClaudePrompt(storage, {
      prompt: "delete redaction event sk-proj-1234567890abcdef",
      receivedAt: "2026-05-01T10:03:00.000Z",
    });
    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM redaction_events WHERE prompt_id = ?",
        )
        .get(sensitive.id) as { count: number },
    ).toEqual({ count: 1 });
    expect(storage.deletePrompt(sensitive.id)).toEqual({ deleted: true });
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM prompts WHERE id = ?")
        .get(sensitive.id) as { count: number },
    ).toEqual({ count: 0 });
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM prompt_fts WHERE prompt_id = ?")
        .get(sensitive.id) as { count: number },
    ).toEqual({ count: 0 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM redaction_events WHERE prompt_id = ?",
        )
        .get(sensitive.id) as { count: number },
    ).toEqual({ count: 0 });
    db.close();
  });

  it("filters prompt lists and searches by tool, sensitivity, cwd, and date range", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T10:01:00.000Z",
        "2026-05-01T10:02:00.000Z",
      ]),
    });

    await storeClaudePrompt(storage, {
      prompt: "safe alpha",
      receivedAt: "2026-05-01T10:00:00.000Z",
      cwd: "/Users/example/project-a",
    });
    const sensitive = await storeClaudePrompt(storage, {
      prompt: "secret token sk-proj-1234567890abcdef",
      receivedAt: "2026-05-01T10:01:00.000Z",
      cwd: "/Users/example/project-b",
    });
    await storeClaudePrompt(storage, {
      prompt: "safe gamma",
      receivedAt: "2026-05-01T10:02:00.000Z",
      cwd: "/Users/example/project-a",
    });

    expect(
      storage
        .listPrompts({ cwdPrefix: "/Users/example/project-a" })
        .items.map((item) => item.cwd),
    ).toEqual(["/Users/example/project-a", "/Users/example/project-a"]);
    expect(
      storage.listPrompts({ isSensitive: true }).items.map((item) => item.id),
    ).toEqual([sensitive.id]);
    expect(
      storage
        .listPrompts({
          tool: "claude-code",
          receivedFrom: "2026-05-01T10:01:00.000Z",
          receivedTo: "2026-05-01T10:01:00.000Z",
        })
        .items.map((item) => item.id),
    ).toEqual([sensitive.id]);
    expect(
      storage
        .searchPrompts("secret", { isSensitive: true })
        .items.map((item) => item.id),
    ).toEqual([sensitive.id]);
  });

  it("rebuilds missing database rows from Markdown files", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:30:00.000Z"),
    });
    const stored = await storeClaudePrompt(storage, {
      prompt: "markdown source of truth",
      receivedAt: "2026-05-01T10:30:00.000Z",
    });
    const row = storage.listPromptRows()[0]!;
    storage.close();

    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    db.prepare("DELETE FROM prompt_fts WHERE prompt_id = ?").run(stored.id);
    db.prepare("DELETE FROM prompts WHERE id = ?").run(stored.id);
    db.close();

    const rebuiltStorage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
    });

    expect(rebuiltStorage.getPrompt(stored.id)).toBeUndefined();
    expect(
      rebuiltStorage.rebuildIndex({ redactionMode: "mask" }),
    ).toMatchObject({
      rebuilt: [stored.id],
      hashMismatches: [],
    });
    expect(rebuiltStorage.getPrompt(stored.id)?.markdown).toContain(
      "markdown source of truth",
    );
    expect(rebuiltStorage.searchPromptIds("truth")).toEqual([stored.id]);
    expect(existsSync(row.markdown_path)).toBe(true);
  });
});

type StoredPrompt = Awaited<ReturnType<typeof storeClaudePrompt>>;

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  options: { prompt: string; receivedAt: string; cwd?: string },
): Promise<{ id: string; duplicate: boolean }> {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${options.receivedAt}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd: options.cwd ?? "/Users/example/project",
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: options.prompt,
    },
    new Date(options.receivedAt),
  );

  return storage.storePrompt({
    event,
    redaction: redactPrompt(event.prompt, "mask"),
  });
}

function nextDate(values: string[]): () => Date {
  let index = 0;

  return () => new Date(values[index++] ?? values.at(-1)!);
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-storage-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
