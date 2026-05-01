import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { redactPrompt } from "../redaction/redact.js";
import { createServer } from "../server/create-server.js";
import { initializePromptMemory } from "../config/config.js";
import { createSqlitePromptStorage } from "./sqlite.js";

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
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-storage-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
