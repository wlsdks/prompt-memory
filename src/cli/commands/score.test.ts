import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptMemory } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { scoreArchiveForCli } from "./score.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("score CLI command", () => {
  it("prints a privacy-safe archive score report as JSON and text", async () => {
    const dataDir = createTempDir();
    const ids = await createScoreFixture(dataDir);

    const json = scoreArchiveForCli({
      dataDir,
      json: true,
      limit: 100,
      lowScoreLimit: 2,
    });
    const report = JSON.parse(json) as {
      archive_score: { average: number; scored_prompts: number };
      low_score_prompts: Array<{ id: string; project: string }>;
      next_prompt_template: string;
      practice_plan: Array<{ prompt_rule: string }>;
      privacy: { returns_prompt_bodies: boolean; returns_raw_paths: boolean };
    };

    expect(report.archive_score.scored_prompts).toBe(3);
    expect(report.archive_score.average).toBeLessThan(100);
    expect(report.practice_plan[0]?.prompt_rule).toBeTruthy();
    expect(report.next_prompt_template).toContain("Goal:");
    expect(report.low_score_prompts.map((prompt) => prompt.id)).toContain(
      ids.weak,
    );
    expect(report.low_score_prompts[0]?.project).toBe("private-project");
    expect(report.privacy).toMatchObject({
      returns_prompt_bodies: false,
      returns_raw_paths: false,
    });
    expect(json).not.toContain("Make this better");
    expect(json).not.toContain("/Users/example");

    const text = scoreArchiveForCli({ dataDir, lowScoreLimit: 1 });

    expect(text).toContain("Prompt archive score");
    expect(text).toContain("Practice plan");
    expect(text).toContain("Next prompt template");
    expect(text).toContain("Lowest scoring prompts");
    expect(text).toContain(ids.weak);
    expect(text).not.toContain("Make this better");
    expect(text).not.toContain("/Users/example");
  });
});

async function createScoreFixture(dataDir: string) {
  const init = initializePromptMemory({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: init.hookAuth.web_session_secret,
    now: nextDate([
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:02:00.000Z",
    ]),
  });

  try {
    const weak = await storeClaudePrompt(
      storage,
      "Make this better",
      "2026-05-01T10:00:00.000Z",
    );
    const strong = await storeClaudePrompt(
      storage,
      "Review src/analysis/archive-score.ts for pagination bugs, keep the change scoped to that file, run pnpm vitest run src/analysis/archive-score.test.ts, and return a Markdown summary with risks.",
      "2026-05-01T10:01:00.000Z",
    );
    const medium = await storeClaudePrompt(
      storage,
      "Fix the dashboard copy and return a summary.",
      "2026-05-01T10:02:00.000Z",
    );

    return {
      medium: medium.id,
      strong: strong.id,
      weak: weak.id,
    };
  } finally {
    storage.close();
  }
}

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  prompt: string,
  receivedAt: string,
) {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${receivedAt}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd: "/Users/example/private-project",
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt,
    },
    new Date(receivedAt),
  );

  return storage.storePrompt({
    event,
    redaction: redactPrompt(event.prompt, "mask"),
  });
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-score-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function nextDate(values: string[]): () => Date {
  let index = 0;

  return () => new Date(values[index++] ?? values.at(-1)!);
}
