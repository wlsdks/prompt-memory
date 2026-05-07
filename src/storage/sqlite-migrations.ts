import type Database from "better-sqlite3";

import { applyAgentPromptJudgmentMigration } from "./agent-judgments.js";
import { applyCoachFeedbackMigration } from "./coach-feedback.js";
import { applyJudgeScoreMigration } from "./judge-score.js";

export function applyMigrations(db: Database.Database): void {
  db.exec(INITIAL_DDL);

  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(1);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(1, "001_initial", new Date().toISOString());
  }

  applyAnalysisChecklistTagsMigration(db);
  applyPromptUsefulnessMigration(db);
  applyDuplicatePromptIndexMigration(db);
  applyProjectPolicyMigration(db);
  applyImportJobMigration(db);
  applyPromptImprovementDraftMigration(db);
  applyExportJobMigration(db);
  applyDashboardQueryIndexMigration(db);
  applyProjectInstructionReviewMigration(db);
  applyAgentPromptJudgmentMigration(db);
  applyCoachFeedbackMigration(db);
  applyJudgeScoreMigration(db);
  applyDropDeadAnalysisColumnsMigration(db);
  applyAskEventMigration(db);
}

function applyAskEventMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(15);
  if (applied) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_ask_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool TEXT NOT NULL,
      score INTEGER NOT NULL,
      band TEXT NOT NULL,
      missing_axes_json TEXT NOT NULL,
      language TEXT,
      prompt_length INTEGER NOT NULL,
      triggered_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prompt_ask_events_triggered_at
      ON prompt_ask_events(triggered_at DESC);
  `);

  db.prepare(
    "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
  ).run(15, "015_prompt_ask_events", new Date().toISOString());
}

function applyDropDeadAnalysisColumnsMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(14);

  if (hasColumn(db, "prompt_analyses", "summary")) {
    db.prepare("ALTER TABLE prompt_analyses DROP COLUMN summary").run();
  }
  if (hasColumn(db, "prompt_analyses", "suggestions_json")) {
    db.prepare(
      "ALTER TABLE prompt_analyses DROP COLUMN suggestions_json",
    ).run();
  }

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(14, "014_drop_dead_analysis_columns", new Date().toISOString());
  }
}

function applyAnalysisChecklistTagsMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(2);

  if (!hasColumn(db, "prompt_analyses", "checklist_json")) {
    db.prepare(
      "ALTER TABLE prompt_analyses ADD COLUMN checklist_json TEXT",
    ).run();
  }

  if (!hasColumn(db, "prompt_analyses", "tags_json")) {
    db.prepare("ALTER TABLE prompt_analyses ADD COLUMN tags_json TEXT").run();
  }

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(2, "002_analysis_checklist_tags", new Date().toISOString());
  }
}

function applyPromptUsefulnessMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(3);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_usage_events (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_bookmarks (
      prompt_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_usage_events_prompt_id
      ON prompt_usage_events(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_usage_events_type_created_at
      ON prompt_usage_events(event_type, created_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(3, "003_prompt_usefulness", new Date().toISOString());
  }
}

function applyDuplicatePromptIndexMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(4);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompts_stored_content_hash
      ON prompts(stored_content_hash);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(4, "004_duplicate_prompt_index", new Date().toISOString());
  }
}

function applyProjectPolicyMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(5);

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_policies (
      project_key TEXT PRIMARY KEY,
      display_alias TEXT,
      capture_disabled INTEGER NOT NULL DEFAULT 0,
      analysis_disabled INTEGER NOT NULL DEFAULT 0,
      retention_candidate_days INTEGER,
      external_analysis_opt_in INTEGER NOT NULL DEFAULT 0,
      export_disabled INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policy_audit_events (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL,
      changed_fields_json TEXT NOT NULL,
      previous_policy_hash TEXT NOT NULL,
      next_policy_hash TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_policy_audit_events_project_key
      ON policy_audit_events(project_key, created_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(5, "005_project_policies", new Date().toISOString());
  }
}

function applyImportJobMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(6);

  db.exec(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_path_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      dry_run INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      project_policy_version INTEGER,
      summary_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_records (
      job_id TEXT NOT NULL,
      record_key TEXT NOT NULL,
      record_offset INTEGER,
      status TEXT NOT NULL,
      prompt_id TEXT,
      error_code TEXT,
      PRIMARY KEY(job_id, record_key),
      FOREIGN KEY(job_id) REFERENCES import_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS import_errors (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      error_code TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_import_jobs_started_at
      ON import_jobs(started_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(6, "006_import_jobs", new Date().toISOString());
  }
}

function applyPromptImprovementDraftMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(7);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_improvement_drafts (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      draft_text TEXT NOT NULL,
      analyzer TEXT NOT NULL,
      changed_sections_json TEXT,
      safety_notes_json TEXT,
      is_sensitive INTEGER NOT NULL DEFAULT 0,
      redaction_policy TEXT NOT NULL DEFAULT 'mask',
      created_at TEXT NOT NULL,
      copied_at TEXT,
      accepted_at TEXT,
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_improvement_drafts_prompt_id
      ON prompt_improvement_drafts(prompt_id, created_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(7, "007_prompt_improvement_drafts", new Date().toISOString());
  }
}

function applyExportJobMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(8);

  db.exec(`
    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      preset TEXT NOT NULL,
      status TEXT NOT NULL,
      prompt_id_hashes_json TEXT NOT NULL,
      project_policy_versions_json TEXT NOT NULL,
      redaction_version TEXT NOT NULL,
      counts_json TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at
      ON export_jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at
      ON export_jobs(expires_at);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(8, "008_export_jobs", new Date().toISOString());
  }
}

function applyDashboardQueryIndexMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(9);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompts_deleted_received
      ON prompts(deleted_at, received_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_prompts_deleted_tool_received
      ON prompts(deleted_at, tool, received_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_prompts_deleted_sensitive
      ON prompts(deleted_at, is_sensitive);
    CREATE INDEX IF NOT EXISTS idx_prompts_deleted_hash_received
      ON prompts(deleted_at, stored_content_hash, received_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_prompts_deleted_cwd_received
      ON prompts(deleted_at, cwd, received_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_prompts_deleted_project_root_received
      ON prompts(deleted_at, project_root, received_at DESC, id DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(9, "009_dashboard_query_indexes", new Date().toISOString());
  }
}

function applyProjectInstructionReviewMigration(db: Database.Database): void {
  const applied = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
    .get(10);

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_instruction_reviews (
      project_key TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      analyzer TEXT NOT NULL,
      score INTEGER NOT NULL,
      score_band TEXT NOT NULL,
      files_found INTEGER NOT NULL,
      files_json TEXT NOT NULL,
      checklist_json TEXT NOT NULL,
      suggestions_json TEXT NOT NULL,
      privacy_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_instruction_reviews_generated_at
      ON project_instruction_reviews(generated_at DESC);
  `);

  if (!applied) {
    db.prepare(
      "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)",
    ).run(10, "010_project_instruction_reviews", new Date().toISOString());
  }
}

function hasColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

const INITIAL_DDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  repo_url TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(root_path)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  project_id TEXT,
  transcript_path TEXT,
  started_at TEXT,
  ended_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  stored_content_hash TEXT NOT NULL,
  raw_content_hash TEXT,
  tool TEXT NOT NULL,
  source_event TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  transcript_path TEXT,
  cwd TEXT NOT NULL,
  project_root TEXT,
  git_branch TEXT,
  model TEXT,
  permission_mode TEXT,
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  markdown_path TEXT NOT NULL,
  markdown_schema_version INTEGER NOT NULL,
  markdown_mtime INTEGER,
  markdown_size INTEGER,
  prompt_length INTEGER NOT NULL,
  is_sensitive INTEGER NOT NULL DEFAULT 0,
  excluded_from_analysis INTEGER NOT NULL DEFAULT 0,
  redaction_policy TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  raw_event_hash TEXT,
  raw_metadata_json TEXT,
  index_status TEXT NOT NULL DEFAULT 'indexed',
  deleted_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS prompt_analyses (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  warnings_json TEXT,
  checklist_json TEXT,
  tags_json TEXT,
  analyzer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY(prompt_id, tag_id),
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prompt_usage_events (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prompt_bookmarks (
  prompt_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS redaction_events (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  detector_type TEXT NOT NULL,
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS prompt_fts USING fts5(
  prompt_id UNINDEXED,
  body,
  snippet,
  project_name,
  tags
);

CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_tool ON prompts(tool);
CREATE INDEX IF NOT EXISTS idx_prompts_project_id ON prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompts_session_id ON prompts(session_id);
CREATE INDEX IF NOT EXISTS idx_prompts_index_status ON prompts(index_status);
CREATE INDEX IF NOT EXISTS idx_prompts_stored_content_hash
  ON prompts(stored_content_hash);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_received
  ON prompts(deleted_at, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_tool_received
  ON prompts(deleted_at, tool, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_sensitive
  ON prompts(deleted_at, is_sensitive);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_hash_received
  ON prompts(deleted_at, stored_content_hash, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_cwd_received
  ON prompts(deleted_at, cwd, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted_project_root_received
  ON prompts(deleted_at, project_root, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_events_prompt_id
  ON prompt_usage_events(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_events_type_created_at
  ON prompt_usage_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_judgments_prompt_id
  ON agent_prompt_judgments(prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_judgments_provider_created
  ON agent_prompt_judgments(provider, created_at DESC);
`;
