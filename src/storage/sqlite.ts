import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

import { redactPrompt } from "../redaction/redact.js";
import { createPromptId } from "../shared/ids.js";
import { createStoredContentHash } from "../shared/hashing.js";
import type { RedactionPolicy } from "../shared/schema.js";
import { getPromptMemoryPaths } from "./paths.js";
import type {
  DeletePromptResult,
  ListPromptsOptions,
  PromptDetail,
  PromptListResult,
  PromptReadStoragePort,
  PromptSummary,
  PromptStoragePort,
  SearchPromptsOptions,
  StorePromptInput,
  StorePromptResult,
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

export type AppliedMigration = {
  version: number;
  name: string;
};

export type SqlitePromptStorage = PromptStoragePort &
  PromptReadStoragePort & {
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
      "",
    );
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
  const rows = cursor
    ? (db
        .prepare(
          `
          SELECT * FROM prompts
          WHERE deleted_at IS NULL
            AND (received_at < ? OR (received_at = ? AND id < ?))
          ORDER BY received_at DESC, id DESC
          LIMIT ?
          `,
        )
        .all(
          cursor.received_at,
          cursor.received_at,
          cursor.id,
          limit + 1,
        ) as PromptRow[])
    : (db
        .prepare(
          `
          SELECT * FROM prompts
          WHERE deleted_at IS NULL
          ORDER BY received_at DESC, id DESC
          LIMIT ?
          `,
        )
        .all(limit + 1) as PromptRow[]);

  return toListResult(rows, limit);
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
  const rows = db
    .prepare(
      `
      SELECT p.*
      FROM prompt_fts
      JOIN prompts p ON p.id = prompt_fts.prompt_id
      WHERE prompt_fts MATCH ? AND p.deleted_at IS NULL
      ORDER BY rank
      LIMIT ?
      `,
    )
    .all(match, limit + 1) as PromptRow[];

  return toListResult(rows, limit);
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
    ...toPromptSummary(row),
    markdown: parsePromptMarkdown(row.markdown_path).body,
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
    db.prepare("DELETE FROM redaction_events WHERE prompt_id = ?").run(id);
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

function toListResult(rows: PromptRow[], limit: number): PromptListResult {
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);

  return {
    items: pageRows.map(toPromptSummary),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ received_at: last.received_at, id: last.id })
        : undefined,
  };
}

function toPromptSummary(row: PromptRow): PromptSummary {
  return {
    id: row.id,
    tool: row.tool,
    source_event: row.source_event,
    session_id: row.session_id,
    cwd: row.cwd,
    created_at: row.created_at,
    received_at: row.received_at,
    prompt_length: row.prompt_length,
    is_sensitive: row.is_sensitive === 1,
    excluded_from_analysis: row.excluded_from_analysis === 1,
    redaction_policy: row.redaction_policy,
    adapter_version: row.adapter_version,
    index_status: row.index_status,
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
      .prepare("SELECT id, markdown_path FROM prompts WHERE deleted_at IS NULL")
      .all() as Array<{ id: string; markdown_path: string }>;

    for (const row of rows) {
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
        "",
      );
      db.prepare("UPDATE prompts SET index_status = ? WHERE id = ?").run(
        "indexed",
        row.id,
      );
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
`;
