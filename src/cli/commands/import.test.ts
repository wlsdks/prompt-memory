import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory } from "../../config/config.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { importDryRunForCli, showImportJobForCli } from "./import.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("import CLI", () => {
  it("prints JSON dry-run summaries without raw prompt secrets", () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const file = writeJsonl([
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "session-1",
        cwd: "/Users/example/project",
        prompt: `Store this but redact ${rawSecret}`,
      },
    ]);

    const output = importDryRunForCli({
      dryRun: true,
      file,
      json: true,
      source: "manual-jsonl",
    });

    expect(output).toContain('"prompt_candidates": 1');
    expect(output).not.toContain(rawSecret);
  });

  it("requires dry-run for the first import command", () => {
    expect(() =>
      importDryRunForCli({
        dryRun: false,
        file: "/tmp/missing.jsonl",
        source: "manual-jsonl",
      }),
    ).toThrow("--dry-run is required");
  });

  it("does not mutate prompt storage during dry-run", () => {
    const dataDir = createTempDir("prompt-memory-import-data-");
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
    });
    const file = writeJsonl([
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "session-1",
        cwd: "/Users/example/project",
        prompt: "Dry-run only import candidate.",
      },
    ]);

    try {
      const output = importDryRunForCli({
        dataDir,
        dryRun: true,
        file,
        json: true,
        source: "manual-jsonl",
      });

      expect(output).toContain('"prompt_candidates": 1');
      expect(storage.listPrompts().items).toEqual([]);
      expect(storage.searchPromptIds("candidate")).toEqual([]);
    } finally {
      storage.close();
    }
  });

  it("saves and shows raw-free dry-run jobs when requested", () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const dataDir = createTempDir("prompt-memory-import-job-");
    initializePromptMemory({ dataDir });
    const file = writeJsonl([
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "session-1",
        cwd: "/Users/example/project",
        prompt: `Save this dry-run job without leaking ${rawSecret}`,
      },
    ]);

    const output = importDryRunForCli({
      dataDir,
      dryRun: true,
      file,
      json: true,
      saveJob: true,
      source: "manual-jsonl",
    });
    const parsed = JSON.parse(output) as { job_id: string };
    const shown = showImportJobForCli(parsed.job_id, { dataDir, json: true });

    expect(parsed.job_id).toMatch(/^imp_/);
    expect(shown).toContain('"status": "dry_run_completed"');
    expect(shown).toContain('"prompt_candidates": 1');
    expect(shown).not.toContain(rawSecret);
    expect(shown).not.toContain("/Users/example/project");
  });
});

function writeJsonl(records: Array<Record<string, unknown>>): string {
  const dir = createTempDir("prompt-memory-import-cli-");

  const path = join(dir, "transcript.jsonl");
  writeFileSync(
    path,
    records.map((record) => JSON.stringify(record)).join("\n"),
  );
  return path;
}

function createTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
