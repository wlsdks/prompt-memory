import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import type {
  AgentPromptJudgment,
  CreateAgentPromptJudgmentInput,
} from "./ports.js";
import { readStringArray } from "./sqlite-json.js";
import type { AgentPromptJudgmentRow } from "./sqlite-rows.js";

export function applyAgentPromptJudgmentMigration(
  db: Database.Database,
): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(11);

  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_prompt_judgments (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      judge_model TEXT,
      score INTEGER NOT NULL,
      confidence REAL NOT NULL,
      summary TEXT NOT NULL,
      strengths_json TEXT,
      risks_json TEXT,
      suggestions_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_prompt_judgments_prompt_id
      ON agent_prompt_judgments(prompt_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_prompt_judgments_provider_created
      ON agent_prompt_judgments(provider, created_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(11, "011_agent_prompt_judgments", new Date().toISOString());
  }
}

export function createAgentPromptJudgment(
  db: Database.Database,
  promptId: string,
  input: CreateAgentPromptJudgmentInput,
  now: Date,
): AgentPromptJudgment | undefined {
  if (!hasLivePrompt(db, promptId)) {
    return undefined;
  }

  const createdAt = now.toISOString();
  const judgment: AgentPromptJudgment = {
    id: createAgentPromptJudgmentId(),
    prompt_id: promptId,
    provider: input.provider,
    judge_model: input.judge_model,
    score: Math.round(input.score),
    confidence: input.confidence,
    summary: input.summary,
    strengths: input.strengths ?? [],
    risks: input.risks ?? [],
    suggestions: input.suggestions ?? [],
    created_at: createdAt,
  };

  db.prepare(
    `
    INSERT INTO agent_prompt_judgments(
      id, prompt_id, provider, judge_model, score, confidence, summary,
      strengths_json, risks_json, suggestions_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    judgment.id,
    judgment.prompt_id,
    judgment.provider,
    judgment.judge_model ?? null,
    judgment.score,
    judgment.confidence,
    judgment.summary,
    JSON.stringify(judgment.strengths),
    JSON.stringify(judgment.risks),
    JSON.stringify(judgment.suggestions),
    judgment.created_at,
  );

  return judgment;
}

export function listAgentPromptJudgments(
  db: Database.Database,
  promptId: string,
): AgentPromptJudgment[] {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM agent_prompt_judgments
      WHERE prompt_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 20
      `,
    )
    .all(promptId) as AgentPromptJudgmentRow[];

  return rows.map((row) => ({
    id: row.id,
    prompt_id: row.prompt_id,
    provider: row.provider as AgentPromptJudgment["provider"],
    judge_model: row.judge_model ?? undefined,
    score: row.score,
    confidence: row.confidence,
    summary: row.summary,
    strengths: readStringArray(row.strengths_json),
    risks: readStringArray(row.risks_json),
    suggestions: readStringArray(row.suggestions_json),
    created_at: row.created_at,
  }));
}

function createAgentPromptJudgmentId(): string {
  return `judge_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function hasLivePrompt(db: Database.Database, id: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM prompts WHERE id = ? AND deleted_at IS NULL")
      .get(id),
  );
}

