import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeImport, type ImportExecutionStorage } from "./execute.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function writeManualJsonl(prompts: string[]): string {
  const dir = join(tmpdir(), `prompt-memory-import-exec-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  const file = join(dir, "transcript.jsonl");
  writeFileSync(
    file,
    prompts
      .map((prompt, index) =>
        JSON.stringify({
          hook_event_name: "UserPromptSubmit",
          prompt,
          session_id: `sess-${index}`,
          cwd: "/Users/me/proj",
        }),
      )
      .join("\n"),
  );
  return file;
}

function buildStorage(
  overrides: Partial<ImportExecutionStorage> = {},
): ImportExecutionStorage {
  const records: Array<{
    job_id: string;
    record_key: string;
    status: string;
    error_code?: string;
    prompt_id?: string;
  }> = [];
  const job = {
    id: "imp_test",
    source_type: "manual-jsonl",
    source_path_hash: "",
    dry_run: false,
    status: "running" as const,
    created_at: "2026-05-08T00:00:00.000Z",
    updated_at: "2026-05-08T00:00:00.000Z",
    summary: undefined,
  };

  return {
    storePrompt: vi.fn(async ({ event }) => ({
      id: `prmt_${event.idempotency_key.slice(-6)}`,
      duplicate: false,
    })),
    getImportJob: vi.fn().mockReturnValue(undefined),
    createImportJob: vi.fn((input) => {
      job.source_type = input.source_type;
      job.source_path_hash = input.source_path_hash;
      return job;
    }),
    listImportRecords: vi.fn().mockReturnValue([]),
    createImportRecord: vi.fn((input) => {
      records.push(input);
      return { ...input, created_at: "2026-05-08T00:00:00.000Z" };
    }),
    completeImportJob: vi.fn((_id, status, summary) => ({
      ...job,
      status,
      summary,
    })),
    listImportJobs: vi.fn().mockReturnValue([]),
    ...overrides,
    // Expose the records buffer for assertions; not part of the port.
    __records: records,
  } as unknown as ImportExecutionStorage;
}

describe("executeImport reject mode", () => {
  let storage: ImportExecutionStorage & {
    __records: Array<{ status: string; error_code?: string }>;
  };

  beforeEach(() => {
    storage = buildStorage() as typeof storage;
  });

  it("skips sensitive prompts when redactionMode is reject and never calls storePrompt", async () => {
    const file = writeManualJsonl([
      "totally innocuous prompt that asks about caching strategies",
      "AKIA0123456789ABCDEF and password=hunter2 should be blocked",
    ]);

    const result = await executeImport(storage, {
      file,
      sourceType: "manual-jsonl",
      redactionMode: "reject",
      defaultCwd: "/Users/me/proj",
    });

    expect(result.imported_count).toBe(1);
    expect(result.skipped_count).toBe(1);
    expect(result.error_count).toBe(0);

    const skipped = storage.__records.find((r) => r.status === "skipped");
    expect(skipped?.error_code).toBe("redaction_rejected");

    expect(storage.storePrompt).toHaveBeenCalledTimes(1);
  });
});
