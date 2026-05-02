import Database from "better-sqlite3";
import { createHmac, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

import { analyzePrompt } from "../analysis/analyze.js";
import { redactPrompt } from "../redaction/redact.js";
import { createPromptId } from "../shared/ids.js";
import { createStoredContentHash } from "../shared/hashing.js";
import type {
  PromptAnalysisPreview,
  PromptQualityChecklistItem,
  PromptQualityCriterion,
  PromptTag,
  RedactionPolicy,
} from "../shared/schema.js";
import { getPromptMemoryPaths } from "./paths.js";
import type {
  CreateImportJobInput,
  CreatePromptImprovementDraftInput,
  DeletePromptResult,
  DuplicatePromptGroup,
  ImportJob,
  ImportJobListResult,
  ImportJobStoragePort,
  ListPromptsOptions,
  PromptDetail,
  ProjectListResult,
  ProjectPolicy,
  ProjectPolicyActor,
  ProjectPolicyPatch,
  ProjectPolicyStoragePort,
  ProjectSummary,
  PromptImprovementDraft,
  PromptListResult,
  PromptQualityDashboard,
  PromptReadStoragePort,
  PromptSummary,
  PromptStoragePort,
  PromptUsageEventType,
  PromptUsefulness,
  SearchPromptsOptions,
  StorePromptInput,
  StorePromptResult,
  UsefulPrompt,
} from "./ports.js";
import {
  parsePromptMarkdown,
  readPromptMarkdown,
  writePromptMarkdown,
} from "./markdown.js";

export type SqlitePromptStorageOptions = {
  dataDir: string;
  hmacSecret: string;
  now?: () => Date;
};

export type PromptRow = {
  id: string;
  idempotency_key: string;
  stored_content_hash: string;
  tool: string;
  source_event: string;
  session_id: string;
  cwd: string;
  created_at: string;
  received_at: string;
  markdown_path: string;
  markdown_schema_version: number;
  prompt_length: number;
  is_sensitive: number;
  excluded_from_analysis: number;
  redaction_policy: string;
  adapter_version: string;
  index_status: string;
};

type PromptAnalysisRow = {
  summary: string | null;
  warnings_json: string | null;
  suggestions_json: string | null;
  checklist_json: string | null;
  tags_json: string | null;
  analyzer: string;
  created_at: string;
};

type PromptQualityRow = {
  prompt_id: string;
  received_at: string;
  is_sensitive: number;
  cwd: string;
  project_root: string | null;
  checklist_json: string | null;
  tags_json: string | null;
};

type PromptUsefulnessRow = {
  copied_count: number;
  last_copied_at: string | null;
  bookmarked_at: string | null;
};

type UsefulPromptRow = PromptRow & PromptUsefulnessRow;

type ProjectPolicyRow = {
  project_key: string;
  display_alias: string | null;
  capture_disabled: number;
  analysis_disabled: number;
  retention_candidate_days: number | null;
  external_analysis_opt_in: number;
  export_disabled: number;
  version: number;
  updated_at: string;
};

type ProjectPromptRow = {
  id: string;
  cwd: string;
  project_root: string | null;
  received_at: string;
  is_sensitive: number;
  checklist_json: string | null;
  copied_count: number;
  bookmarked_count: number;
};

type ImportJobRow = {
  id: string;
  source_type: string;
  source_path_hash: string;
  dry_run: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  project_policy_version: number | null;
  summary_json: string;
};

type PromptImprovementDraftRow = {
  id: string;
  prompt_id: string;
  draft_text: string;
  analyzer: string;
  changed_sections_json: string | null;
  safety_notes_json: string | null;
  is_sensitive: number;
  redaction_policy: string;
  created_at: string;
  copied_at: string | null;
  accepted_at: string | null;
};

type RebuildPromptRow = {
  id: string;
  markdown_path: string;
  received_at: string;
};

export type AppliedMigration = {
  version: number;
  name: string;
};

export type SqlitePromptStorage = PromptStoragePort &
  PromptReadStoragePort &
  ProjectPolicyStoragePort &
  ImportJobStoragePort & {
    close(): void;
    getAppliedMigrations(): AppliedMigration[];
    listPromptRows(): PromptRow[];
    searchPromptIds(query: string): string[];
    rebuildIndex(options: { redactionMode: RedactionPolicy }): {
      rebuilt: string[];
      hashMismatches: string[];
    };
    reconcileStorage(): {
      missingFiles: string[];
    };
  };

export function createSqlitePromptStorage(
  options: SqlitePromptStorageOptions,
): SqlitePromptStorage {
  const paths = getPromptMemoryPaths(options.dataDir);
  mkdirSync(paths.dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(paths.promptsDir, { recursive: true, mode: 0o700 });

  const db = new Database(paths.databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);

  return {
    async storePrompt(input) {
      return storePrompt(db, paths.promptsDir, options, input);
    },
    close() {
      db.close();
    },
    getAppliedMigrations() {
      return db
        .prepare(
          "SELECT version, name FROM schema_migrations ORDER BY version ASC",
        )
        .all() as AppliedMigration[];
    },
    listPromptRows() {
      return db
        .prepare("SELECT * FROM prompts ORDER BY received_at DESC, id DESC")
        .all() as PromptRow[];
    },
    listPrompts(options) {
      return listPrompts(db, options);
    },
    searchPrompts(query, options) {
      return searchPrompts(db, query, options);
    },
    getPrompt(id) {
      return getPrompt(db, id);
    },
    deletePrompt(id) {
      return deletePrompt(db, id);
    },
    getQualityDashboard() {
      return getQualityDashboard(db, options.now?.() ?? new Date());
    },
    recordPromptUsage(id, type) {
      return recordPromptUsage(db, id, type, options.now?.() ?? new Date());
    },
    setPromptBookmark(id, bookmarked) {
      return setPromptBookmark(
        db,
        id,
        bookmarked,
        options.now?.() ?? new Date(),
      );
    },
    createPromptImprovementDraft(promptId, input) {
      return createPromptImprovementDraft(
        db,
        promptId,
        input,
        options.now?.() ?? new Date(),
      );
    },
    listProjects() {
      return listProjectsForPolicy(db, options.hmacSecret);
    },
    updateProjectPolicy(projectId, patch, actor) {
      return updateProjectPolicy(
        db,
        options.hmacSecret,
        projectId,
        patch,
        actor,
        options.now?.() ?? new Date(),
      );
    },
    getProjectPolicyForEvent(event) {
      return getProjectPolicyForEvent(db, options.hmacSecret, event);
    },
    createImportJob(input) {
      return createImportJob(db, input, options.now?.() ?? new Date());
    },
    getImportJob(id) {
      return getImportJob(db, id);
    },
    listImportJobs(options) {
      return listImportJobs(db, options);
    },
    searchPromptIds(query) {
      const match = toSafeFtsQuery(query);
      if (!match) {
        return [];
      }

      const rows = db
        .prepare(
          "SELECT prompt_id FROM prompt_fts WHERE prompt_fts MATCH ? ORDER BY rank",
        )
        .all(match) as Array<{ prompt_id: string }>;

      return rows.map((row) => row.prompt_id);
    },
    rebuildIndex(options) {
      return rebuildIndex(db, paths.promptsDir, options.redactionMode);
    },
    reconcileStorage() {
      return reconcileStorage(db);
    },
  };
}

function applyMigrations(db: Database.Database): void {
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

function storePrompt(
  db: Database.Database,
  promptsDir: string,
  options: SqlitePromptStorageOptions,
  input: StorePromptInput,
): StorePromptResult {
  const duplicate = db
    .prepare("SELECT id FROM prompts WHERE idempotency_key = ?")
    .get(input.event.idempotency_key) as { id: string } | undefined;

  if (duplicate) {
    return { id: duplicate.id, duplicate: true };
  }

  const now = options.now?.() ?? new Date();
  const id = createPromptId({ now });
  const markdownPath = createMarkdownPath(
    promptsDir,
    now,
    input.event.tool,
    id,
  );
  const storedContentHash = createStoredContentHash(
    input.redaction.stored_text,
    options.hmacSecret,
  );

  const frontmatter = {
    schema_version: 1,
    id,
    idempotency_key: input.event.idempotency_key,
    tool: input.event.tool,
    source_event: input.event.source_event,
    session_id: input.event.session_id,
    turn_id: input.event.turn_id ?? null,
    transcript_path: input.event.transcript_path ?? null,
    cwd: input.event.cwd,
    project_root: input.event.project_root ?? null,
    git_branch: input.event.git_branch ?? null,
    model: input.event.model ?? null,
    permission_mode: input.event.permission_mode ?? null,
    created_at: input.event.created_at,
    received_at: input.event.received_at,
    prompt_length: input.event.prompt.length,
    stored_content_hash: storedContentHash,
    redaction_policy: input.redaction.policy,
    adapter_version: input.event.adapter_version,
    is_sensitive: input.redaction.is_sensitive,
    excluded_from_analysis: false,
  };
  const markdown = writePromptMarkdown(
    markdownPath,
    frontmatter,
    input.redaction.stored_text,
  );
  const analysis = analyzePrompt({
    prompt: input.redaction.stored_text,
    createdAt: now.toISOString(),
  });

  const transaction = db.transaction(() => {
    db.prepare(
      `
      INSERT OR IGNORE INTO sessions(id, tool, transcript_path, started_at)
      VALUES (?, ?, ?, ?)
      `,
    ).run(
      input.event.session_id,
      input.event.tool,
      input.event.transcript_path ?? null,
      input.event.created_at,
    );

    db.prepare(
      `
      INSERT INTO prompts(
        id, idempotency_key, stored_content_hash, tool, source_event,
        session_id, turn_id, transcript_path, cwd, project_root, git_branch,
        model, permission_mode, created_at, received_at, markdown_path,
        markdown_schema_version, markdown_mtime, markdown_size, prompt_length,
        is_sensitive, excluded_from_analysis, redaction_policy, adapter_version,
        index_status
      )
      VALUES (
        @id, @idempotency_key, @stored_content_hash, @tool, @source_event,
        @session_id, @turn_id, @transcript_path, @cwd, @project_root,
        @git_branch, @model, @permission_mode, @created_at, @received_at,
        @markdown_path, @markdown_schema_version, @markdown_mtime,
        @markdown_size, @prompt_length, @is_sensitive, @excluded_from_analysis,
        @redaction_policy, @adapter_version, @index_status
      )
      `,
    ).run({
      id,
      idempotency_key: input.event.idempotency_key,
      stored_content_hash: storedContentHash,
      tool: input.event.tool,
      source_event: input.event.source_event,
      session_id: input.event.session_id,
      turn_id: input.event.turn_id ?? null,
      transcript_path: input.event.transcript_path ?? null,
      cwd: input.event.cwd,
      project_root: input.event.project_root ?? null,
      git_branch: input.event.git_branch ?? null,
      model: input.event.model ?? null,
      permission_mode: input.event.permission_mode ?? null,
      created_at: input.event.created_at,
      received_at: input.event.received_at,
      markdown_path: markdown.path,
      markdown_schema_version: 1,
      markdown_mtime: Math.round(markdown.mtimeMs),
      markdown_size: markdown.size,
      prompt_length: input.event.prompt.length,
      is_sensitive: input.redaction.is_sensitive ? 1 : 0,
      excluded_from_analysis: 0,
      redaction_policy: input.redaction.policy,
      adapter_version: input.event.adapter_version,
      index_status: "indexed",
    });

    for (const finding of input.redaction.findings) {
      db.prepare(
        `
        INSERT INTO redaction_events(
          id, prompt_id, detector_type, range_start, range_end, policy, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        `${id}:${finding.detector_type}:${finding.range_start}`,
        id,
        finding.detector_type,
        finding.range_start,
        finding.range_end,
        input.redaction.policy,
        input.event.received_at,
      );
    }

    db.prepare(
      `
      INSERT INTO prompt_fts(prompt_id, body, snippet, project_name, tags)
      VALUES (?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      input.redaction.stored_text,
      input.redaction.stored_text.slice(0, 240),
      "",
      analysis.tags.join(" "),
    );

    upsertPromptAnalysis(db, id, analysis);
    upsertPromptTags(db, id, analysis.tags, analysis.created_at);
  });

  transaction();

  return { id, duplicate: false };
}

function listPrompts(
  db: Database.Database,
  options: ListPromptsOptions = {},
): PromptListResult {
  const limit = normalizeLimit(options.limit);
  const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
  const filters = buildPromptFilters(options);

  if (cursor) {
    filters.clauses.push("(received_at < ? OR (received_at = ? AND id < ?))");
    filters.values.push(cursor.received_at, cursor.received_at, cursor.id);
  }

  const rows = db
    .prepare(
      `
      SELECT * FROM prompts
      WHERE ${filters.clauses.join(" AND ")}
      ORDER BY received_at DESC, id DESC
      LIMIT ?
      `,
    )
    .all(...filters.values, limit + 1) as PromptRow[];

  return toListResult(db, rows, limit);
}

function searchPrompts(
  db: Database.Database,
  query: string,
  options: SearchPromptsOptions = {},
): PromptListResult {
  const match = toSafeFtsQuery(query);
  if (!match) {
    return { items: [] };
  }

  const limit = normalizeLimit(options.limit);
  const filters = buildPromptFilters(options, "p");
  const rows = db
    .prepare(
      `
      SELECT p.*
      FROM prompt_fts
      JOIN prompts p ON p.id = prompt_fts.prompt_id
      WHERE prompt_fts MATCH ? AND ${filters.clauses.join(" AND ")}
      ORDER BY rank
      LIMIT ?
      `,
    )
    .all(match, ...filters.values, limit + 1) as PromptRow[];

  return toListResult(db, rows, limit);
}

function buildPromptFilters(
  options: Omit<ListPromptsOptions, "cursor">,
  tableAlias?: string,
): { clauses: string[]; values: unknown[] } {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const clauses = [`${prefix}deleted_at IS NULL`];
  const values: unknown[] = [];

  if (options.tool) {
    clauses.push(`${prefix}tool = ?`);
    values.push(options.tool);
  }

  if (options.cwdPrefix) {
    clauses.push(`(${prefix}cwd = ? OR ${prefix}cwd LIKE ? ESCAPE '\\')`);
    values.push(options.cwdPrefix, `${escapeLike(options.cwdPrefix)}/%`);
  }

  if (options.isSensitive !== undefined) {
    clauses.push(`${prefix}is_sensitive = ?`);
    values.push(options.isSensitive ? 1 : 0);
  }

  if (options.receivedFrom) {
    clauses.push(`${prefix}received_at >= ?`);
    values.push(normalizeDateLowerBound(options.receivedFrom));
  }

  if (options.receivedTo) {
    clauses.push(`${prefix}received_at <= ?`);
    values.push(normalizeDateUpperBound(options.receivedTo));
  }

  if (options.tag) {
    const idExpression = tableAlias ? `${prefix}id` : "prompts.id";
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM prompt_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.prompt_id = ${idExpression} AND t.name = ?
      )`,
    );
    values.push(options.tag);
  }

  if (options.focus) {
    const idExpression = tableAlias ? `${prefix}id` : "prompts.id";
    const storedHashExpression = tableAlias
      ? `${prefix}stored_content_hash`
      : "prompts.stored_content_hash";

    if (options.focus === "saved") {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM prompt_bookmarks pb
          WHERE pb.prompt_id = ${idExpression}
        )`,
      );
    } else if (options.focus === "reused") {
      clauses.push(
        `(
          EXISTS (
            SELECT 1
            FROM prompt_bookmarks pb
            WHERE pb.prompt_id = ${idExpression}
          )
          OR EXISTS (
            SELECT 1
            FROM prompt_usage_events pue
            WHERE pue.prompt_id = ${idExpression}
              AND pue.event_type = 'prompt_copied'
          )
        )`,
      );
    } else if (options.focus === "duplicated") {
      clauses.push(
        `${storedHashExpression} IN (
          SELECT stored_content_hash
          FROM prompts
          WHERE deleted_at IS NULL
          GROUP BY stored_content_hash
          HAVING COUNT(*) > 1
        )`,
      );
    } else if (options.focus === "quality-gap") {
      clauses.push(
        `EXISTS (
          SELECT 1
          FROM prompt_analyses pa
          WHERE pa.prompt_id = ${idExpression}
            AND (
              pa.checklist_json LIKE '%"status":"missing"%'
              OR pa.checklist_json LIKE '%"status":"weak"%'
            )
        )`,
      );
    }
  }

  if (options.qualityGap) {
    const idExpression = tableAlias ? `${prefix}id` : "prompts.id";
    clauses.push(
      `EXISTS (
        SELECT 1
        FROM prompt_analyses pa
        WHERE pa.prompt_id = ${idExpression}
          AND (
            pa.checklist_json LIKE ?
            OR pa.checklist_json LIKE ?
          )
      )`,
    );
    values.push(
      qualityGapLikePattern(options.qualityGap, "missing"),
      qualityGapLikePattern(options.qualityGap, "weak"),
    );
  }

  return { clauses, values };
}

function normalizeDateLowerBound(value: string): string {
  return isDateOnly(value) ? `${value}T00:00:00.000Z` : value;
}

function normalizeDateUpperBound(value: string): string {
  return isDateOnly(value) ? `${value}T23:59:59.999Z` : value;
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function qualityGapLikePattern(
  key: string,
  status: "missing" | "weak",
): string {
  return `%"key":"${key}","label":%,"status":"${status}"%`;
}

function escapeLike(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function getPrompt(
  db: Database.Database,
  id: string,
): PromptDetail | undefined {
  const row = db
    .prepare("SELECT * FROM prompts WHERE id = ? AND deleted_at IS NULL")
    .get(id) as PromptRow | undefined;

  if (!row || !existsSync(row.markdown_path)) {
    return undefined;
  }

  return {
    ...toPromptSummary(db, row),
    markdown: parsePromptMarkdown(row.markdown_path).body,
    analysis: readPromptAnalysis(db, id),
    improvement_drafts: readPromptImprovementDrafts(db, id),
  };
}

function deletePrompt(db: Database.Database, id: string): DeletePromptResult {
  const row = db
    .prepare("SELECT id, markdown_path FROM prompts WHERE id = ?")
    .get(id) as { id: string; markdown_path: string } | undefined;

  if (!row) {
    return { deleted: false };
  }

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM prompt_fts WHERE prompt_id = ?").run(id);
    db.prepare("DELETE FROM prompt_tags WHERE prompt_id = ?").run(id);
    db.prepare("DELETE FROM prompt_analyses WHERE prompt_id = ?").run(id);
    db.prepare("DELETE FROM prompt_improvement_drafts WHERE prompt_id = ?").run(
      id,
    );
    db.prepare("DELETE FROM redaction_events WHERE prompt_id = ?").run(id);
    db.prepare("DELETE FROM prompt_usage_events WHERE prompt_id = ?").run(id);
    db.prepare("DELETE FROM prompt_bookmarks WHERE prompt_id = ?").run(id);
    db.prepare("DELETE FROM prompts WHERE id = ?").run(id);
  });

  transaction();

  if (existsSync(row.markdown_path)) {
    unlinkSync(row.markdown_path);
  }

  return { deleted: true };
}

function normalizeLimit(limit: number | undefined): number {
  if (!limit || !Number.isInteger(limit)) {
    return 20;
  }

  return Math.min(Math.max(limit, 1), 100);
}

function toListResult(
  db: Database.Database,
  rows: PromptRow[],
  limit: number,
): PromptListResult {
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);

  return {
    items: pageRows.map((row) => toPromptSummary(db, row)),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ received_at: last.received_at, id: last.id })
        : undefined,
  };
}

function toPromptSummary(db: Database.Database, row: PromptRow): PromptSummary {
  const analysis = readPromptAnalysis(db, row.id);
  return {
    id: row.id,
    tool: row.tool,
    source_event: row.source_event,
    session_id: row.session_id,
    cwd: row.cwd,
    created_at: row.created_at,
    received_at: row.received_at,
    snippet: readPromptSnippet(db, row.id),
    prompt_length: row.prompt_length,
    is_sensitive: row.is_sensitive === 1,
    excluded_from_analysis: row.excluded_from_analysis === 1,
    redaction_policy: row.redaction_policy,
    adapter_version: row.adapter_version,
    index_status: row.index_status,
    tags: analysis?.tags ?? [],
    quality_gaps:
      analysis?.checklist
        .filter((item) => item.status !== "good")
        .map((item) => item.label) ?? [],
    usefulness: readPromptUsefulness(db, row.id),
    duplicate_count: readPromptDuplicateCount(db, row.stored_content_hash),
  };
}

function readPromptSnippet(db: Database.Database, id: string): string {
  const row = db
    .prepare("SELECT snippet FROM prompt_fts WHERE prompt_id = ? LIMIT 1")
    .get(id) as { snippet: string | null } | undefined;

  return row?.snippet ?? "";
}

function readPromptDuplicateCount(
  db: Database.Database,
  storedContentHash: string,
): number {
  const count = readCount(
    db,
    "SELECT COUNT(*) AS count FROM prompts WHERE deleted_at IS NULL AND stored_content_hash = ?",
    [storedContentHash],
  );

  return count > 1 ? count : 0;
}

function recordPromptUsage(
  db: Database.Database,
  id: string,
  type: PromptUsageEventType,
  now: Date,
): { recorded: boolean; usefulness: PromptUsefulness } {
  if (!hasLivePrompt(db, id)) {
    return {
      recorded: false,
      usefulness: emptyPromptUsefulness(),
    };
  }

  db.prepare(
    `
    INSERT INTO prompt_usage_events(id, prompt_id, event_type, created_at)
    VALUES (?, ?, ?, ?)
    `,
  ).run(
    `${id}:${type}:${now.toISOString()}:${randomUUID()}`,
    id,
    type,
    now.toISOString(),
  );

  return {
    recorded: true,
    usefulness: readPromptUsefulness(db, id),
  };
}

function setPromptBookmark(
  db: Database.Database,
  id: string,
  bookmarked: boolean,
  now: Date,
): { updated: boolean; usefulness: PromptUsefulness } {
  if (!hasLivePrompt(db, id)) {
    return {
      updated: false,
      usefulness: emptyPromptUsefulness(),
    };
  }

  if (bookmarked) {
    db.prepare(
      `
      INSERT INTO prompt_bookmarks(prompt_id, created_at)
      VALUES (?, ?)
      ON CONFLICT(prompt_id) DO NOTHING
      `,
    ).run(id, now.toISOString());
  } else {
    db.prepare("DELETE FROM prompt_bookmarks WHERE prompt_id = ?").run(id);
  }

  return {
    updated: true,
    usefulness: readPromptUsefulness(db, id),
  };
}

function createImportJob(
  db: Database.Database,
  input: CreateImportJobInput,
  now: Date,
): ImportJob {
  const completedAt = isTerminalImportJobStatus(input.status)
    ? now.toISOString()
    : null;
  const job: ImportJob = {
    id: createImportJobId(),
    source_type: input.source_type,
    source_path_hash: input.source_path_hash,
    dry_run: input.dry_run,
    status: input.status,
    started_at: now.toISOString(),
    completed_at: completedAt ?? undefined,
    project_policy_version: input.project_policy_version,
    summary: input.summary,
  };

  db.prepare(
    `
    INSERT INTO import_jobs(
      id, source_type, source_path_hash, status, dry_run, started_at,
      completed_at, project_policy_version, summary_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    job.id,
    job.source_type,
    job.source_path_hash,
    job.status,
    job.dry_run ? 1 : 0,
    job.started_at,
    completedAt,
    job.project_policy_version ?? null,
    JSON.stringify(job.summary),
  );

  return job;
}

function createPromptImprovementDraft(
  db: Database.Database,
  promptId: string,
  input: CreatePromptImprovementDraftInput,
  now: Date,
): PromptImprovementDraft | undefined {
  if (!hasLivePrompt(db, promptId)) {
    return undefined;
  }

  const redaction = redactPrompt(input.draft_text, "mask");
  const createdAt = now.toISOString();
  const draft: PromptImprovementDraft = {
    id: createPromptImprovementDraftId(),
    prompt_id: promptId,
    draft_text: redaction.stored_text,
    analyzer: input.analyzer,
    changed_sections: input.changed_sections ?? [],
    safety_notes: input.safety_notes ?? [],
    is_sensitive: redaction.is_sensitive,
    redaction_policy: "mask",
    created_at: createdAt,
    copied_at: input.copied ? createdAt : undefined,
    accepted_at: input.accepted ? createdAt : undefined,
  };

  db.prepare(
    `
    INSERT INTO prompt_improvement_drafts(
      id, prompt_id, draft_text, analyzer, changed_sections_json,
      safety_notes_json, is_sensitive, redaction_policy, created_at,
      copied_at, accepted_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    draft.id,
    draft.prompt_id,
    draft.draft_text,
    draft.analyzer,
    JSON.stringify(draft.changed_sections),
    JSON.stringify(draft.safety_notes),
    draft.is_sensitive ? 1 : 0,
    draft.redaction_policy,
    draft.created_at,
    draft.copied_at ?? null,
    draft.accepted_at ?? null,
  );

  return draft;
}

function readPromptImprovementDrafts(
  db: Database.Database,
  promptId: string,
): PromptImprovementDraft[] {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM prompt_improvement_drafts
      WHERE prompt_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 20
      `,
    )
    .all(promptId) as PromptImprovementDraftRow[];

  return rows.map((row) => ({
    id: row.id,
    prompt_id: row.prompt_id,
    draft_text: row.draft_text,
    analyzer: row.analyzer,
    changed_sections: readQualityCriteria(row.changed_sections_json),
    safety_notes: readStringArray(row.safety_notes_json),
    is_sensitive: row.is_sensitive === 1,
    redaction_policy: "mask",
    created_at: row.created_at,
    copied_at: row.copied_at ?? undefined,
    accepted_at: row.accepted_at ?? undefined,
  }));
}

function getImportJob(
  db: Database.Database,
  id: string,
): ImportJob | undefined {
  const row = db.prepare("SELECT * FROM import_jobs WHERE id = ?").get(id) as
    | ImportJobRow
    | undefined;

  return row ? toImportJob(row) : undefined;
}

function listImportJobs(
  db: Database.Database,
  options: { limit?: number } = {},
): ImportJobListResult {
  const limit = normalizeLimit(options.limit);
  const rows = db
    .prepare(
      "SELECT * FROM import_jobs ORDER BY started_at DESC, id DESC LIMIT ?",
    )
    .all(limit) as ImportJobRow[];

  return {
    items: rows.map((row) => toImportJob(row)),
  };
}

function toImportJob(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    source_type: row.source_type,
    source_path_hash: row.source_path_hash,
    dry_run: row.dry_run === 1,
    status: row.status as ImportJob["status"],
    started_at: row.started_at,
    completed_at: row.completed_at ?? undefined,
    project_policy_version: row.project_policy_version ?? undefined,
    summary: parseJsonValue(row.summary_json),
  };
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function isTerminalImportJobStatus(status: ImportJob["status"]): boolean {
  return ["dry_run_completed", "completed", "failed", "canceled"].includes(
    status,
  );
}

function createImportJobId(): string {
  return `imp_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function createPromptImprovementDraftId(): string {
  return `impdraft_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function hasLivePrompt(db: Database.Database, id: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM prompts WHERE id = ? AND deleted_at IS NULL")
      .get(id),
  );
}

function readPromptUsefulness(
  db: Database.Database,
  id: string,
): PromptUsefulness {
  const row = db
    .prepare(
      `
      SELECT
        COUNT(pue.id) AS copied_count,
        MAX(pue.created_at) AS last_copied_at,
        pb.created_at AS bookmarked_at
      FROM prompts p
      LEFT JOIN prompt_usage_events pue
        ON pue.prompt_id = p.id AND pue.event_type = 'prompt_copied'
      LEFT JOIN prompt_bookmarks pb ON pb.prompt_id = p.id
      WHERE p.id = ? AND p.deleted_at IS NULL
      GROUP BY p.id, pb.created_at
      `,
    )
    .get(id) as PromptUsefulnessRow | undefined;

  if (!row) {
    return emptyPromptUsefulness();
  }

  return {
    copied_count: row.copied_count,
    last_copied_at: row.last_copied_at ?? undefined,
    bookmarked: row.bookmarked_at !== null,
    bookmarked_at: row.bookmarked_at ?? undefined,
  };
}

function emptyPromptUsefulness(): PromptUsefulness {
  return {
    copied_count: 0,
    bookmarked: false,
  };
}

function encodeCursor(cursor: { received_at: string; id: string }): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { received_at: string; id: string } {
  const decoded = JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8"),
  ) as {
    received_at?: unknown;
    id?: unknown;
  };

  if (
    typeof decoded.received_at !== "string" ||
    typeof decoded.id !== "string"
  ) {
    throw new Error("Invalid cursor.");
  }

  return {
    received_at: decoded.received_at,
    id: decoded.id,
  };
}

function createMarkdownPath(
  promptsDir: string,
  date: Date,
  tool: string,
  id: string,
): string {
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const second = date.getUTCSeconds().toString().padStart(2, "0");
  const filename = `${year}${month}${day}-${hour}${minute}${second}-${tool}-${id}.md`;

  return join(promptsDir, year, month, day, filename);
}

function toSafeFtsQuery(query: string): string {
  const tokens = query
    .match(/[\p{L}\p{N}_-]+/gu)
    ?.slice(0, 8)
    .map((token) => `"${token.replaceAll('"', '""')}"`);

  return tokens?.join(" ") ?? "";
}

function rebuildIndex(
  db: Database.Database,
  promptsDir: string,
  redactionMode: RedactionPolicy,
): { rebuilt: string[]; hashMismatches: string[] } {
  const rebuilt: string[] = [];
  const hashMismatches: string[] = [];

  const transaction = db.transaction(() => {
    importMarkdownOnlyPrompts(db, promptsDir);
    db.prepare("DELETE FROM prompt_fts").run();

    const rows = db
      .prepare(
        "SELECT id, markdown_path, received_at FROM prompts WHERE deleted_at IS NULL",
      )
      .all() as RebuildPromptRow[];

    for (const row of rows) {
      db.prepare("DELETE FROM prompt_analyses WHERE prompt_id = ?").run(row.id);
      db.prepare("DELETE FROM prompt_tags WHERE prompt_id = ?").run(row.id);

      if (!existsSync(row.markdown_path)) {
        db.prepare("UPDATE prompts SET index_status = ? WHERE id = ?").run(
          "missing_file",
          row.id,
        );
        continue;
      }

      const body = extractMarkdownBody(readPromptMarkdown(row.markdown_path));
      const redaction = redactPrompt(body, redactionMode);

      if (redaction.is_sensitive) {
        db.prepare("UPDATE prompts SET index_status = ? WHERE id = ?").run(
          "hash_mismatch",
          row.id,
        );
        hashMismatches.push(row.id);
        continue;
      }

      const analysis = analyzePrompt({
        prompt: redaction.stored_text,
        createdAt: row.received_at,
      });

      db.prepare(
        `
        INSERT INTO prompt_fts(prompt_id, body, snippet, project_name, tags)
        VALUES (?, ?, ?, ?, ?)
        `,
      ).run(
        row.id,
        redaction.stored_text,
        redaction.stored_text.slice(0, 240),
        "",
        analysis.tags.join(" "),
      );
      db.prepare("UPDATE prompts SET index_status = ? WHERE id = ?").run(
        "indexed",
        row.id,
      );
      upsertPromptAnalysis(db, row.id, analysis);
      upsertPromptTags(db, row.id, analysis.tags, analysis.created_at);
      rebuilt.push(row.id);
    }
  });

  transaction();

  return { rebuilt, hashMismatches };
}

function importMarkdownOnlyPrompts(
  db: Database.Database,
  promptsDir: string,
): void {
  for (const markdownPath of findMarkdownFiles(promptsDir)) {
    const parsed = parsePromptMarkdown(markdownPath);
    const frontmatter = parsed.frontmatter;
    const id = readString(frontmatter.id);

    if (!id || promptExists(db, id)) {
      continue;
    }

    const stat = statSync(markdownPath);
    const sessionId = readString(frontmatter.session_id) ?? "unknown-session";
    db.prepare(
      `
      INSERT OR IGNORE INTO sessions(id, tool, transcript_path, started_at)
      VALUES (?, ?, ?, ?)
      `,
    ).run(
      sessionId,
      readString(frontmatter.tool) ?? "unknown",
      readNullableString(frontmatter.transcript_path),
      readString(frontmatter.created_at) ??
        new Date(stat.mtimeMs).toISOString(),
    );

    db.prepare(
      `
      INSERT OR IGNORE INTO prompts(
        id, idempotency_key, stored_content_hash, tool, source_event,
        session_id, turn_id, transcript_path, cwd, project_root, git_branch,
        model, permission_mode, created_at, received_at, markdown_path,
        markdown_schema_version, markdown_mtime, markdown_size, prompt_length,
        is_sensitive, excluded_from_analysis, redaction_policy, adapter_version,
        index_status
      )
      VALUES (
        @id, @idempotency_key, @stored_content_hash, @tool, @source_event,
        @session_id, @turn_id, @transcript_path, @cwd, @project_root,
        @git_branch, @model, @permission_mode, @created_at, @received_at,
        @markdown_path, @markdown_schema_version, @markdown_mtime,
        @markdown_size, @prompt_length, @is_sensitive,
        @excluded_from_analysis, @redaction_policy, @adapter_version,
        @index_status
      )
      `,
    ).run({
      id,
      idempotency_key: readString(frontmatter.idempotency_key) ?? id,
      stored_content_hash: readString(frontmatter.stored_content_hash) ?? "",
      tool: readString(frontmatter.tool) ?? "unknown",
      source_event: readString(frontmatter.source_event) ?? "unknown",
      session_id: sessionId,
      turn_id: readNullableString(frontmatter.turn_id),
      transcript_path: readNullableString(frontmatter.transcript_path),
      cwd: readString(frontmatter.cwd) ?? "unknown",
      project_root: readNullableString(frontmatter.project_root),
      git_branch: readNullableString(frontmatter.git_branch),
      model: readNullableString(frontmatter.model),
      permission_mode: readNullableString(frontmatter.permission_mode),
      created_at:
        readString(frontmatter.created_at) ??
        new Date(stat.mtimeMs).toISOString(),
      received_at:
        readString(frontmatter.received_at) ??
        new Date(stat.mtimeMs).toISOString(),
      markdown_path: markdownPath,
      markdown_schema_version: readNumber(frontmatter.schema_version) ?? 1,
      markdown_mtime: Math.round(stat.mtimeMs),
      markdown_size: stat.size,
      prompt_length:
        readNumber(frontmatter.prompt_length) ?? parsed.body.length,
      is_sensitive: readBoolean(frontmatter.is_sensitive) ? 1 : 0,
      excluded_from_analysis: readBoolean(frontmatter.excluded_from_analysis)
        ? 1
        : 0,
      redaction_policy: readString(frontmatter.redaction_policy) ?? "mask",
      adapter_version: readString(frontmatter.adapter_version) ?? "unknown",
      index_status: "pending",
    });
  }
}

function findMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
}

function promptExists(db: Database.Database, id: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM prompts WHERE id = ?").get(id));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNullableString(value: unknown): string | null {
  return readString(value) ?? null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function reconcileStorage(db: Database.Database): { missingFiles: string[] } {
  const missingFiles: string[] = [];
  const rows = db
    .prepare("SELECT id, markdown_path FROM prompts WHERE deleted_at IS NULL")
    .all() as Array<{ id: string; markdown_path: string }>;

  const transaction = db.transaction(() => {
    for (const row of rows) {
      if (!existsSync(row.markdown_path)) {
        db.prepare("UPDATE prompts SET index_status = ? WHERE id = ?").run(
          "missing_file",
          row.id,
        );
        missingFiles.push(row.id);
      }
    }
  });

  transaction();

  return { missingFiles };
}

function extractMarkdownBody(markdown: string): string {
  if (!markdown.startsWith("---\n")) {
    return markdown;
  }

  const delimiter = markdown.indexOf("\n---\n", 4);

  if (delimiter === -1) {
    return markdown;
  }

  return markdown.slice(delimiter + "\n---\n".length).trimStart();
}

function upsertPromptAnalysis(
  db: Database.Database,
  promptId: string,
  analysis: PromptAnalysisPreview,
): void {
  db.prepare("DELETE FROM prompt_analyses WHERE prompt_id = ?").run(promptId);
  db.prepare(
    `
    INSERT INTO prompt_analyses(
      id, prompt_id, summary, warnings_json, suggestions_json,
      checklist_json, tags_json, analyzer, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    `${promptId}:${analysis.analyzer}`,
    promptId,
    analysis.summary,
    JSON.stringify(analysis.warnings),
    JSON.stringify(analysis.suggestions),
    JSON.stringify(analysis.checklist),
    JSON.stringify(analysis.tags),
    analysis.analyzer,
    analysis.created_at,
  );
}

function upsertPromptTags(
  db: Database.Database,
  promptId: string,
  tags: PromptTag[],
  createdAt: string,
): void {
  db.prepare("DELETE FROM prompt_tags WHERE prompt_id = ?").run(promptId);

  for (const tag of tags) {
    const tagId = `tag:${tag}`;
    db.prepare(
      `
      INSERT OR IGNORE INTO tags(id, name, created_at)
      VALUES (?, ?, ?)
      `,
    ).run(tagId, tag, createdAt);
    db.prepare(
      `
      INSERT OR IGNORE INTO prompt_tags(prompt_id, tag_id)
      VALUES (?, ?)
      `,
    ).run(promptId, tagId);
  }
}

function readPromptAnalysis(
  db: Database.Database,
  promptId: string,
): PromptAnalysisPreview | undefined {
  const row = db
    .prepare(
      `
      SELECT summary, warnings_json, suggestions_json, checklist_json,
        tags_json, analyzer, created_at
      FROM prompt_analyses
      WHERE prompt_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
    )
    .get(promptId) as PromptAnalysisRow | undefined;

  if (!row) {
    return undefined;
  }

  return {
    summary: row.summary ?? "",
    warnings: readStringArray(row.warnings_json),
    suggestions: readStringArray(row.suggestions_json),
    checklist: readChecklist(row.checklist_json),
    tags: readPromptTags(row.tags_json),
    analyzer: row.analyzer,
    created_at: row.created_at,
  };
}

function readChecklist(value: string | null): PromptQualityChecklistItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is PromptQualityChecklistItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as PromptQualityChecklistItem).key === "string" &&
        typeof (item as PromptQualityChecklistItem).label === "string" &&
        typeof (item as PromptQualityChecklistItem).status === "string" &&
        typeof (item as PromptQualityChecklistItem).reason === "string",
    );
  } catch {
    return [];
  }
}

function readPromptTags(value: string | null): PromptTag[] {
  return readStringArray(value).filter((tag): tag is PromptTag =>
    [
      "bugfix",
      "refactor",
      "docs",
      "test",
      "ui",
      "backend",
      "security",
      "db",
      "release",
      "ops",
    ].includes(tag),
  );
}

function readQualityCriteria(value: string | null): PromptQualityCriterion[] {
  return readStringArray(value).filter((item): item is PromptQualityCriterion =>
    [
      "goal_clarity",
      "background_context",
      "scope_limits",
      "output_format",
      "verification_criteria",
    ].includes(item),
  );
}

function readStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function getQualityDashboard(
  db: Database.Database,
  now: Date,
): PromptQualityDashboard {
  const totalPrompts = readCount(
    db,
    "SELECT COUNT(*) AS count FROM prompts WHERE deleted_at IS NULL",
  );
  const sensitivePrompts = readCount(
    db,
    "SELECT COUNT(*) AS count FROM prompts WHERE deleted_at IS NULL AND is_sensitive = 1",
  );
  const recent = {
    last_7_days: readCount(
      db,
      "SELECT COUNT(*) AS count FROM prompts WHERE deleted_at IS NULL AND received_at >= ?",
      [daysAgo(now, 7)],
    ),
    last_30_days: readCount(
      db,
      "SELECT COUNT(*) AS count FROM prompts WHERE deleted_at IS NULL AND received_at >= ?",
      [daysAgo(now, 30)],
    ),
  };

  const qualityRows = db
    .prepare(
      `
      SELECT p.id AS prompt_id, p.received_at, p.is_sensitive, p.cwd,
        p.project_root, pa.checklist_json, pa.tags_json
      FROM prompts p
      LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
      WHERE p.deleted_at IS NULL
      `,
    )
    .all() as PromptQualityRow[];
  const missingItems = buildMissingItems(qualityRows);

  return {
    total_prompts: totalPrompts,
    sensitive_prompts: sensitivePrompts,
    sensitive_ratio: ratio(sensitivePrompts, totalPrompts),
    recent,
    trend: {
      daily: buildDailyTrend(qualityRows, now),
    },
    distribution: {
      by_tool: readDistribution(
        db,
        "SELECT tool AS key, tool AS label, COUNT(*) AS count FROM prompts WHERE deleted_at IS NULL GROUP BY tool ORDER BY count DESC, tool ASC",
        totalPrompts,
      ),
      by_project: readProjectDistribution(db, totalPrompts),
    },
    missing_items: missingItems,
    patterns: buildQualityPatterns(qualityRows),
    instruction_suggestions: buildInstructionSuggestions(
      missingItems,
      buildQualityPatterns(qualityRows),
    ),
    useful_prompts: readUsefulPrompts(db),
    duplicate_prompt_groups: readDuplicatePromptGroups(db),
    project_profiles: readProjectQualityProfiles(db, qualityRows),
  };
}

function buildDailyTrend(
  rows: PromptQualityRow[],
  now: Date,
): PromptQualityDashboard["trend"]["daily"] {
  const dates = lastDayKeys(now, 7);
  const buckets = new Map<
    string,
    {
      date: string;
      prompt_count: number;
      quality_gap_count: number;
      sensitive_count: number;
    }
  >(
    dates.map((date) => [
      date,
      {
        date,
        prompt_count: 0,
        quality_gap_count: 0,
        sensitive_count: 0,
      },
    ]),
  );
  const firstDate = dates[0];

  for (const row of rows) {
    const date = row.received_at.slice(0, 10);
    if (!firstDate || date < firstDate || !buckets.has(date)) {
      continue;
    }

    const bucket = buckets.get(date);
    if (!bucket) {
      continue;
    }

    bucket.prompt_count += 1;
    if (row.is_sensitive === 1) {
      bucket.sensitive_count += 1;
    }
    if (hasQualityGap(row.checklist_json)) {
      bucket.quality_gap_count += 1;
    }
  }

  return dates.map((date) => {
    const bucket = buckets.get(date) ?? {
      date,
      prompt_count: 0,
      quality_gap_count: 0,
      sensitive_count: 0,
    };

    return {
      ...bucket,
      quality_gap_rate: ratio(bucket.quality_gap_count, bucket.prompt_count),
    };
  });
}

function hasQualityGap(checklistJson: string | null): boolean {
  return readChecklist(checklistJson).some(
    (item) => item.status === "missing" || item.status === "weak",
  );
}

function readDuplicatePromptGroups(
  db: Database.Database,
): DuplicatePromptGroup[] {
  const groups = db
    .prepare(
      `
      SELECT
        stored_content_hash,
        COUNT(*) AS count,
        MAX(received_at) AS latest_received_at
      FROM prompts
      WHERE deleted_at IS NULL
      GROUP BY stored_content_hash
      HAVING count > 1
      ORDER BY count DESC, latest_received_at DESC
      LIMIT 8
      `,
    )
    .all() as Array<{
    stored_content_hash: string;
    count: number;
    latest_received_at: string;
  }>;

  return groups.map((group) => {
    const rows = db
      .prepare(
        `
        SELECT *
        FROM prompts
        WHERE deleted_at IS NULL AND stored_content_hash = ?
        ORDER BY received_at DESC, id DESC
        LIMIT 6
        `,
      )
      .all(group.stored_content_hash) as PromptRow[];
    const projects = [
      ...new Set(rows.map((row) => row.cwd).sort((a, b) => a.localeCompare(b))),
    ];

    return {
      group_id: `dup_${group.stored_content_hash.slice(0, 16)}`,
      count: group.count,
      latest_received_at: group.latest_received_at,
      projects,
      prompts: rows.map((row) => {
        const summary = toPromptSummary(db, row);
        return {
          id: row.id,
          tool: row.tool,
          cwd: row.cwd,
          received_at: row.received_at,
          tags: summary.tags,
          quality_gaps: summary.quality_gaps,
        };
      }),
    };
  });
}

function readUsefulPrompts(db: Database.Database): UsefulPrompt[] {
  const rows = db
    .prepare(
      `
      SELECT
        p.*,
        COUNT(pue.id) AS copied_count,
        MAX(pue.created_at) AS last_copied_at,
        pb.created_at AS bookmarked_at
      FROM prompts p
      LEFT JOIN prompt_usage_events pue
        ON pue.prompt_id = p.id AND pue.event_type = 'prompt_copied'
      LEFT JOIN prompt_bookmarks pb ON pb.prompt_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, pb.created_at
      HAVING copied_count > 0 OR bookmarked_at IS NOT NULL
      ORDER BY
        CASE WHEN bookmarked_at IS NOT NULL THEN 1 ELSE 0 END DESC,
        copied_count DESC,
        COALESCE(last_copied_at, bookmarked_at, p.received_at) DESC,
        p.received_at DESC
      LIMIT 8
      `,
    )
    .all() as UsefulPromptRow[];

  return rows.map((row) => {
    const summary = toPromptSummary(db, row);
    return {
      id: row.id,
      tool: row.tool,
      cwd: row.cwd,
      received_at: row.received_at,
      copied_count: row.copied_count,
      last_copied_at: row.last_copied_at ?? undefined,
      bookmarked: row.bookmarked_at !== null,
      bookmarked_at: row.bookmarked_at ?? undefined,
      tags: summary.tags,
      quality_gaps: summary.quality_gaps,
    };
  });
}

function readCount(
  db: Database.Database,
  sql: string,
  params: unknown[] = [],
): number {
  return (
    (
      db.prepare(sql).get(...params) as
        | {
            count: number;
          }
        | undefined
    )?.count ?? 0
  );
}

function readDistribution(
  db: Database.Database,
  sql: string,
  total: number,
): Array<{ key: string; label: string; count: number; ratio: number }> {
  const rows = db.prepare(sql).all() as Array<{
    key: string;
    label: string;
    count: number;
  }>;

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    count: row.count,
    ratio: ratio(row.count, total),
  }));
}

function readProjectDistribution(
  db: Database.Database,
  total: number,
): Array<{ key: string; label: string; count: number; ratio: number }> {
  const rows = db
    .prepare(
      `
      SELECT COALESCE(NULLIF(project_root, ''), cwd) AS key, COUNT(*) AS count
      FROM prompts
      WHERE deleted_at IS NULL
      GROUP BY COALESCE(NULLIF(project_root, ''), cwd)
      ORDER BY count DESC, key ASC
      LIMIT 10
      `,
    )
    .all() as Array<{ key: string; count: number }>;

  return rows.map((row) => ({
    key: row.key,
    label: projectLabel(row.key),
    count: row.count,
    ratio: ratio(row.count, total),
  }));
}

function readProjectQualityProfiles(
  db: Database.Database,
  rows: PromptQualityRow[],
): PromptQualityDashboard["project_profiles"] {
  const projects = new Map<
    string,
    {
      key: string;
      label: string;
      prompt_count: number;
      quality_gap_count: number;
      sensitive_count: number;
      latest_received_at: string;
      gapCounts: Map<string, { key: string; label: string; count: number }>;
    }
  >();

  for (const row of rows) {
    const key = row.project_root || row.cwd;
    const current =
      projects.get(key) ??
      ({
        key,
        label: projectLabel(key),
        prompt_count: 0,
        quality_gap_count: 0,
        sensitive_count: 0,
        latest_received_at: row.received_at,
        gapCounts: new Map(),
      } satisfies {
        key: string;
        label: string;
        prompt_count: number;
        quality_gap_count: number;
        sensitive_count: number;
        latest_received_at: string;
        gapCounts: Map<string, { key: string; label: string; count: number }>;
      });
    const checklist = readChecklist(row.checklist_json);

    current.prompt_count += 1;
    if (row.is_sensitive === 1) {
      current.sensitive_count += 1;
    }
    if (row.received_at > current.latest_received_at) {
      current.latest_received_at = row.received_at;
    }
    if (
      checklist.some(
        (item) => item.status === "missing" || item.status === "weak",
      )
    ) {
      current.quality_gap_count += 1;
    }

    for (const item of checklist) {
      if (item.status !== "missing" && item.status !== "weak") {
        continue;
      }
      const gap =
        current.gapCounts.get(item.key) ??
        ({ key: item.key, label: item.label, count: 0 } satisfies {
          key: string;
          label: string;
          count: number;
        });
      gap.count += 1;
      current.gapCounts.set(item.key, gap);
    }

    projects.set(key, current);
  }

  const usefulness = readProjectUsefulness(db);

  return [...projects.values()]
    .map((project) => {
      const topGap = [...project.gapCounts.values()].sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label),
      )[0];
      const projectUsefulness = usefulness.get(project.key) ?? {
        copied_count: 0,
        bookmarked_count: 0,
      };

      return {
        key: project.key,
        label: project.label,
        prompt_count: project.prompt_count,
        quality_gap_count: project.quality_gap_count,
        quality_gap_rate: ratio(
          project.quality_gap_count,
          project.prompt_count,
        ),
        sensitive_count: project.sensitive_count,
        copied_count: projectUsefulness.copied_count,
        bookmarked_count: projectUsefulness.bookmarked_count,
        latest_received_at: project.latest_received_at,
        top_gap: topGap
          ? {
              key: topGap.key,
              label: topGap.label,
              count: topGap.count,
            }
          : undefined,
      };
    })
    .sort(
      (a, b) =>
        b.quality_gap_count - a.quality_gap_count ||
        b.sensitive_count - a.sensitive_count ||
        b.prompt_count - a.prompt_count ||
        b.latest_received_at.localeCompare(a.latest_received_at) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, 8);
}

function readProjectUsefulness(
  db: Database.Database,
): Map<string, { copied_count: number; bookmarked_count: number }> {
  const rows = db
    .prepare(
      `
      SELECT
        COALESCE(NULLIF(p.project_root, ''), p.cwd) AS project,
        COUNT(pue.id) AS copied_count,
        COUNT(pb.prompt_id) AS bookmarked_count
      FROM prompts p
      LEFT JOIN prompt_usage_events pue
        ON pue.prompt_id = p.id AND pue.event_type = 'prompt_copied'
      LEFT JOIN prompt_bookmarks pb ON pb.prompt_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY COALESCE(NULLIF(p.project_root, ''), p.cwd)
      `,
    )
    .all() as Array<{
    project: string;
    copied_count: number;
    bookmarked_count: number;
  }>;

  return new Map(
    rows.map((row) => [
      row.project,
      {
        copied_count: row.copied_count,
        bookmarked_count: row.bookmarked_count,
      },
    ]),
  );
}

function buildMissingItems(
  rows: PromptQualityRow[],
): PromptQualityDashboard["missing_items"] {
  const items = new Map<
    string,
    { key: string; label: string; missing: number; weak: number; total: number }
  >();

  for (const row of rows) {
    for (const item of readChecklist(row.checklist_json)) {
      const current =
        items.get(item.key) ??
        ({
          key: item.key,
          label: item.label,
          missing: 0,
          weak: 0,
          total: 0,
        } satisfies {
          key: string;
          label: string;
          missing: number;
          weak: number;
          total: number;
        });
      current.total += 1;
      if (item.status === "missing") {
        current.missing += 1;
      } else if (item.status === "weak") {
        current.weak += 1;
      }
      items.set(item.key, current);
    }
  }

  return [...items.values()]
    .map((item) => ({
      ...item,
      rate: ratio(item.missing + item.weak, item.total),
    }))
    .filter((item) => item.missing > 0 || item.weak > 0)
    .sort(
      (a, b) =>
        b.missing + b.weak - (a.missing + a.weak) ||
        a.label.localeCompare(b.label),
    );
}

function buildQualityPatterns(
  rows: PromptQualityRow[],
): PromptQualityDashboard["patterns"] {
  const projectTotals = new Map<string, number>();
  const gaps = new Map<
    string,
    { project: string; item_key: string; label: string; count: number }
  >();

  for (const row of rows) {
    const project = row.project_root || row.cwd;
    projectTotals.set(project, (projectTotals.get(project) ?? 0) + 1);

    for (const item of readChecklist(row.checklist_json)) {
      if (item.status !== "missing") {
        continue;
      }

      const key = `${project}:${item.key}`;
      const current =
        gaps.get(key) ??
        ({
          project,
          item_key: item.key,
          label: item.label,
          count: 0,
        } satisfies {
          project: string;
          item_key: string;
          label: string;
          count: number;
        });
      current.count += 1;
      gaps.set(key, current);
    }
  }

  return [...gaps.values()]
    .map((gap) => ({
      ...gap,
      total: projectTotals.get(gap.project) ?? 0,
      message: patternMessage(gap.project, gap.item_key, gap.count),
    }))
    .filter((gap) => gap.total >= 2 && gap.count >= 2)
    .sort((a, b) => b.count - a.count || a.project.localeCompare(b.project))
    .slice(0, 8);
}

function buildInstructionSuggestions(
  missingItems: PromptQualityDashboard["missing_items"],
  patterns: PromptQualityDashboard["patterns"],
): PromptQualityDashboard["instruction_suggestions"] {
  const suggestions: PromptQualityDashboard["instruction_suggestions"] = [];

  for (const item of missingItems.slice(0, 3)) {
    suggestions.push({
      scope: "global",
      text: instructionText(item.key),
      reason: `${item.label} 항목이 ${item.missing + item.weak}건 부족합니다.`,
    });
  }

  for (const pattern of patterns.slice(0, 3)) {
    suggestions.push({
      scope: "project",
      project: pattern.project,
      text: instructionText(pattern.item_key),
      reason: `${projectLabel(pattern.project)}에서 ${pattern.label} 누락이 반복됩니다.`,
    });
  }

  return suggestions;
}

function instructionText(itemKey: string): string {
  const instructions: Record<string, string> = {
    goal_clarity: "요청에는 바꿀 대상과 기대 동작을 한 문장 이상으로 명시한다.",
    background_context:
      "작업 요청에는 현재 상태, 관련 로그, 문제가 발생한 배경을 함께 포함한다.",
    scope_limits:
      "작업 요청에는 수정해도 되는 파일/영역과 제외할 영역을 구분해 적는다.",
    output_format:
      "응답 형식이 중요할 때는 요약, 목록, 표, JSON 등 원하는 구조를 명시한다.",
    verification_criteria:
      "작업 요청에는 실행할 테스트 명령과 기대 결과를 검증 기준으로 포함한다.",
  };

  return instructions[itemKey] ?? "반복적으로 빠지는 요청 조건을 명시한다.";
}

function patternMessage(
  project: string,
  itemKey: string,
  count: number,
): string {
  const projectName = projectLabel(project);
  const messages: Record<string, string> = {
    goal_clarity: `${projectName}에서는 목표와 대상이 모호한 요청이 ${count}건 반복됩니다.`,
    background_context: `${projectName}에서는 배경 맥락이 빠진 요청이 ${count}건 반복됩니다.`,
    scope_limits: `${projectName}에서는 파일 범위나 제외 범위를 명시하지 않은 요청이 ${count}건 반복됩니다.`,
    output_format: `${projectName}에서는 출력 형식이 빠진 요청이 ${count}건 반복됩니다.`,
    verification_criteria: `${projectName}에서는 테스트 명령이나 검증 기준을 자주 빼먹습니다.`,
  };

  return messages[itemKey] ?? `${projectName}에서 같은 누락이 반복됩니다.`;
}

function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function lastDayKeys(now: Date, days: number): string[] {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - (days - index - 1));
    return day.toISOString().slice(0, 10);
  });
}

function ratio(count: number, total: number): number {
  return total > 0 ? Number((count / total).toFixed(4)) : 0;
}

function projectLabel(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.split("/").at(-1) || trimmed || "unknown";
}

function listProjectsForPolicy(
  db: Database.Database,
  hmacSecret: string,
): ProjectListResult {
  const rows = db
    .prepare(
      `
      SELECT
        p.id,
        p.cwd,
        p.project_root,
        p.received_at,
        p.is_sensitive,
        pa.checklist_json,
        COUNT(pue.id) AS copied_count,
        CASE WHEN pb.prompt_id IS NULL THEN 0 ELSE 1 END AS bookmarked_count
      FROM prompts p
      LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
      LEFT JOIN prompt_usage_events pue
        ON pue.prompt_id = p.id AND pue.event_type = 'prompt_copied'
      LEFT JOIN prompt_bookmarks pb ON pb.prompt_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.received_at DESC, p.id DESC
      `,
    )
    .all() as ProjectPromptRow[];
  const projects = new Map<
    string,
    {
      projectId: string;
      sourcePath: string;
      pathKind: "project_root" | "cwd";
      promptCount: number;
      latestIngest?: string;
      sensitiveCount: number;
      qualityGapCount: number;
      copiedCount: number;
      bookmarkedCount: number;
    }
  >();

  for (const row of rows) {
    const descriptor = projectDescriptor(row, hmacSecret);
    const current = projects.get(descriptor.projectId) ?? {
      projectId: descriptor.projectId,
      sourcePath: descriptor.sourcePath,
      pathKind: descriptor.pathKind,
      promptCount: 0,
      latestIngest: undefined,
      sensitiveCount: 0,
      qualityGapCount: 0,
      copiedCount: 0,
      bookmarkedCount: 0,
    };

    current.promptCount += 1;
    current.latestIngest =
      !current.latestIngest || row.received_at > current.latestIngest
        ? row.received_at
        : current.latestIngest;
    current.sensitiveCount += row.is_sensitive === 1 ? 1 : 0;
    current.qualityGapCount += hasQualityGap(row.checklist_json) ? 1 : 0;
    current.copiedCount += row.copied_count;
    current.bookmarkedCount += row.bookmarked_count;
    projects.set(descriptor.projectId, current);
  }

  return {
    items: [...projects.values()]
      .map((project) => {
        const policy = readProjectPolicy(db, project.projectId);
        const alias = policy.alias ?? undefined;
        return {
          project_id: project.projectId,
          label: alias ?? projectLabel(project.sourcePath),
          alias,
          path_kind: project.pathKind,
          prompt_count: project.promptCount,
          latest_ingest: project.latestIngest,
          sensitive_count: project.sensitiveCount,
          quality_gap_rate: ratio(project.qualityGapCount, project.promptCount),
          copied_count: project.copiedCount,
          bookmarked_count: project.bookmarkedCount,
          policy: policy.policy,
        };
      })
      .sort((a, b) =>
        (b.latest_ingest ?? "").localeCompare(a.latest_ingest ?? ""),
      ),
  };
}

function updateProjectPolicy(
  db: Database.Database,
  hmacSecret: string,
  projectId: string,
  patch: ProjectPolicyPatch,
  actor: ProjectPolicyActor,
  now: Date,
): ProjectSummary | undefined {
  const existingSummary = listProjectsForPolicy(db, hmacSecret).items.find(
    (project) => project.project_id === projectId,
  );
  if (!existingSummary) {
    return undefined;
  }

  if (patch.alias) {
    const aliasConflict = db
      .prepare(
        `
        SELECT project_key
        FROM project_policies
        WHERE display_alias = ? AND project_key != ?
        `,
      )
      .get(patch.alias, projectId) as { project_key: string } | undefined;
    if (aliasConflict) {
      return undefined;
    }
  }

  const previous = readProjectPolicy(db, projectId);
  const nextPolicy = applyPolicyPatch(previous.policy, patch, now);
  const nextAlias =
    patch.alias === null
      ? undefined
      : patch.alias !== undefined
        ? patch.alias
        : previous.alias;
  const changedFields = Object.keys(patch).sort();

  db.transaction(() => {
    db.prepare(
      `
      INSERT INTO project_policies(
        project_key, display_alias, capture_disabled, analysis_disabled,
        retention_candidate_days, external_analysis_opt_in, export_disabled,
        version, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_key) DO UPDATE SET
        display_alias = excluded.display_alias,
        capture_disabled = excluded.capture_disabled,
        analysis_disabled = excluded.analysis_disabled,
        retention_candidate_days = excluded.retention_candidate_days,
        external_analysis_opt_in = excluded.external_analysis_opt_in,
        export_disabled = excluded.export_disabled,
        version = excluded.version,
        updated_at = excluded.updated_at
      `,
    ).run(
      projectId,
      nextAlias ?? null,
      nextPolicy.capture_disabled ? 1 : 0,
      nextPolicy.analysis_disabled ? 1 : 0,
      nextPolicy.retention_candidate_days ?? null,
      nextPolicy.external_analysis_opt_in ? 1 : 0,
      nextPolicy.export_disabled ? 1 : 0,
      nextPolicy.version,
      nextPolicy.updated_at,
    );

    db.prepare(
      `
      INSERT INTO policy_audit_events(
        id, project_key, changed_fields_json, previous_policy_hash,
        next_policy_hash, actor, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      `${projectId}:${now.toISOString()}:${randomUUID()}`,
      projectId,
      JSON.stringify(changedFields),
      policyHash(previous.policy),
      policyHash(nextPolicy),
      actor,
      now.toISOString(),
    );
  })();

  return listProjectsForPolicy(db, hmacSecret).items.find(
    (project) => project.project_id === projectId,
  );
}

function getProjectPolicyForEvent(
  db: Database.Database,
  hmacSecret: string,
  event: { cwd: string; project_root?: string | null },
): ProjectPolicy | undefined {
  const descriptor = projectDescriptor(
    {
      cwd: event.cwd,
      project_root: event.project_root ?? null,
    },
    hmacSecret,
  );

  return readProjectPolicy(db, descriptor.projectId).policy;
}

function projectDescriptor(
  row: { cwd: string; project_root: string | null },
  hmacSecret: string,
): {
  projectId: string;
  sourcePath: string;
  pathKind: "project_root" | "cwd";
} {
  const sourcePath = row.project_root ?? row.cwd;
  return {
    projectId: createProjectKey(sourcePath, hmacSecret),
    sourcePath,
    pathKind: row.project_root ? "project_root" : "cwd",
  };
}

function createProjectKey(sourcePath: string, hmacSecret: string): string {
  return `proj_${createHmac("sha256", hmacSecret)
    .update(sourcePath)
    .digest("hex")
    .slice(0, 24)}`;
}

function readProjectPolicy(
  db: Database.Database,
  projectKey: string,
): { alias?: string; policy: ProjectPolicy } {
  const row = db
    .prepare("SELECT * FROM project_policies WHERE project_key = ?")
    .get(projectKey) as ProjectPolicyRow | undefined;

  if (!row) {
    return { policy: defaultProjectPolicy() };
  }

  return {
    alias: row.display_alias ?? undefined,
    policy: {
      capture_disabled: row.capture_disabled === 1,
      analysis_disabled: row.analysis_disabled === 1,
      retention_candidate_days: row.retention_candidate_days ?? undefined,
      external_analysis_opt_in: row.external_analysis_opt_in === 1,
      export_disabled: row.export_disabled === 1,
      version: row.version,
      updated_at: row.updated_at,
    },
  };
}

function defaultProjectPolicy(): ProjectPolicy {
  return {
    capture_disabled: false,
    analysis_disabled: false,
    external_analysis_opt_in: false,
    export_disabled: false,
    version: 1,
  };
}

function applyPolicyPatch(
  current: ProjectPolicy,
  patch: ProjectPolicyPatch,
  now: Date,
): ProjectPolicy {
  return {
    capture_disabled: patch.capture_disabled ?? current.capture_disabled,
    analysis_disabled: patch.analysis_disabled ?? current.analysis_disabled,
    retention_candidate_days:
      patch.retention_candidate_days === null
        ? undefined
        : (patch.retention_candidate_days ?? current.retention_candidate_days),
    external_analysis_opt_in:
      patch.external_analysis_opt_in ?? current.external_analysis_opt_in,
    export_disabled: patch.export_disabled ?? current.export_disabled,
    version: current.version + 1,
    updated_at: now.toISOString(),
  };
}

function policyHash(policy: ProjectPolicy): string {
  return createHmac("sha256", "policy-audit")
    .update(
      JSON.stringify({
        capture_disabled: policy.capture_disabled,
        analysis_disabled: policy.analysis_disabled,
        retention_candidate_days: policy.retention_candidate_days ?? null,
        external_analysis_opt_in: policy.external_analysis_opt_in,
        export_disabled: policy.export_disabled,
        version: policy.version,
      }),
    )
    .digest("hex");
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
  summary TEXT,
  warnings_json TEXT,
  suggestions_json TEXT,
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
CREATE INDEX IF NOT EXISTS idx_prompt_usage_events_prompt_id
  ON prompt_usage_events(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_events_type_created_at
  ON prompt_usage_events(event_type, created_at DESC);
`;
