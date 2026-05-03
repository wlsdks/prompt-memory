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
import { coachPromptForCli } from "./coach.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("coach CLI", () => {
  it("describes the coach command in top-level help", () => {
    const help = createProgram().helpInformation();

    expect(help).toMatch(
      /coach \[options\]\s+Run the one-call agent prompt coach workflow\./,
    );
  });

  it("prints a privacy-safe one-call coach report as JSON and text", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T16:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-coach-cli",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/private-project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better with token sk-proj-1234567890abcdef",
      },
      new Date("2026-05-03T15:59:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const json = coachPromptForCli({ dataDir, json: true });
    const result = JSON.parse(json) as {
      mode: string;
      latest_score: { source: string };
      improvement: { requires_user_approval: boolean };
      agent_brief: { next_actions: string[] };
      privacy: { returns_prompt_bodies: boolean; auto_submits: boolean };
    };

    expect(result.mode).toBe("agent_coach");
    expect(result.latest_score.source).toBe("latest");
    expect(result.improvement.requires_user_approval).toBe(true);
    expect(result.agent_brief.next_actions.length).toBeGreaterThan(0);
    expect(result.privacy).toMatchObject({
      returns_prompt_bodies: false,
      auto_submits: false,
    });
    expect(json).not.toContain("sk-proj-1234567890abcdef");
    expect(json).not.toContain("/Users/example");

    const text = coachPromptForCli({ dataDir });

    expect(text).toContain("Prompt Memory Coach");
    expect(text).toContain("Latest prompt");
    expect(text).toContain("Next actions");
    expect(text).not.toContain("sk-proj-1234567890abcdef");
    expect(text).not.toContain("/Users/example");
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-coach-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
