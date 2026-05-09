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
    const init = initializePromptCoach({ dataDir });
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
    initializePromptCoach({ dataDir });

    const json = renderBuddyForCli({ dataDir, json: true });
    const result = JSON.parse(json) as {
      mode: string;
      privacy: { returns_prompt_bodies: boolean };
    };

    expect(result.mode).toBe("buddy");
    expect(result.privacy.returns_prompt_bodies).toBe(false);
  });

  it("renders a single-line snapshot when --style line is used", async () => {
    const dataDir = createTempDir();
    const init = initializePromptCoach({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T18:30:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-buddy-line",
        transcript_path: "/tmp/x/transcript.jsonl",
        cwd: "/tmp/x",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Add tests covering the new validation rules.",
      },
      new Date("2026-05-03T18:29:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const output = renderBuddyForCli({ dataDir, style: "line" });

    expect(output.trimEnd().includes("\n")).toBe(false);
    expect(output).toContain("pm");
    expect(output).toMatch(/\d+\/100/);
    expect(output).toContain("·");
  });

  it("--style block matches the default multi-line block format", async () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });

    const def = renderBuddyForCli({ dataDir });
    const block = renderBuddyForCli({ dataDir, style: "block" });

    expect(block).toContain("Prompt Memory Buddy");
    expect(def.startsWith("Prompt Memory Buddy")).toBe(true);
    expect(def.split("\n").length).toBe(block.split("\n").length);
  });

  it("--style json is equivalent shape to --json", () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });

    const fromStyle = JSON.parse(
      renderBuddyForCli({ dataDir, style: "json" }),
    ) as { mode: string };
    const fromFlag = JSON.parse(renderBuddyForCli({ dataDir, json: true })) as {
      mode: string;
    };

    expect(fromStyle.mode).toBe("buddy");
    expect(fromFlag.mode).toBe("buddy");
    expect(Object.keys(fromStyle).sort()).toEqual(Object.keys(fromFlag).sort());
  });

  it("rejects unsupported --style values", () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });

    expect(() =>
      renderBuddyForCli({ dataDir, style: "weird" as never }),
    ).toThrow(/style/);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-buddy-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
