import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import {
  IMPORT_SOURCE_TYPES,
  parseImportSourceType,
  runImportDryRun,
} from "./dry-run.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("import dry-run", () => {
  it("previews Claude transcript user prompts without returning raw prompt text", () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const file = writeJsonl([
      {
        type: "user",
        session_id: "claude-session",
        cwd: "/Users/example/project",
        message: {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please review this code and keep ${rawSecret} safe.`,
            },
          ],
        },
      },
      {
        type: "assistant",
        message: { role: "assistant", content: "assistant response" },
      },
      {
        type: "tool_result",
        content: "command output should never import",
      },
      "{malformed json",
    ]);

    const result = runImportDryRun({
      file,
      redactionMode: "mask",
      sourceType: "claude-transcript-best-effort",
    });

    expect(result).toMatchObject({
      dry_run: true,
      source_type: "claude-transcript-best-effort",
      records_read: 4,
      prompt_candidates: 1,
      sensitive_prompt_count: 1,
      skipped_records: {
        assistant_or_tool: 2,
      },
      parse_errors: 1,
    });
    expect(JSON.stringify(result)).not.toContain(rawSecret);
    expect(JSON.stringify(result)).not.toContain("assistant response");
    expect(JSON.stringify(result)).not.toContain("command output");
  });

  it("previews Codex transcript user prompts and skips assistant/tool records", () => {
    const file = writeJsonl([
      {
        role: "user",
        session_id: "codex-session",
        turn_id: "turn-1",
        cwd: "/Users/example/project",
        content: "Implement import dry-run and run pnpm test.",
      },
      {
        role: "assistant",
        content: "assistant answer",
      },
      {
        role: "tool",
        content: "tool output",
      },
    ]);

    const result = runImportDryRun({
      file,
      redactionMode: "mask",
      sourceType: "codex-transcript-best-effort",
    });

    expect(result.prompt_candidates).toBe(1);
    expect(result.skipped_records.assistant_or_tool).toBe(2);
    expect(result.samples).toEqual([
      expect.objectContaining({
        record_offset: 0,
        session_id: "codex-session",
        turn_id: "turn-1",
        prompt_preview: expect.stringContaining("Implement import dry-run"),
      }),
    ]);
  });

  it("accepts hook payload records in manual JSONL dry-run", () => {
    const file = writeJsonl([
      {
        hook_event_name: "UserPromptSubmit",
        session_id: "manual-session",
        cwd: "/Users/example/project",
        prompt: "Manual hook payload import candidate.",
      },
    ]);

    const result = runImportDryRun({
      file,
      redactionMode: "mask",
      sourceType: "manual-jsonl",
    });

    expect(result.prompt_candidates).toBe(1);
    expect(result.samples[0]).toMatchObject({
      session_id: "manual-session",
      prompt_preview: "Manual hook payload import candidate.",
      cwd_label: "project",
    });
  });

  it("explains the size limit when the source exceeds maxFileBytes", () => {
    const file = writeJsonl([
      JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "limit-session",
        cwd: "/Users/example/project",
        prompt: "x".repeat(2048),
      }),
    ]);

    expect(() =>
      runImportDryRun({
        file,
        redactionMode: "mask",
        sourceType: "manual-jsonl",
        maxFileBytes: 1024,
      }),
    ).toThrow(/exceeds file size limit\. Got .* MB, limit is .* MB/);
  });

  it("explains a missing source path without leaking the raw OS error", () => {
    const dir = join(tmpdir(), `prompt-coach-missing-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    tempDirs.push(dir);
    const missing = join(dir, "does-not-exist.jsonl");

    let captured: Error | undefined;
    try {
      runImportDryRun({
        file: missing,
        redactionMode: "mask",
        sourceType: "manual-jsonl",
      });
    } catch (error) {
      captured = error as Error;
    }

    expect(captured?.message).toMatch(
      /Import source file not found.*JSONL transcript path with --file/,
    );
    expect(captured?.message).not.toContain(missing);
    expect(captured?.message).not.toContain("ENOENT");
  });

  it("lists valid sources when parseImportSourceType rejects an unknown value", () => {
    expect(() => parseImportSourceType("not-a-real-source")).toThrow(
      /Unsupported import source: not-a-real-source/,
    );
    for (const known of IMPORT_SOURCE_TYPES) {
      expect(() => parseImportSourceType("not-a-real-source")).toThrow(
        new RegExp(known.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    }
  });
});

function writeJsonl(records: Array<Record<string, unknown> | string>): string {
  const dir = join(tmpdir(), `prompt-coach-import-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);

  const path = join(dir, "transcript.jsonl");
  writeFileSync(
    path,
    records
      .map((record) =>
        typeof record === "string" ? record : JSON.stringify(record),
      )
      .join("\n"),
  );
  return path;
}
