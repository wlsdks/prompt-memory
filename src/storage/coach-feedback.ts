import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type CoachFeedbackRating = "helpful" | "not_helpful" | "wrong";

export type CoachFeedbackEntry = {
  id: string;
  prompt_id: string;
  rating: CoachFeedbackRating;
  created_at: string;
};

export type CoachFeedbackSummary = {
  total: number;
  helpful: number;
  not_helpful: number;
  wrong: number;
  helpful_ratio: number;
};

export function applyCoachFeedbackMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(12);

  db.exec(`
    CREATE TABLE IF NOT EXISTS coach_feedback (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      rating TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_coach_feedback_prompt_id
      ON coach_feedback(prompt_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_coach_feedback_rating_created
      ON coach_feedback(rating, created_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(12, "012_coach_feedback", new Date().toISOString());
  }
}

export function recordCoachFeedback(
  db: Database.Database,
  promptId: string,
  rating: CoachFeedbackRating,
  now: Date,
): CoachFeedbackEntry | undefined {
  const livePrompt = db
    .prepare("SELECT 1 FROM prompts WHERE id = ? AND deleted_at IS NULL")
    .get(promptId);
  if (!livePrompt) {
    return undefined;
  }

  const entry: CoachFeedbackEntry = {
    id: createCoachFeedbackId(),
    prompt_id: promptId,
    rating,
    created_at: now.toISOString(),
  };

  db.prepare(
    `
    INSERT INTO coach_feedback(id, prompt_id, rating, created_at)
    VALUES (?, ?, ?, ?)
    `,
  ).run(entry.id, entry.prompt_id, entry.rating, entry.created_at);

  return entry;
}

export function getCoachFeedbackSummary(
  db: Database.Database,
): CoachFeedbackSummary {
  const row = db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN rating = 'helpful' THEN 1 ELSE 0 END) AS helpful,
        SUM(CASE WHEN rating = 'not_helpful' THEN 1 ELSE 0 END) AS not_helpful,
        SUM(CASE WHEN rating = 'wrong' THEN 1 ELSE 0 END) AS wrong
      FROM coach_feedback
      `,
    )
    .get() as {
    total: number | null;
    helpful: number | null;
    not_helpful: number | null;
    wrong: number | null;
  };

  const total = row.total ?? 0;
  const helpful = row.helpful ?? 0;

  return {
    total,
    helpful,
    not_helpful: row.not_helpful ?? 0,
    wrong: row.wrong ?? 0,
    helpful_ratio: total > 0 ? Number((helpful / total).toFixed(4)) : 0,
  };
}

function createCoachFeedbackId(): string {
  return `cfb_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}
