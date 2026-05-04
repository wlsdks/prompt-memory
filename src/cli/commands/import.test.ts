import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptMemory, loadHookAuth } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { createProgram } from "../index.js";
import { listPromptsForCli } from "./prompts.js";
import {
  importForCli,
  importDryRunForCli,
  showImportJobForCli,
} from "./import.js";

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
  it("describes import commands in the top-level help", () => {
    const help = createProgram().helpInformation();

    expect(help).toMatch(
      /import \[options\]\s+Preview or execute transcript imports\./,
    );
    expect(help).toMatch(
      /import-job \[options\] <id>\s+Show a saved import dry-run job\./,
    );
  });

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

  it("includes a usage example when --dry-run is omitted", () => {
    expect(() =>
      importDryRunForCli({
        dryRun: false,
        file: "/tmp/missing.jsonl",
        source: "manual-jsonl",
      }),
    ).toThrow(/prompt-memory import --dry-run --file/);
  });

  it("includes a usage hint when --file is omitted", () => {
    expect(() =>
      importDryRunForCli({
        dryRun: true,
        source: "manual-jsonl",
      }),
    ).toThrow(/--file <path>/);
  });

  it("does not mutate prompt storage during dry-run", () => {
    const dataDir = createTempDir("prompt-memory-import-data-");
    initializePromptMemory({ dataDir });
    const hmacSecret = loadHookAuth(dataDir).web_session_secret;
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret,
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

  it("resumes a saved dry-run job, imports prompts, and filters imported prompts", async () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const dataDir = createTempDir("prompt-memory-import-execute-");
    initializePromptMemory({ dataDir });
    const file = writeJsonl([
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "session-1",
        cwd: "/Users/example/project",
        prompt: `Import this prompt and mask ${rawSecret}`,
      },
      {
        role: "assistant",
        content: "assistant output should be skipped",
      },
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "session-2",
        cwd: "/Users/example/project",
        prompt: "Second imported prompt with Verification criteria: pnpm test.",
      },
    ]);
    const dryRun = JSON.parse(
      importDryRunForCli({
        dataDir,
        dryRun: true,
        file,
        json: true,
        saveJob: true,
        source: "manual-jsonl",
      }),
    ) as { job_id: string };

    const executed = JSON.parse(
      await importForCli({
        dataDir,
        file,
        json: true,
        resume: dryRun.job_id,
        source: "manual-jsonl",
      }),
    ) as {
      job_id: string;
      status: string;
      imported_count: number;
      skipped_count: number;
    };
    const importedOnly = listPromptsForCli({
      dataDir,
      importJob: dryRun.job_id,
      json: true,
    });
    const shown = showImportJobForCli(dryRun.job_id, { dataDir, json: true });

    expect(executed).toMatchObject({
      job_id: dryRun.job_id,
      status: "completed",
      imported_count: 2,
      skipped_count: 1,
    });
    expect(importedOnly).toContain('"items"');
    expect(importedOnly).toContain("Second imported prompt");
    expect(importedOnly).not.toContain(rawSecret);
    expect(shown).toContain('"status": "completed"');
    expect(shown).not.toContain(rawSecret);
    expect(shown).not.toContain("/Users/example/project");

    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
    });
    try {
      expect(
        storage.listPrompts({ importJobId: dryRun.job_id }).items,
      ).toHaveLength(2);
    } finally {
      storage.close();
    }
  });

  it("skips import candidates when project capture is disabled", async () => {
    const dataDir = createTempDir("prompt-memory-import-policy-");
    initializePromptMemory({ dataDir });
    const hmacSecret = loadHookAuth(dataDir).web_session_secret;
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret,
    });
    try {
      await storeClaudePrompt(storage, {
        cwd: "/Users/example/policy-project",
        prompt: "Existing prompt used to create project policy.",
      });
      const projectId = storage.listProjects().items[0]!.project_id;
      storage.updateProjectPolicy(projectId, { capture_disabled: true }, "web");
    } finally {
      storage.close();
    }

    const file = writeJsonl([
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "session-policy-disabled",
        cwd: "/Users/example/policy-project",
        prompt: "This import candidate should be skipped by project policy.",
      },
    ]);
    const executed = JSON.parse(
      await importForCli({
        dataDir,
        execute: true,
        file,
        json: true,
        source: "manual-jsonl",
      }),
    ) as {
      imported_count: number;
      skipped_count: number;
    };
    const afterImport = createSqlitePromptStorage({
      dataDir,
      hmacSecret,
    });
    try {
      expect(executed).toMatchObject({
        imported_count: 0,
        skipped_count: 1,
      });
      expect(afterImport.listPrompts().items).toHaveLength(1);
    } finally {
      afterImport.close();
    }
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

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  options: { cwd: string; prompt: string },
) {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${randomUUID()}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd: options.cwd,
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: options.prompt,
    },
    new Date("2026-05-02T10:00:00.000Z"),
  );

  return storage.storePrompt({
    event,
    redaction: redactPrompt(event.prompt, "mask"),
  });
}
