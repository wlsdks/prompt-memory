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
	      { version: 2, name: "002_analysis_checklist_tags" },
	      { version: 3, name: "003_prompt_usefulness" },
	      { version: 4, name: "004_duplicate_prompt_index" },
	      { version: 5, name: "005_project_policies" },
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
    expect(storage.listPrompts().items[0]).toMatchObject({
      id: stored.id,
      snippet: expect.stringContaining("[REDACTED:api_key]"),
    });
    expect(JSON.stringify(storage.listPrompts().items)).not.toContain(
      rawSecret,
    );
    expect(
      JSON.stringify(storage.getPrompt(stored.id)?.analysis),
    ).not.toContain(rawSecret);
    expect(
      JSON.stringify(storage.getPrompt(stored.id)?.analysis),
    ).not.toContain("[REDACTED:api_key]");
  });

  it("stores local rule-based analysis preview with prompt details", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:30:00.000Z"),
    });

    const stored = await storeClaudePrompt(storage, {
      prompt:
        "Update src/storage/sqlite.ts to persist analysis. Add tests and run pnpm test. Return a concise Markdown summary.",
      receivedAt: "2026-05-01T10:30:00.000Z",
    });
    const detail = storage.getPrompt(stored.id);

    expect(detail?.analysis).toMatchObject({
      analyzer: "local-rules-v1",
      summary: expect.stringContaining("구체적인"),
      warnings: [],
      suggestions: [],
      checklist: expect.arrayContaining([
        expect.objectContaining({
          key: "verification_criteria",
          status: "good",
        }),
      ]),
      tags: expect.arrayContaining(["backend", "test"]),
      created_at: "2026-05-01T10:30:00.000Z",
    });
  });

  it("stores prompt tags, exposes quality gaps, filters by tag, and deletes tag links", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate(["2026-05-01T10:00:00.000Z", "2026-05-01T10:01:00.000Z"]),
    });

    const ui = await storeClaudePrompt(storage, {
      prompt:
        "Fix UI list overflow in src/web/src/App.tsx. Add Playwright verification and return Markdown summary.",
      receivedAt: "2026-05-01T10:00:00.000Z",
    });
    const vague = await storeClaudePrompt(storage, {
      prompt: "이거 좀 고쳐줘",
      receivedAt: "2026-05-01T10:01:00.000Z",
    });

    expect(storage.getPrompt(ui.id)?.analysis?.tags).toEqual(
      expect.arrayContaining(["bugfix", "ui", "test"]),
    );
    expect(
      storage.listPrompts({ tag: "ui" }).items.map((item) => item.id),
    ).toEqual([ui.id]);
    expect(
      storage.listPrompts().items.find((item) => item.id === vague.id)
        ?.quality_gaps,
    ).toEqual(expect.arrayContaining(["목표 명확성", "검증 기준"]));

    expect(storage.deletePrompt(ui.id)).toEqual({ deleted: true });
    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM prompt_tags WHERE prompt_id = ?",
        )
        .get(ui.id) as { count: number },
    ).toEqual({ count: 0 });
    db.close();
  });

  it("builds a prompt quality dashboard without returning prompt bodies", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-01T10:00:00.000Z",
        "2026-05-02T10:00:00.000Z",
        "2026-05-03T10:00:00.000Z",
      ]),
    });

    await storeClaudePrompt(storage, {
      prompt: "이거 고쳐줘",
      receivedAt: "2026-05-01T10:00:00.000Z",
      cwd: "/Users/example/project-a",
    });
    const sensitive = await storeClaudePrompt(storage, {
      prompt: "저거 고쳐줘 token sk-proj-1234567890abcdef",
      receivedAt: "2026-05-02T10:00:00.000Z",
      cwd: "/Users/example/project-a",
    });
    const docs = await storeClaudePrompt(storage, {
      prompt:
        "현재 README 온보딩 설명이 부족합니다. Update docs/README.md only, return Markdown summary, and run pnpm test expecting pass.",
      receivedAt: "2026-05-03T10:00:00.000Z",
      cwd: "/Users/example/project-b",
    });
    storage.recordPromptUsage(docs.id, "prompt_copied");
    storage.setPromptBookmark(docs.id, true);

    const dashboard = storage.getQualityDashboard();
    const serialized = JSON.stringify(dashboard);

    expect(dashboard.total_prompts).toBe(3);
    expect(dashboard.recent.last_7_days).toBe(3);
    expect(dashboard.trend.daily).toEqual([
      {
        date: "2026-04-27",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-04-28",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-04-29",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-04-30",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-05-01",
        prompt_count: 1,
        quality_gap_count: 1,
        quality_gap_rate: 1,
        sensitive_count: 0,
      },
      {
        date: "2026-05-02",
        prompt_count: 1,
        quality_gap_count: 1,
        quality_gap_rate: 1,
        sensitive_count: 1,
      },
      {
        date: "2026-05-03",
        prompt_count: 1,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        sensitive_count: 0,
      },
    ]);
    expect(dashboard.distribution.by_tool).toMatchObject([
      { key: "claude-code", count: 3 },
    ]);
    expect(dashboard.missing_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "verification_criteria",
          missing: 2,
        }),
      ]),
    );
    expect(dashboard.patterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          project: "/Users/example/project-a",
          item_key: "verification_criteria",
        }),
      ]),
    );
    expect(dashboard.project_profiles).toEqual([
      expect.objectContaining({
        key: "/Users/example/project-a",
        label: "project-a",
        prompt_count: 2,
        quality_gap_count: 2,
        quality_gap_rate: 1,
        sensitive_count: 1,
        copied_count: 0,
        bookmarked_count: 0,
        top_gap: expect.objectContaining({
          key: "verification_criteria",
          count: 2,
        }),
      }),
      expect.objectContaining({
        key: "/Users/example/project-b",
        label: "project-b",
        prompt_count: 1,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        sensitive_count: 0,
        copied_count: 1,
        bookmarked_count: 1,
        top_gap: undefined,
      }),
    ]);
    expect(dashboard.instruction_suggestions.length).toBeGreaterThan(0);
    expect(serialized).not.toContain("이거 고쳐줘");
    expect(serialized).not.toContain("저거 고쳐줘");
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
    expect(serialized).not.toContain("현재 README 온보딩 설명이 부족합니다.");
    expect(storage.getPrompt(sensitive.id)?.is_sensitive).toBe(true);
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
      {
        id: beta.id,
        prompt_length: "beta prompt".length,
        snippet: "beta prompt",
      },
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
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM prompt_analyses WHERE prompt_id = ?",
        )
        .get(sensitive.id) as { count: number },
    ).toEqual({ count: 0 });
    db.close();
  });

  it("records local usefulness signals and removes them with prompt delete", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T10:01:00.000Z",
        "2026-05-01T10:02:00.000Z",
        "2026-05-01T10:03:00.000Z",
      ]),
    });

    const alpha = await storeClaudePrompt(storage, {
      prompt: "Reusable refactor prompt with pnpm test",
      receivedAt: "2026-05-01T10:00:00.000Z",
    });
    const beta = await storeClaudePrompt(storage, {
      prompt: "One-off docs prompt",
      receivedAt: "2026-05-01T10:01:00.000Z",
    });

    expect(storage.recordPromptUsage(alpha.id, "prompt_copied")).toMatchObject({
      recorded: true,
      usefulness: {
        copied_count: 1,
        bookmarked: false,
      },
    });
    storage.recordPromptUsage(alpha.id, "prompt_copied");
    expect(storage.setPromptBookmark(alpha.id, true)).toMatchObject({
      updated: true,
      usefulness: {
        copied_count: 2,
        bookmarked: true,
      },
    });
    expect(storage.setPromptBookmark(beta.id, true)).toMatchObject({
      updated: true,
      usefulness: expect.objectContaining({ bookmarked: true }),
    });

    expect(storage.getPrompt(alpha.id)?.usefulness).toMatchObject({
      copied_count: 2,
      bookmarked: true,
    });
    expect(storage.listPrompts().items[1]).toMatchObject({
      id: alpha.id,
      usefulness: {
        copied_count: 2,
        bookmarked: true,
      },
    });
    expect(storage.getQualityDashboard().useful_prompts).toEqual([
      expect.objectContaining({
        id: alpha.id,
        copied_count: 2,
        bookmarked: true,
      }),
      expect.objectContaining({
        id: beta.id,
        copied_count: 0,
        bookmarked: true,
      }),
    ]);

    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    expect(storage.deletePrompt(alpha.id)).toEqual({ deleted: true });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM prompt_usage_events WHERE prompt_id = ?",
        )
        .get(alpha.id) as { count: number },
    ).toEqual({ count: 0 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM prompt_bookmarks WHERE prompt_id = ?",
        )
        .get(alpha.id) as { count: number },
    ).toEqual({ count: 0 });
    db.close();
  });

  it("detects exact duplicate prompt groups without returning prompt bodies", async () => {
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
    const repeatedPrompt =
      "Refactor duplicate prompt flow. 검증 기준: pnpm test. 출력 형식: 요약.";
    const first = await storeClaudePrompt(storage, {
      prompt: repeatedPrompt,
      receivedAt: "2026-05-01T10:00:00.000Z",
      cwd: "/Users/example/project-a",
    });
    const second = await storeClaudePrompt(storage, {
      prompt: repeatedPrompt,
      receivedAt: "2026-05-01T10:01:00.000Z",
      cwd: "/Users/example/project-b",
    });
    await storeClaudePrompt(storage, {
      prompt: "A unique prompt",
      receivedAt: "2026-05-01T10:02:00.000Z",
      cwd: "/Users/example/project-c",
    });

    expect(storage.getPrompt(first.id)?.duplicate_count).toBe(2);
    expect(
      storage.listPrompts().items.find((item) => item.id === second.id),
    ).toMatchObject({ duplicate_count: 2 });

    const groups = storage.getQualityDashboard().duplicate_prompt_groups;
    expect(groups).toEqual([
      expect.objectContaining({
        count: 2,
        latest_received_at: "2026-05-01T10:01:00.000Z",
        projects: ["/Users/example/project-a", "/Users/example/project-b"],
        prompts: expect.arrayContaining([
          expect.objectContaining({ id: first.id }),
          expect.objectContaining({ id: second.id }),
        ]),
      }),
    ]);
    expect(JSON.stringify(groups)).not.toContain(repeatedPrompt);

    expect(storage.deletePrompt(first.id)).toEqual({ deleted: true });
    expect(storage.getPrompt(second.id)?.duplicate_count).toBe(0);
    expect(storage.getQualityDashboard().duplicate_prompt_groups).toEqual([]);
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
        .listPrompts({
          receivedFrom: "2026-05-01",
          receivedTo: "2026-05-01",
        })
        .items.map((item) => item.received_at),
    ).toEqual([
      "2026-05-01T10:02:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:00:00.000Z",
    ]);
    expect(
      storage
        .searchPrompts("secret", { isSensitive: true })
        .items.map((item) => item.id),
    ).toEqual([sensitive.id]);
  });

  it("filters prompt lists and searches by saved, reused, duplicated, and quality-gap focus", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T10:01:00.000Z",
        "2026-05-01T10:02:00.000Z",
        "2026-05-01T10:03:00.000Z",
        "2026-05-01T10:04:00.000Z",
      ]),
    });
    const duplicatePrompt =
      "Refactor focus filter. 검증 기준: pnpm test. 출력 형식: 요약.";
    const duplicateA = await storeClaudePrompt(storage, {
      prompt: duplicatePrompt,
      receivedAt: "2026-05-01T10:00:00.000Z",
    });
    const duplicateB = await storeClaudePrompt(storage, {
      prompt: duplicatePrompt,
      receivedAt: "2026-05-01T10:01:00.000Z",
    });
    const saved = await storeClaudePrompt(storage, {
      prompt: "Saved prompt with 검증 기준: pnpm test.",
      receivedAt: "2026-05-01T10:02:00.000Z",
    });
    const qualityGap = await storeClaudePrompt(storage, {
      prompt: "vague request",
      receivedAt: "2026-05-01T10:03:00.000Z",
    });
    const copied = await storeClaudePrompt(storage, {
      prompt: "Copied prompt with 검증 기준: pnpm test.",
      receivedAt: "2026-05-01T10:04:00.000Z",
    });
    storage.setPromptBookmark(saved.id, true);
    storage.recordPromptUsage(copied.id, "prompt_copied");

    expect(storage.listPrompts({ focus: "saved" }).items).toMatchObject([
      { id: saved.id },
    ]);
    expect(
      storage.listPrompts({ focus: "reused" }).items.map((item) => item.id),
    ).toEqual([copied.id, saved.id]);
    expect(
      storage
        .searchPrompts("Copied", { focus: "reused" })
        .items.map((item) => item.id),
    ).toEqual([copied.id]);
    expect(
      storage.listPrompts({ focus: "duplicated" }).items.map((item) => item.id),
    ).toEqual([duplicateB.id, duplicateA.id]);
    expect(
      storage
        .searchPrompts("Refactor", { focus: "duplicated" })
        .items.map((item) => item.id),
    ).toEqual(expect.arrayContaining([duplicateA.id, duplicateB.id]));
    expect(
      storage
        .listPrompts({ focus: "quality-gap" })
        .items.map((item) => item.id),
    ).toContain(qualityGap.id);
    expect(
      storage
        .listPrompts({ qualityGap: "verification_criteria" })
        .items.map((item) => item.id),
    ).toContain(qualityGap.id);
    expect(
      storage
        .listPrompts({ qualityGap: "output_format" })
        .items.map((item) => item.id),
    ).toEqual([copied.id, qualityGap.id, saved.id]);
    expect(
      storage
        .searchPrompts("vague", { qualityGap: "verification_criteria" })
        .items.map((item) => item.id),
    ).toEqual([qualityGap.id]);
    expect(
      storage
        .searchPrompts("Refactor", { qualityGap: "verification_criteria" })
      .items.map((item) => item.id),
    ).toEqual([]);
  });

  it("stores project policies with raw-free audit events and browser-safe project summaries", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-02T09:00:00.000Z",
        "2026-05-02T09:01:00.000Z",
        "2026-05-02T09:02:00.000Z",
      ]),
    });

    await storeClaudePrompt(storage, {
      prompt: "Review backend test coverage with token sk-proj-1234567890abcdef",
      receivedAt: "2026-05-02T09:00:00.000Z",
      cwd: "/Users/example/private-project",
    });
    const useful = await storeClaudePrompt(storage, {
      prompt: "Update docs and run pnpm test. Return Markdown summary.",
      receivedAt: "2026-05-02T09:01:00.000Z",
      cwd: "/Users/example/private-project",
    });
    storage.recordPromptUsage(useful.id, "prompt_copied");
    storage.setPromptBookmark(useful.id, true);

    const initial = storage.listProjects().items[0]!;
    expect(initial).toMatchObject({
      label: "private-project",
      alias: undefined,
      path_kind: "cwd",
      prompt_count: 2,
      latest_ingest: "2026-05-02T09:01:00.000Z",
      sensitive_count: 1,
      copied_count: 1,
      bookmarked_count: 1,
      policy: {
        capture_disabled: false,
        analysis_disabled: false,
        export_disabled: false,
        external_analysis_opt_in: false,
        version: 1,
      },
    });
    expect(JSON.stringify(initial)).not.toContain("/Users/example/private-project");
    expect(JSON.stringify(initial)).not.toContain("sk-proj-1234567890abcdef");

    const updated = storage.updateProjectPolicy(
      initial.project_id,
      { alias: "client-a", capture_disabled: true },
      "web",
    );

    expect(updated).toMatchObject({
      project_id: initial.project_id,
      label: "client-a",
      alias: "client-a",
      policy: {
        capture_disabled: true,
        version: 2,
      },
    });
    expect(
      storage.getProjectPolicyForEvent({
        cwd: "/Users/example/private-project",
      }),
    ).toMatchObject({
      capture_disabled: true,
      version: 2,
    });

    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    const auditRows = db.prepare("SELECT * FROM policy_audit_events").all();
    db.close();

    expect(auditRows).toHaveLength(1);
    expect(JSON.stringify(auditRows)).toContain("capture_disabled");
    expect(JSON.stringify(auditRows)).not.toContain("/Users/example/private-project");
    expect(JSON.stringify(auditRows)).not.toContain("sk-proj-1234567890abcdef");
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
