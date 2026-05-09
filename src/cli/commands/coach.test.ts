import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptCoach } from "../../config/config.js";
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
    const init = initializePromptCoach({ dataDir });
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
    expect(text).toContain("Agent commands");
    expect(text).toContain("/prompt-coach:coach");
    expect(text).toContain("/prompt-coach:score");
    expect(text).toContain("/prompt-coach:improve-last");
    expect(text).toContain("prompt-coach:coach_prompt");
    expect(text).toContain("prompt-coach buddy");
    expect(text).not.toContain("sk-proj-1234567890abcdef");
    expect(text).not.toContain("/Users/example");
  });

  it("forwards --language ko to the coach so archive output is Korean", async () => {
    const dataDir = createTempDir();
    const init = initializePromptCoach({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-04T16:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-coach-ko",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better",
      },
      new Date("2026-05-04T15:59:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const json = coachPromptForCli({ dataDir, json: true, language: "ko" });
    const result = JSON.parse(json) as {
      archive?: { next_prompt_template?: string };
    };

    expect(result.archive?.next_prompt_template).toContain("목표:");
    expect(result.archive?.next_prompt_template).not.toContain("Goal:");
  });

  it("ignores invalid --language values rather than throwing", async () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });

    expect(() => coachPromptForCli({ dataDir, language: "fr" })).not.toThrow();
  });

  it("honors --no-archive --no-improvement --no-latest-score --no-project-rules", async () => {
    const dataDir = createTempDir();
    const init = initializePromptCoach({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-08T00:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "no-flags",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/proj",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Add caching layer to fetchUser",
      },
      new Date("2026-05-08T00:00:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const program = createProgram();
    program.exitOverride();
    let captured = "";
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      captured += args.join(" ") + "\n";
    };
    try {
      await program.parseAsync(
        [
          "coach",
          "--data-dir",
          dataDir,
          "--json",
          "--no-archive",
          "--no-improvement",
          "--no-latest-score",
          "--no-project-rules",
        ],
        { from: "user" },
      );
    } finally {
      console.log = origLog;
    }
    const parsed = JSON.parse(captured) as {
      archive?: unknown;
      improvement?: unknown;
      latest_score?: unknown;
      project_rules?: unknown;
    };
    expect(parsed.archive).toBeUndefined();
    expect(parsed.improvement).toBeUndefined();
    expect(parsed.latest_score).toBeUndefined();
    expect(parsed.project_rules).toBeUndefined();
  });

  it("keeps empty archive guidance aligned with the coach-first activation path", () => {
    const dataDir = join(tmpdir(), `prompt-coach-empty-coach-${randomUUID()}`);
    tempDirs.push(dataDir);

    const text = coachPromptForCli({ dataDir });

    expect(text).toContain("Prompt-memory is not ready yet.");
    expect(text).toContain("prompt-coach start");
    expect(text).toContain("prompt-coach setup --profile coach --register-mcp");
    expect(text).toContain("prompt-coach server");
    expect(text).toContain("Agent commands");
    expect(text).toContain("prompt-coach start --open-web");
    expect(text).not.toContain(dataDir);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-coach-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
