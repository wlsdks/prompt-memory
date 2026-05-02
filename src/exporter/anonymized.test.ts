import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { initializePromptMemory } from "../config/config.js";
import { redactPrompt } from "../redaction/redact.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import {
  createAnonymizedExportPreview,
  executeAnonymizedExport,
} from "./anonymized.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("anonymized export", () => {
  it("creates raw-free preview jobs and executes valid jobs with anonymized fields only", async () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const rawPath = "/Users/example/private-project/src/secret.ts";
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate([
        "2026-05-02T12:00:00.000Z",
        "2026-05-02T12:01:00.000Z",
        "2026-05-02T12:02:00.000Z",
      ]),
    });

    const first = await storeClaudePrompt(storage, {
      prompt: `Fix ${rawPath} using token ${rawSecret}. Run pnpm test.`,
      receivedAt: "2026-05-02T12:00:00.000Z",
      cwd: "/Users/example/private-project",
    });
    const deleted = await storeClaudePrompt(storage, {
      prompt: "This deleted prompt must not be exported.",
      receivedAt: "2026-05-02T12:01:00.000Z",
      cwd: "/Users/example/private-project",
    });
    storage.deletePrompt(deleted.id);

    const preview = createAnonymizedExportPreview(storage, {
      hmacSecret: "test-secret",
      preset: "anonymized_review",
      now: new Date("2026-05-02T12:02:00.000Z"),
    });
    const exported = executeAnonymizedExport(storage, preview.id, {
      hmacSecret: "test-secret",
      now: new Date("2026-05-02T12:03:00.000Z"),
    });

    expect(preview).toMatchObject({
      id: expect.stringMatching(/^exp_/),
      preset: "anonymized_review",
      status: "previewed",
      prompt_id_hashes: [expect.stringMatching(/^ph_/)],
      counts: {
        prompt_count: 1,
        sensitive_count: 1,
        small_set_warning: true,
      },
    });
    expect(JSON.stringify(preview)).not.toContain(first.id);
    expect(JSON.stringify(preview)).not.toContain(deleted.id);
    expect(JSON.stringify(preview)).not.toContain(rawSecret);
    expect(JSON.stringify(preview)).not.toContain("/Users/example");

    expect(exported).toMatchObject({
      job_id: preview.id,
      preset: "anonymized_review",
      count: 1,
      items: [
        {
          anonymous_id: expect.stringMatching(/^anon_/),
          tool: "claude-code",
          coarse_date: "2026-05-02",
          project_alias: "private-project",
        },
      ],
    });
    expect(exported.items[0]?.prompt).toContain("[REDACTED:api_key]");
    expect(exported.items[0]?.prompt).toContain("[REDACTED:path]");
    expect(JSON.stringify(exported)).not.toContain(first.id);
    expect(JSON.stringify(exported)).not.toContain(rawSecret);
    expect(JSON.stringify(exported)).not.toContain(rawPath);
    expect(JSON.stringify(exported)).not.toContain("/Users/example");
  });

  it("invalidates execution when a previewed prompt is deleted", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: nextDate(["2026-05-02T13:00:00.000Z", "2026-05-02T13:01:00.000Z"]),
    });

    const prompt = await storeClaudePrompt(storage, {
      prompt: "Export then delete this prompt.",
      receivedAt: "2026-05-02T13:00:00.000Z",
      cwd: "/Users/example/project",
    });
    const preview = createAnonymizedExportPreview(storage, {
      hmacSecret: "test-secret",
      preset: "personal_backup",
      now: new Date("2026-05-02T13:01:00.000Z"),
    });
    storage.deletePrompt(prompt.id);

    expect(() =>
      executeAnonymizedExport(storage, preview.id, {
        hmacSecret: "test-secret",
        now: new Date("2026-05-02T13:02:00.000Z"),
      }),
    ).toThrow("Export job is no longer valid");
    expect(storage.getExportJob(preview.id)?.status).toBe("invalid");
  });
});

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
  const dir = join(tmpdir(), `prompt-memory-export-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
