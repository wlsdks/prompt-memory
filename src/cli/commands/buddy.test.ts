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
import { renderBuddyForCli } from "./buddy.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("buddy CLI", () => {
  it("describes the buddy command in top-level help", () => {
    const help = createProgram().helpInformation();

    expect(help).toMatch(
      /buddy \[options\]\s+Show an always-on prompt score buddy for a side terminal pane\./,
    );
  });

  it("renders latest score, habit signal, and privacy notes without prompt bodies", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T18:30:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-buddy-cli",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/private-project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better with token sk-proj-1234567890abcdef",
      },
      new Date("2026-05-03T18:29:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const output = renderBuddyForCli({ dataDir });

    expect(output).toContain("Prompt Memory Buddy");
    expect(output).toContain("Latest prompt");
    expect(output).toContain("Habit");
    expect(output).toContain("Next move");
    expect(output).toContain("Privacy");
    expect(output).toContain("needs_work");
    expect(output).not.toContain("sk-proj-1234567890abcdef");
    expect(output).not.toContain("/Users/example");
  });

  it("prints a machine-readable snapshot for automation", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const json = renderBuddyForCli({ dataDir, json: true });
    const result = JSON.parse(json) as {
      mode: string;
      privacy: { returns_prompt_bodies: boolean };
    };

    expect(result.mode).toBe("buddy");
    expect(result.privacy.returns_prompt_bodies).toBe(false);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-buddy-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
