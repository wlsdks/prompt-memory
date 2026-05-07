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
import { normalizeCodexPayload } from "../adapters/codex.js";
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
      { version: 6, name: "006_import_jobs" },
      { version: 7, name: "007_prompt_improvement_drafts" },
      { version: 8, name: "008_export_jobs" },
      { version: 9, name: "009_dashboard_query_indexes" },
      { version: 10, name: "010_project_instruction_reviews" },
      { version: 11, name: "011_agent_prompt_judgments" },
      { version: 12, name: "012_coach_feedback" },
      { version: 13, name: "013_prompt_judge_scores" },
      { version: 14, name: "014_drop_dead_analysis_columns" },
      { version: 15, name: "015_prompt_ask_events" },
    ]);
    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    try {
      const indexes = db
        .prepare("PRAGMA index_list(prompts)")
        .all()
        .map((row) => (row as { name: string }).name);
      expect(indexes).toEqual(
        expect.arrayContaining([
          "idx_prompts_deleted_received",
          "idx_prompts_deleted_tool_received",
          "idx_prompts_deleted_sensitive",
          "idx_prompts_deleted_hash_received",
          "idx_prompts_deleted_cwd_received",
          "idx_prompts_deleted_project_root_received",
        ]),
      );
    } finally {
      db.close();
    }

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

  it("keeps Google API keys out of Markdown, SQLite rows, snippets, and FTS", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-01T10:35:00.000Z"),
    });
    const rawSecret = createFakeGoogleApiKey();
    const event = normalizeCodexPayload(
      {
        session_id: "session-google-key-regression",
        cwd: "/Users/example/project",
        hook_event_name: "UserPromptSubmit",
        prompt: `Run Gemini smoke with GEMINI_API_KEY=${rawSecret}`,
      },
      new Date("2026-05-01T10:34:59.000Z"),
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
    expect(storage.searchPromptIds("AIzaSy")).toEqual([]);
    expect(storage.searchPromptIds(rawSecret)).toEqual([]);
    expect(storage.searchPromptIds("REDACTED")).toEqual([stored.id]);
    expect(storage.listPrompts().items[0]).toMatchObject({
      id: stored.id,
      is_sensitive: true,
      snippet: expect.stringContaining("[REDACTED:api_key]"),
    });
    expect(JSON.stringify(storage.listPrompts().items)).not.toContain(
      rawSecret,
    );
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
      quality_score: {
        value: 90,
        max: 100,
        band: "excellent",
        breakdown: expect.arrayContaining([
          expect.objectContaining({
            key: "goal_clarity",
            weight: 25,
            earned: 25,
          }),
        ]),
      },
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
      prompt: "Make this better",
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
    ).toEqual(
      expect.arrayContaining(["Goal clarity", "Verification criteria"]),
    );

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
      prompt: "Fix this",
      receivedAt: "2026-05-01T10:00:00.000Z",
      cwd: "/Users/example/project-a",
    });
    const sensitive = await storeClaudePrompt(storage, {
      prompt: "Fix that token sk-proj-1234567890abcdef",
      receivedAt: "2026-05-02T10:00:00.000Z",
      cwd: "/Users/example/project-a",
    });
    const docs = await storeClaudePrompt(storage, {
      prompt:
        "Because README onboarding is incomplete, update docs/README.md only, return Markdown summary, and run pnpm test expecting pass.",
      receivedAt: "2026-05-03T10:00:00.000Z",
      cwd: "/Users/example/project-b",
    });
    storage.recordPromptUsage(docs.id, "prompt_copied");
    storage.recordPromptUsage(docs.id, "prompt_copied");
    storage.setPromptBookmark(docs.id, true);

    const dashboard = storage.getQualityDashboard();
    const serialized = JSON.stringify(dashboard);

    expect(dashboard.total_prompts).toBe(3);
    expect(dashboard.quality_score).toMatchObject({
      average: 45,
      band: "needs_work",
      scored_prompts: 3,
      max: 100,
    });
    expect(dashboard.recent.last_7_days).toBe(3);
    expect(dashboard.trend.daily).toEqual([
      {
        date: "2026-04-27",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        average_quality_score: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-04-28",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        average_quality_score: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-04-29",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        average_quality_score: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-04-30",
        prompt_count: 0,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        average_quality_score: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-05-01",
        prompt_count: 1,
        quality_gap_count: 1,
        quality_gap_rate: 1,
        average_quality_score: 0,
        sensitive_count: 0,
      },
      {
        date: "2026-05-02",
        prompt_count: 1,
        quality_gap_count: 1,
        quality_gap_rate: 1,
        average_quality_score: 35,
        sensitive_count: 1,
      },
      {
        date: "2026-05-03",
        prompt_count: 1,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        average_quality_score: 100,
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
        average_quality_score: 18,
        sensitive_count: 1,
        copied_count: 0,
        bookmarked_count: 0,
        top_gap: expect.objectContaining({
          key: "background_context",
          count: 2,
        }),
      }),
      expect.objectContaining({
        key: "/Users/example/project-b",
        label: "project-b",
        prompt_count: 1,
        quality_gap_count: 0,
        quality_gap_rate: 0,
        average_quality_score: 100,
        sensitive_count: 0,
        copied_count: 2,
        bookmarked_count: 1,
        top_gap: undefined,
      }),
    ]);
    expect(dashboard.instruction_suggestions.length).toBeGreaterThan(0);
    expect(serialized).not.toContain("Fix this");
    expect(serialized).not.toContain("Fix that");
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
    expect(serialized).not.toContain(
      "Because README onboarding is incomplete.",
    );
    expect(storage.getPrompt(sensitive.id)?.is_sensitive).toBe(true);
  });

  it("returns 30-day daily trend when getQualityDashboard is given trendDays=30", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-03T12:00:00.000Z"),
    });
    await storeClaudePrompt(storage, {
      prompt: "Make this better.",
      receivedAt: "2026-05-03T10:00:00.000Z",
    });

    const weekly = storage.getQualityDashboard();
    const monthly = storage.getQualityDashboard({ trendDays: 30 });

    expect(weekly.trend.daily).toHaveLength(7);
    expect(monthly.trend.daily).toHaveLength(30);
    expect(monthly.trend.daily[monthly.trend.daily.length - 1]?.date).toBe(
      "2026-05-03",
    );
  });

  it("clamps invalid trendDays to a sane range", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-03T12:00:00.000Z"),
    });

    expect(
      storage.getQualityDashboard({ trendDays: 0 }).trend.daily,
    ).toHaveLength(1);
    expect(
      storage.getQualityDashboard({ trendDays: 1000 }).trend.daily,
    ).toHaveLength(90);
    expect(
      storage.getQualityDashboard({ trendDays: Number.NaN }).trend.daily,
    ).toHaveLength(7);
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

    const rawSecret = createFakeGoogleApiKey();
    writeFileSync(
      row.markdown_path,
      `${readFileSync(row.markdown_path, "utf8")}\nleaked ${rawSecret}\n`,
    );

    const result = storage.rebuildIndex({ redactionMode: "mask" });

    expect(result.hashMismatches).toEqual([stored.id]);
    expect(storage.listPromptRows()[0]?.index_status).toBe("hash_mismatch");
    expect(storage.searchPromptIds("AIzaSy")).toEqual([]);
    expect(storage.getPrompt(stored.id)?.markdown).toContain(
      "[REDACTED:api_key]",
    );
    expect(storage.getPrompt(stored.id)?.markdown).not.toContain(rawSecret);
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
      "Refactor duplicate prompt flow. Verification criteria: pnpm test. Output format: summary.";
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
      "Refactor focus filter. Verification criteria: pnpm test. Output format: summary.";
    const duplicateA = await storeClaudePrompt(storage, {
      prompt: duplicatePrompt,
      receivedAt: "2026-05-01T10:00:00.000Z",
    });
    const duplicateB = await storeClaudePrompt(storage, {
      prompt: duplicatePrompt,
      receivedAt: "2026-05-01T10:01:00.000Z",
    });
    const saved = await storeClaudePrompt(storage, {
      prompt: "Saved prompt with Verification criteria: pnpm test.",
      receivedAt: "2026-05-01T10:02:00.000Z",
    });
    const qualityGap = await storeClaudePrompt(storage, {
      prompt: "vague request",
      receivedAt: "2026-05-01T10:03:00.000Z",
    });
    const copied = await storeClaudePrompt(storage, {
      prompt: "Copied prompt with Verification criteria: pnpm test.",
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
      prompt:
        "Review backend test coverage with token sk-proj-1234567890abcdef",
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
    expect(JSON.stringify(initial)).not.toContain(
      "/Users/example/private-project",
    );
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
    expect(JSON.stringify(auditRows)).not.toContain(
      "/Users/example/private-project",
    );
    expect(JSON.stringify(auditRows)).not.toContain("sk-proj-1234567890abcdef");
  });

  it("analyzes and stores project instruction files without returning bodies or raw paths", async () => {
    const dataDir = createTempDir();
    const projectDir = createTempDir();
    writeFileSync(
      join(projectDir, "AGENTS.md"),
      [
        "# Project",
        "prompt-memory is a local-first developer tool built with TypeScript and SQLite.",
        "Agents must plan in tasks/todo.md, avoid reverting user changes, commit, and push.",
        "Run pnpm test, pnpm lint, pnpm build, and Playwright E2E after UI changes.",
        "Never log secrets, prompt bodies, raw paths, tokens, stdout, or stderr leaks.",
        "Respond in Korean and report verification evidence in the final summary.",
      ].join("\n"),
    );
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate(["2026-05-03T00:10:00.000Z", "2026-05-03T00:11:00.000Z"]),
    });
    await storeClaudePrompt(storage, {
      prompt: "Update project instructions and run pnpm test.",
      receivedAt: "2026-05-03T00:10:00.000Z",
      cwd: projectDir,
    });

    const project = storage.listProjects().items[0]!;
    const review = storage.analyzeProjectInstructions(project.project_id);
    const updatedProject = storage.listProjects().items[0]!;

    expect(review).toMatchObject({
      generated_at: "2026-05-03T00:11:00.000Z",
      analyzer: "local-project-instructions-v1",
      files_found: 1,
      score: { value: 100, max: 100, band: "excellent" },
      files: [expect.objectContaining({ file_name: "AGENTS.md" })],
      privacy: {
        local_only: true,
        external_calls: false,
        stores_file_bodies: false,
        returns_file_bodies: false,
        returns_raw_paths: false,
      },
    });
    expect(updatedProject.instruction_review).toMatchObject({
      score: { value: 100, band: "excellent" },
      files_found: 1,
    });
    expect(JSON.stringify(review)).not.toContain(projectDir);
    expect(JSON.stringify(review)).not.toContain("local-first developer tool");
    expect(JSON.stringify(updatedProject)).not.toContain(projectDir);
  });

  it("stores import dry-run jobs without prompt bodies or raw source paths", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-02T10:00:00.000Z"),
    });

    const job = storage.createImportJob({
      source_type: "manual-jsonl",
      source_path_hash: "path_abcdef12",
      dry_run: true,
      status: "dry_run_completed",
      summary: {
        records_read: 2,
        prompt_candidates: 1,
        sensitive_prompt_count: 1,
        parse_errors: 0,
        samples: [
          {
            prompt_preview: "Review [REDACTED:api_key]",
            is_sensitive: true,
          },
        ],
      },
    });

    expect(job).toMatchObject({
      id: expect.stringMatching(/^imp_/),
      source_type: "manual-jsonl",
      source_path_hash: "path_abcdef12",
      dry_run: true,
      status: "dry_run_completed",
      started_at: "2026-05-02T10:00:00.000Z",
      completed_at: "2026-05-02T10:00:00.000Z",
      summary: {
        prompt_candidates: 1,
      },
    });
    expect(storage.getImportJob(job.id)).toEqual(job);
    expect(storage.listImportJobs().items).toEqual([job]);

    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    const rows = db.prepare("SELECT * FROM import_jobs").all();
    db.close();

    expect(JSON.stringify(rows)).not.toContain("/Users/example/project");
    expect(JSON.stringify(rows)).not.toContain("sk-proj-1234567890abcdef");
  });

  it("stores anonymized export preview jobs without raw prompt ids or paths", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-02T12:00:00.000Z"),
    });

    const job = storage.createExportJob({
      preset: "anonymized_review",
      status: "previewed",
      prompt_id_hashes: ["ph_abcdef123456"],
      project_policy_versions: { proj_abcdef123456: 1 },
      redaction_version: "mask-v1",
      counts: {
        prompt_count: 1,
        sensitive_count: 1,
        included_fields: [
          "masked_prompt",
          "tags",
          "quality_gaps",
          "tool",
          "coarse_date",
          "project_alias",
        ],
        excluded_fields: [
          "cwd",
          "project_root",
          "transcript_path",
          "raw_metadata",
          "stable_prompt_id",
          "exact_timestamp",
        ],
        residual_identifier_counts: { api_key: 1, path: 1 },
        small_set_warning: true,
      },
      expires_at: "2026-05-03T12:00:00.000Z",
    });

    expect(job).toMatchObject({
      id: expect.stringMatching(/^exp_/),
      preset: "anonymized_review",
      status: "previewed",
      prompt_id_hashes: ["ph_abcdef123456"],
      created_at: "2026-05-02T12:00:00.000Z",
      expires_at: "2026-05-03T12:00:00.000Z",
      counts: {
        prompt_count: 1,
        sensitive_count: 1,
        small_set_warning: true,
      },
    });
    expect(storage.getExportJob(job.id)).toEqual(job);

    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    const rows = db.prepare("SELECT * FROM export_jobs").all();
    db.close();

    expect(JSON.stringify(rows)).not.toContain("prmt_");
    expect(JSON.stringify(rows)).not.toContain("/Users/example/project");
    expect(JSON.stringify(rows)).not.toContain("sk-proj-1234567890abcdef");
  });

  it("stores redacted prompt improvement drafts and deletes them with prompts", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate(["2026-05-02T11:00:00.000Z", "2026-05-02T11:01:00.000Z"]),
    });
    const prompt = await storeClaudePrompt(storage, {
      prompt: "Fix this bug",
      receivedAt: "2026-05-02T11:00:00.000Z",
    });

    const draft = storage.createPromptImprovementDraft(prompt.id, {
      draft_text:
        "## Goal\nFix this bug with secret sk-proj-1234567890abcdef\n## Verification\nRun pnpm test",
      analyzer: "local-rules-v1",
      changed_sections: ["goal_clarity", "verification_criteria"],
      safety_notes: [
        "Sensitive content was represented only after mask redaction.",
      ],
      copied: true,
    });

    expect(draft).toMatchObject({
      id: expect.stringMatching(/^impdraft_/),
      prompt_id: prompt.id,
      draft_text: expect.stringContaining("[REDACTED:api_key]"),
      analyzer: "local-rules-v1",
      changed_sections: ["goal_clarity", "verification_criteria"],
      safety_notes: [
        "Sensitive content was represented only after mask redaction.",
      ],
      is_sensitive: true,
      redaction_policy: "mask",
      created_at: "2026-05-02T11:01:00.000Z",
      copied_at: "2026-05-02T11:01:00.000Z",
    });
    expect(JSON.stringify(draft)).not.toContain("sk-proj-1234567890abcdef");

    expect(storage.getPrompt(prompt.id)?.improvement_drafts).toEqual([draft]);

    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    const rowsBeforeDelete = db
      .prepare("SELECT * FROM prompt_improvement_drafts")
      .all();
    db.close();
    expect(JSON.stringify(rowsBeforeDelete)).not.toContain(
      "sk-proj-1234567890abcdef",
    );

    expect(storage.deletePrompt(prompt.id)).toEqual({ deleted: true });
    expect(storage.getPrompt(prompt.id)).toBeUndefined();

    const dbAfterDelete = new Database(join(dataDir, "prompt-memory.sqlite"));
    const rowsAfterDelete = dbAfterDelete
      .prepare("SELECT * FROM prompt_improvement_drafts")
      .all();
    dbAfterDelete.close();
    expect(rowsAfterDelete).toEqual([]);
  });

  it("stores agent prompt judgments without prompt bodies and deletes them with prompts", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate(["2026-05-03T18:00:00.000Z", "2026-05-03T18:01:00.000Z"]),
    });
    const prompt = await storeClaudePrompt(storage, {
      prompt: "Fix this with token sk-proj-1234567890abcdef",
      receivedAt: "2026-05-03T17:59:00.000Z",
    });

    const stored = storage.createAgentPromptJudgment(prompt.id, {
      provider: "codex",
      judge_model: "gpt-5.5",
      score: 48,
      confidence: 0.8,
      summary: "Goal is present, but scope and verification are missing.",
      strengths: ["Short enough to improve quickly."],
      risks: ["No files or verification command."],
      suggestions: ["Name files, constraints, and test command."],
    });

    expect(stored).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^judge_/),
        prompt_id: prompt.id,
        provider: "codex",
        judge_model: "gpt-5.5",
        score: 48,
        confidence: 0.8,
        created_at: "2026-05-03T18:01:00.000Z",
      }),
    );
    expect(storage.listAgentPromptJudgments(prompt.id)).toEqual([stored]);

    const db = new Database(join(dataDir, "prompt-memory.sqlite"));
    const rowsBeforeDelete = db
      .prepare("SELECT * FROM agent_prompt_judgments")
      .all();
    db.close();
    expect(JSON.stringify(rowsBeforeDelete)).not.toContain(
      "sk-proj-1234567890abcdef",
    );
    expect(JSON.stringify(rowsBeforeDelete)).not.toContain("Fix this");

    expect(storage.deletePrompt(prompt.id)).toEqual({ deleted: true });

    const dbAfterDelete = new Database(join(dataDir, "prompt-memory.sqlite"));
    const rowsAfterDelete = dbAfterDelete
      .prepare("SELECT * FROM agent_prompt_judgments")
      .all();
    dbAfterDelete.close();
    expect(rowsAfterDelete).toEqual([]);
  });

  it("records coach feedback per prompt and aggregates summary counts", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate(["2026-05-04T10:00:00.000Z", "2026-05-04T10:01:00.000Z"]),
    });
    const prompt = await storeClaudePrompt(storage, {
      prompt: "store first then rate",
      receivedAt: "2026-05-04T09:59:00.000Z",
    });

    const helpful = storage.recordCoachFeedback(prompt.id, "helpful");
    const wrong = storage.recordCoachFeedback(prompt.id, "wrong");
    const missingPrompt = storage.recordCoachFeedback(
      "prmt_does_not_exist",
      "helpful",
    );

    expect(helpful).toMatchObject({
      prompt_id: prompt.id,
      rating: "helpful",
    });
    expect(wrong).toMatchObject({
      prompt_id: prompt.id,
      rating: "wrong",
    });
    expect(missingPrompt).toBeUndefined();

    const summary = storage.getCoachFeedbackSummary();
    expect(summary).toMatchObject({
      total: 2,
      helpful: 1,
      not_helpful: 0,
      wrong: 1,
      helpful_ratio: 0.5,
    });

    storage.deletePrompt(prompt.id);
    expect(storage.getCoachFeedbackSummary().total).toBe(0);
    storage.close();
  });

  it("records and reads back judge scores per prompt and lists ones that need judging", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-04T10:00:00.000Z",
        "2026-05-04T10:01:00.000Z",
        "2026-05-04T10:02:00.000Z",
        "2026-05-04T10:03:00.000Z",
        "2026-05-04T10:04:00.000Z",
      ]),
    });
    const judged = await storeClaudePrompt(storage, {
      prompt: "first prompt to judge",
      receivedAt: "2026-05-04T09:55:00.000Z",
    });
    const unjudged = await storeClaudePrompt(storage, {
      prompt: "second prompt left unscored",
      receivedAt: "2026-05-04T09:56:00.000Z",
    });

    const recorded = storage.recordJudgeScore({
      promptId: judged.id,
      judgeTool: "claude",
      score: 78,
      reason: "Goal clear, verification weak.",
    });
    const updated = storage.recordJudgeScore({
      promptId: judged.id,
      judgeTool: "claude",
      score: 92,
      reason: "Verification added in retry.",
    });
    const missing = storage.recordJudgeScore({
      promptId: "prmt_does_not_exist",
      judgeTool: "claude",
      score: 50,
      reason: "ignored",
    });

    expect(recorded).toMatchObject({
      prompt_id: judged.id,
      judge_tool: "claude",
      score: 78,
    });
    expect(updated).toMatchObject({ score: 92 });
    expect(missing).toBeUndefined();

    const latest = storage.getLatestJudgeScore(judged.id);
    expect(latest).toMatchObject({ score: 92, judge_tool: "claude" });

    const pending = storage.listPromptIdsNeedingJudge(10);
    expect(pending).toContain(unjudged.id);
    expect(pending).not.toContain(judged.id);

    storage.deletePrompt(judged.id);
    expect(storage.getLatestJudgeScore(judged.id)).toBeUndefined();
    storage.close();
  });

  it("clamps judge scores into 0-100 and rounds floats", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-04T10:00:00.000Z",
        "2026-05-04T10:01:00.000Z",
        "2026-05-04T10:02:00.000Z",
        "2026-05-04T10:03:00.000Z",
      ]),
    });
    const prompt = await storeClaudePrompt(storage, {
      prompt: "prompt for clamp test",
      receivedAt: "2026-05-04T09:55:00.000Z",
    });

    storage.recordJudgeScore({
      promptId: prompt.id,
      judgeTool: "claude",
      score: 142,
      reason: "above range",
    });
    expect(storage.getLatestJudgeScore(prompt.id)?.score).toBe(100);

    storage.recordJudgeScore({
      promptId: prompt.id,
      judgeTool: "claude",
      score: -7,
      reason: "below range",
    });
    expect(storage.getLatestJudgeScore(prompt.id)?.score).toBe(0);

    storage.recordJudgeScore({
      promptId: prompt.id,
      judgeTool: "claude",
      score: 84.6,
      reason: "fractional",
    });
    expect(storage.getLatestJudgeScore(prompt.id)?.score).toBe(85);

    storage.close();
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

  it("records ask events and returns a 7-day summary", () => {
    const dataDir = createTempDir();
    const storage = createSqlitePromptStorage({
      dataDir,
      now: () => new Date("2026-05-05T00:00:00.000Z"),
    });

    const empty = storage.getAskEventSummary({ days: 7 });
    expect(empty.total_count).toBe(0);
    expect(empty.recent_count).toBe(0);
    expect(empty.average_score).toBe(0);

    storage.recordAskEvent({
      tool: "claude-code",
      score: 23,
      band: "weak",
      missing_axes: ["scope_limits", "verification_criteria"],
      language: "ko",
      prompt_length: 48,
      triggered_at: "2026-05-04T10:00:00.000Z",
    });
    storage.recordAskEvent({
      tool: "codex",
      score: 30,
      band: "weak",
      missing_axes: ["scope_limits"],
      language: "en",
      prompt_length: 65,
      triggered_at: "2026-05-04T11:00:00.000Z",
    });

    const summary = storage.getAskEventSummary({ days: 7 });
    expect(summary.total_count).toBe(2);
    expect(summary.recent_count).toBe(2);
    expect(summary.axis_counts.scope_limits).toBe(2);
    expect(summary.axis_counts.verification_criteria).toBe(1);
    expect(summary.average_score).toBe(27);
    expect(summary.last_triggered_at).toBe("2026-05-04T11:00:00.000Z");
  });

  it("uses the injected clock for the ask-event summary cutoff", () => {
    const dataDir = createTempDir();
    const storage = createSqlitePromptStorage({
      dataDir,
      now: () => new Date("2024-01-15T00:00:00.000Z"),
    });

    storage.recordAskEvent({
      tool: "claude-code",
      score: 30,
      band: "weak",
      missing_axes: ["scope_limits"],
      language: "ko",
      prompt_length: 50,
      triggered_at: "2024-01-10T00:00:00.000Z",
    });
    storage.recordAskEvent({
      tool: "claude-code",
      score: 20,
      band: "weak",
      missing_axes: ["verification_criteria"],
      language: "ko",
      prompt_length: 40,
      triggered_at: "2023-12-01T00:00:00.000Z",
    });

    const summary = storage.getAskEventSummary({ days: 7 });
    expect(summary.total_count).toBe(2);
    expect(summary.recent_count).toBe(1);
    expect(summary.axis_counts.scope_limits).toBe(1);
    expect(summary.axis_counts.verification_criteria).toBeUndefined();
    expect(summary.average_score).toBe(30);
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

function createFakeGoogleApiKey(): string {
  return ["AI", "za", "Sy", "A1234567890abcdefghijklmnopqrstuvwxyz"].join("");
}
