import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptMemory } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { createProgram } from "../index.js";
import { exportForCli } from "./export.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("export CLI", () => {
  it("describes anonymized export in the top-level help", () => {
    const help = createProgram().helpInformation();

    expect(help).toMatch(
      /export \[options\]\s+Preview or run anonymized prompt exports\./,
    );
  });

  it("requires --anonymized and shows a runnable example", () => {
    expect(() => exportForCli({ preview: true })).toThrow(
      /--anonymized is required/,
    );
    expect(() => exportForCli({ preview: true })).toThrow(
      /prompt-memory export --anonymized/,
    );
  });

  it("hints at the preview command when --job points at a missing id", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    expect(() =>
      exportForCli({
        anonymized: true,
        dataDir,
        job: "exp_does_not_exist",
        json: true,
      }),
    ).toThrow(/Export job not found: exp_does_not_exist/);
    expect(() =>
      exportForCli({
        anonymized: true,
        dataDir,
        job: "exp_does_not_exist",
        json: true,
      }),
    ).toThrow(/prompt-memory export --anonymized --preview/);
  });

  it("previews and executes anonymized exports without raw ids, paths, or secrets", async () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: "test-secret",
      now: () => new Date("2026-05-02T14:00:00.000Z"),
    });

    try {
      await storeClaudePrompt(storage, {
        prompt: `Fix /Users/example/project/src/secret.ts with ${rawSecret}. Run pnpm test.`,
        receivedAt: "2026-05-02T14:00:00.000Z",
        cwd: "/Users/example/project",
      });
    } finally {
      storage.close();
    }

    const preview = JSON.parse(
      exportForCli({
        anonymized: true,
        dataDir,
        json: true,
        preset: "issue_report_attachment",
        preview: true,
      }),
    ) as { id: string };
    const exported = JSON.parse(
      exportForCli({
        anonymized: true,
        dataDir,
        job: preview.id,
        json: true,
      }),
    ) as { count: number; items: Array<{ prompt: string }> };
    const combined = `${JSON.stringify(preview)}\n${JSON.stringify(exported)}`;

    expect(preview.id).toMatch(/^exp_/);
    expect(exported.count).toBe(1);
    expect(exported.items[0]?.prompt).toContain("[REDACTED:api_key]");
    expect(exported.items[0]?.prompt).toContain("[REDACTED:path]");
    expect(combined).not.toContain("prmt_");
    expect(combined).not.toContain(rawSecret);
    expect(combined).not.toContain("/Users/example");
  });
});

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  options: { prompt: string; receivedAt: string; cwd?: string },
): Promise<{ id: string; duplicate: boolean }> {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${options.receivedAt}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd: options.cwd ?? "/Users/example/project",
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: options.prompt,
    },
    new Date(options.receivedAt),
  );

  return storage.storePrompt({
    event,
    redaction: redactPrompt(event.prompt, "mask"),
  });
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-export-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
