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
import { improvePromptForCli } from "./improve.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("improve CLI", () => {
  it("describes the improve command in top-level help", () => {
    const help = createProgram().helpInformation();

    expect(help).toMatch(
      /improve \[options\]\s+Generate an approval-ready improved prompt locally\./,
    );
  });

  it("prints JSON improvement results from text input", () => {
    const output = improvePromptForCli({
      json: true,
      text: "Make this better",
    });
    const parsed = JSON.parse(output) as {
      improved_prompt: string;
      requires_user_approval: boolean;
    };

    expect(parsed.requires_user_approval).toBe(true);
    expect(parsed.improved_prompt).toContain("Verification");
    expect(parsed.improved_prompt).toContain("Output");
  });

  it("requires explicit text or stdin", () => {
    expect(() => improvePromptForCli({ json: true })).toThrow(
      "--text or --stdin is required",
    );
  });

  it("includes a runnable example in the missing-input error", () => {
    expect(() => improvePromptForCli({ json: true })).toThrow(
      /prompt-memory improve --text/,
    );
  });

  it("prints a privacy-safe improvement for the latest stored prompt", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T14:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-latest-improve",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/private-project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better with token sk-proj-1234567890abcdef",
      },
      new Date("2026-05-03T13:59:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const json = improvePromptForCli({ dataDir, json: true, latest: true });
    const result = JSON.parse(json) as {
      source: string;
      mode: string;
      requires_user_approval: boolean;
      improved_prompt: string;
      privacy: { returns_stored_prompt_body: boolean };
    };

    expect(result.source).toBe("latest");
    expect(result.mode).toBe("copy");
    expect(result.requires_user_approval).toBe(true);
    expect(result.improved_prompt).toContain("Verification");
    expect(result.privacy.returns_stored_prompt_body).toBe(false);
    expect(json).not.toContain("sk-proj-1234567890abcdef");
    expect(json).not.toContain("/Users/example");
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-improve-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
