import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("better-sqlite3 smoke test", () => {
  it("opens an in-memory database", () => {
    const db = new Database(":memory:");
    try {
      const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
      expect(row.ok).toBe(1);
    } finally {
      db.close();
    }
  });

  it("supports WAL mode for file databases", () => {
    const dir = mkdtempSync(join(tmpdir(), "prompt-coach-sqlite-"));
    tempDirs.push(dir);

    const db = new Database(join(dir, "smoke.sqlite"));
    try {
      const mode = db.pragma("journal_mode = WAL", { simple: true });
      expect(String(mode).toLowerCase()).toBe("wal");
    } finally {
      db.close();
    }
  });

  it("supports FTS5 virtual tables", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE VIRTUAL TABLE prompt_fts USING fts5(body);
        INSERT INTO prompt_fts(body) VALUES ('hello prompt memory');
      `);

      const rows = db
        .prepare("SELECT rowid FROM prompt_fts WHERE prompt_fts MATCH ?")
        .all("hello");

      expect(rows).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});
