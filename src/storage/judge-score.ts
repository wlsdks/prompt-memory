import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type JudgeTool = "claude" | "codex";

export type JudgeScoreEntry = {
  id: string;
  prompt_id: string;
  judge_tool: JudgeTool;
  score: number;
  reason: string;
  created_at: string;
};

export function applyJudgeScoreMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(13);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_judge_scores (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      judge_tool TEXT NOT NULL,
      score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_judge_scores_prompt_id
      ON prompt_judge_scores(prompt_id, created_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(13, "013_prompt_judge_scores", new Date().toISOString());
  }
}

export function recordJudgeScore(
  db: Database.Database,
  input: {
    promptId: string;
    judgeTool: JudgeTool;
    score: number;
    reason: string;
    now: Date;
  },
): JudgeScoreEntry | undefined {
  const livePrompt = db
    .prepare("SELECT 1 FROM prompts WHERE id = ? AND deleted_at IS NULL")
    .get(input.promptId);
  if (!livePrompt) {
    return undefined;
  }

  const entry: JudgeScoreEntry = {
    id: createJudgeScoreId(),
    prompt_id: input.promptId,
    judge_tool: input.judgeTool,
    score: clampScore(input.score),
    reason: input.reason,
    created_at: input.now.toISOString(),
  };

  db.prepare(
    `
    INSERT INTO prompt_judge_scores
      (id, prompt_id, judge_tool, score, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(
    entry.id,
    entry.prompt_id,
    entry.judge_tool,
    entry.score,
    entry.reason,
    entry.created_at,
  );

  return entry;
}

export function getLatestJudgeScore(
  db: Database.Database,
  promptId: string,
): JudgeScoreEntry | undefined {
  const row = db
    .prepare(
      `
      SELECT id, prompt_id, judge_tool, score, reason, created_at
      FROM prompt_judge_scores
      WHERE prompt_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
    )
    .get(promptId) as
    | {
        id: string;
        prompt_id: string;
        judge_tool: string;
        score: number;
        reason: string;
        created_at: string;
      }
    | undefined;

  if (!row || !isJudgeTool(row.judge_tool)) {
    return undefined;
  }

  return {
    id: row.id,
    prompt_id: row.prompt_id,
    judge_tool: row.judge_tool,
    score: row.score,
    reason: row.reason,
    created_at: row.created_at,
  };
}

export function listPromptIdsNeedingJudge(
  db: Database.Database,
  options: { limit: number },
): string[] {
  const rows = db
    .prepare(
      `
      SELECT p.id AS id
      FROM prompts p
      LEFT JOIN prompt_judge_scores j
        ON j.prompt_id = p.id
      WHERE p.deleted_at IS NULL
        AND p.excluded_from_analysis = 0
        AND j.id IS NULL
      ORDER BY p.received_at DESC
      LIMIT ?
      `,
    )
    .all(options.limit) as Array<{ id: string }>;

  return rows.map((row) => row.id);
}

function createJudgeScoreId(): string {
  return `jdg_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

export function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

function isJudgeTool(value: string): value is JudgeTool {
  return value === "claude" || value === "codex";
}
