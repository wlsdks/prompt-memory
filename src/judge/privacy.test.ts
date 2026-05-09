import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { initializePromptCoach } from "../config/config.js";
import { redactPrompt } from "../redaction/redact.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import { createJudgeWorker } from "./judge-worker.js";
import type { JudgeOutcome } from "./auto-judge.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("auto-judge privacy boundary", () => {
  it("never delivers a raw secret to the judge subprocess and never stores it on judge_score", async () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-04T10:00:00.000Z"),
    });
    const rawSecret = "sk-proj-1234567890abcdef";
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-privacy",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: `Run handler with token ${rawSecret} please`,
      },
      new Date("2026-05-04T09:59:00.000Z"),
    );

    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });

    let observedJudgeInput: string | undefined;
    const worker = createJudgeWorker({
      storage,
      getSettings: () => ({
        enabled: true,
        tool: "claude",
        daily_limit: 50,
        per_minute_limit: 5,
      }),
      runJudge: ({ redactedPrompt }): JudgeOutcome => {
        observedJudgeInput = redactedPrompt;
        return {
          kind: "ok",
          score: 80,
          reason: `Looks fine; saw ${rawSecret} echoed in your prompt.`,
        };
      },
    });

    const result = await worker.runOnce();
    expect(result).toMatchObject({ judged: 1, reason: "completed" });

    expect(observedJudgeInput).toBeDefined();
    expect(observedJudgeInput).toContain("[REDACTED:api_key]");
    expect(observedJudgeInput).not.toContain(rawSecret);

    const recorded = storage.getLatestJudgeScore(stored.id);
    expect(recorded).toBeDefined();
    expect(recorded?.reason).toContain("[REDACTED:api_key]");
    expect(recorded?.reason).not.toContain(rawSecret);

    storage.close();
  });

  it("does not record any judge_score when the judge subprocess is skipped", async () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-04T10:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-skip",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Plain prompt",
      },
      new Date("2026-05-04T09:59:00.000Z"),
    );
    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });

    const worker = createJudgeWorker({
      storage,
      getSettings: () => ({
        enabled: true,
        tool: "claude",
        daily_limit: 50,
        per_minute_limit: 5,
      }),
      runJudge: (): JudgeOutcome => ({
        kind: "skipped",
        reason: "cli_missing",
      }),
    });

    const result = await worker.runOnce();
    expect(result).toMatchObject({ judged: 0, skipped: 1 });
    expect(storage.getLatestJudgeScore(stored.id)).toBeUndefined();
    storage.close();
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-judge-privacy-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
