import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { initializePromptCoach } from "../config/config.js";
import { redactPrompt } from "../redaction/redact.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import { recordClarificationsTool } from "./record-clarifications-tool.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-record-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

async function seedPrompt(
  dataDir: string,
  text: string,
  receivedAt = "2026-05-05T12:00:00.000Z",
): Promise<string> {
  const init = initializePromptCoach({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: init.hookAuth.web_session_secret,
  });
  try {
    const event = normalizeClaudeCodePayload(
      {
        session_id: `session-${receivedAt}`,
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: text,
      },
      new Date(receivedAt),
    );
    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    return stored.id;
  } finally {
    storage.close();
  }
}

describe("recordClarificationsTool", () => {
  it("rejects invalid input shapes", () => {
    expect(
      recordClarificationsTool({ prompt_id: "", answers: [] } as never),
    ).toMatchObject({ is_error: true, error_code: "invalid_input" });

    const result = recordClarificationsTool({
      prompt_id: "abc",
      answers: [
        {
          question_id: "q_goal_clarity",
          axis: "goal_clarity",
          answer: "fix it",
          origin: "agent" as never,
        },
      ],
    });
    expect("is_error" in result && result.is_error).toBe(true);
    if ("is_error" in result) expect(result.message).toContain("origin");
  });

  it("returns not_found when the prompt id is missing from the archive", () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });
    const result = recordClarificationsTool(
      {
        prompt_id: "does-not-exist",
        answers: [
          {
            question_id: "q_goal_clarity",
            axis: "goal_clarity",
            answer: "Fix the delete API bug.",
            origin: "user",
          },
        ],
      },
      { dataDir },
    );
    expect("is_error" in result && result.is_error).toBe(true);
    if ("is_error" in result) expect(result.error_code).toBe("not_found");
  });

  it("composes the draft, persists it, and returns metadata only", async () => {
    const dataDir = createTempDir();
    const promptId = await seedPrompt(dataDir, "Make this better");

    const result = recordClarificationsTool(
      {
        prompt_id: promptId,
        language: "en",
        answers: [
          {
            question_id: "q_goal_clarity",
            axis: "goal_clarity",
            answer: "Fix the delete API bug in src/server/routes/prompts.ts.",
            origin: "user",
          },
          {
            question_id: "q_verification_criteria",
            axis: "verification_criteria",
            answer: "Run pnpm test and confirm 0 failures.",
            origin: "user",
          },
        ],
      },
      { dataDir },
    );

    if ("is_error" in result) {
      throw new Error(`expected success: ${result.message}`);
    }
    expect(result.prompt_id).toBe(promptId);
    expect(result.answers_count).toBe(2);
    expect(result.draft_id).toBeTruthy();
    expect(result.analyzer).toBe("clarifications-v1");
    expect(result.privacy.stores_input).toBe(true);

    // Body must not be echoed in the response.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Make this better");
    expect(serialized).not.toContain("Fix the delete API bug");

    // The draft is actually persisted.
    const init = initializePromptCoach({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
    });
    try {
      const detail = storage.getPrompt(promptId);
      expect(detail?.improvement_drafts.length).toBeGreaterThan(0);
      const drafts = detail?.improvement_drafts ?? [];
      const recorded = drafts.find((draft) => draft.id === result.draft_id);
      expect(recorded?.draft_text).toContain("delete API");
      expect(recorded?.draft_text).toContain("pnpm test");
    } finally {
      storage.close();
    }
  });
});
