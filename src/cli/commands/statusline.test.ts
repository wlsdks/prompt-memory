import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptCoach } from "../../config/config.js";
import { writeLastHookStatus } from "../../hooks/hook-status.js";
import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { installClaudeCodeHook } from "./install-hook.js";
import {
  installClaudeCodeStatusLine,
  renderChainedClaudeCodeStatusLine,
  renderClaudeCodeStatusLine,
  uninstallClaudeCodeStatusLine,
} from "./statusline.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("renderClaudeCodeStatusLine", () => {
  it("renders only the score line when server, token, hook, and last ingest are all healthy", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    const init = initializePromptCoach({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T18:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-statusline-score",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/private-project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better with token sk-proj-1234567890abcdef",
      },
      new Date("2026-05-03T17:59:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();
    writeLastHookStatus(dataDir, {
      ok: true,
      status: 200,
      checked_at: "2026-05-02T00:00:00.000Z",
    });

    const line = await renderClaudeCodeStatusLine({
      dataDir,
      settingsPath,
      checkServer: async () => true,
    });

    // Healthy → single line, no diagnostic row.
    expect(line.split("\n").length).toBe(1);
    expect(line).toMatch(/^prompt: score \d+\/\d+ /);
    expect(line).toContain("needs_work");
    expect(line).toContain("weakest:");
    expect(line).toContain("run: /prompt-coach:improve-last");
    expect(line).not.toContain("archiving");
    expect(line).not.toContain("server ok");
    expect(line).not.toContain("save ok");
    expect(line).not.toContain("PM ");
    expect(line).not.toContain("sk-proj-1234567890abcdef");
    expect(line).not.toContain("/Users/example");
  });

  it("renders a diagnostic line above the score line when last ingest failed", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    const init = initializePromptCoach({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T18:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-statusline-401",
        transcript_path: "/tmp/x/transcript.jsonl",
        cwd: "/tmp/x",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Add tests for the new validation rules.",
      },
      new Date("2026-05-03T17:59:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();
    writeLastHookStatus(dataDir, {
      ok: false,
      status: 401,
      checked_at: "2026-05-02T00:00:00.000Z",
    });

    const line = await renderClaudeCodeStatusLine({
      dataDir,
      settingsPath,
      checkServer: async () => true,
    });

    const rows = line.split("\n");
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain("prompt:");
    expect(rows[0]).toContain("save failed");
    expect(rows[1]).toMatch(/^prompt: score \d+\/\d+ /);
  });

  it("appends a 7-day trend glyph after the band when the archive has enough data", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    const init = initializePromptCoach({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    const now = new Date("2026-05-09T08:00:00.000Z");
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => now,
    });
    const previousAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const recentAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    for (let index = 0; index < 5; index += 1) {
      const event = normalizeClaudeCodePayload(
        {
          session_id: `session-trend-prev-${index}`,
          transcript_path: "/tmp/x/transcript.jsonl",
          cwd: "/tmp/x",
          permission_mode: "default",
          hook_event_name: "UserPromptSubmit",
          prompt: "Old short prompt.",
        },
        previousAt,
      );
      await storage.storePrompt({
        event,
        redaction: redactPrompt(event.prompt, "mask"),
      });
    }
    for (let index = 0; index < 5; index += 1) {
      const event = normalizeClaudeCodePayload(
        {
          session_id: `session-trend-recent-${index}`,
          transcript_path: "/tmp/x/transcript.jsonl",
          cwd: "/tmp/x",
          permission_mode: "default",
          hook_event_name: "UserPromptSubmit",
          prompt:
            "Goal: refactor the login flow. Context: src/auth/. Output: a unified diff. Verification: pnpm test.",
        },
        recentAt,
      );
      await storage.storePrompt({
        event,
        redaction: redactPrompt(event.prompt, "mask"),
      });
    }
    storage.close();
    writeLastHookStatus(dataDir, {
      ok: true,
      status: 200,
      checked_at: "2026-05-02T00:00:00.000Z",
    });

    const line = await renderClaudeCodeStatusLine({
      dataDir,
      settingsPath,
      checkServer: async () => true,
      now: () => now,
    });

    expect(line.split("\n").length).toBe(1);
    expect(line).toMatch(/^prompt: score \d+\/\d+ \w+ [↑→↓] \| weakest: /);
  });

  it("omits the trend glyph when the archive does not have enough recent prompts", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    const init = initializePromptCoach({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T18:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-trend-low",
        transcript_path: "/tmp/x/transcript.jsonl",
        cwd: "/tmp/x",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make it better.",
      },
      new Date("2026-05-03T17:59:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();
    writeLastHookStatus(dataDir, {
      ok: true,
      status: 200,
      checked_at: "2026-05-02T00:00:00.000Z",
    });

    const line = await renderClaudeCodeStatusLine({
      dataDir,
      settingsPath,
      checkServer: async () => true,
    });

    expect(line).not.toMatch(/[↑→↓]/);
  });

  it("renders setup hints in a single line when capture is not ready", async () => {
    const dir = createTempDir();

    const line = await renderClaudeCodeStatusLine({
      dataDir: join(dir, "missing"),
      settingsPath: join(dir, "settings.json"),
      checkServer: async () => false,
    });

    expect(line).toBe("prompt: setup needed | server down | hook missing");
  });
});

describe("installClaudeCodeStatusLine", () => {
  it("writes a Claude Code statusLine command with a backup", () => {
    const dir = createTempDir();
    const settingsPath = join(dir, "settings.json");
    writeFileSync(settingsPath, `${JSON.stringify({ theme: "dark" })}\n`);

    const result = installClaudeCodeStatusLine({ settingsPath });

    expect(result.changed).toBe(true);
    expect(result.backupPath).toBeDefined();
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      theme: string;
      statusLine: { type: string; command: string };
    };
    expect(settings.theme).toBe("dark");
    expect(settings.statusLine.type).toBe("command");
    expect(settings.statusLine.command).toContain(
      "prompt-coach statusline claude-code",
    );
  });

  it("dry-run reports the next statusLine without writing", () => {
    const dir = createTempDir();
    const settingsPath = join(dir, "settings.json");

    const result = installClaudeCodeStatusLine({
      settingsPath,
      dryRun: true,
    });

    expect(result.changed).toBe(true);
    expect(result.nextSettings.statusLine.command).toContain(
      "prompt-coach statusline claude-code",
    );
    expect(() => readFileSync(settingsPath, "utf8")).toThrow();
  });

  it("chains an existing Claude Code statusLine instead of replacing it", () => {
    const dir = createTempDir();
    const settingsPath = join(dir, "settings.json");
    writeFileSync(
      settingsPath,
      `${JSON.stringify({
        statusLine: {
          type: "command",
          command: "claude-hud statusline --compact",
        },
      })}\n`,
    );

    const result = installClaudeCodeStatusLine({ settingsPath });

    expect(result.changed).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      statusLine: { command: string };
    };
    expect(settings.statusLine.command).toContain(
      "prompt-coach statusline claude-code",
    );
    expect(settings.statusLine.command).toContain("statusline-chain");
    expect(settings.statusLine.command).toContain("--previous");
    expect(settings.statusLine.command).not.toContain(
      "claude-hud statusline --compact",
    );
  });

  it("does not wrap an already chained Claude Code statusLine again", () => {
    const dir = createTempDir();
    const settingsPath = join(dir, "settings.json");
    writeFileSync(
      settingsPath,
      `${JSON.stringify({
        statusLine: {
          type: "command",
          command: "claude-hud statusline --compact",
        },
      })}\n`,
    );

    installClaudeCodeStatusLine({ settingsPath });
    const result = installClaudeCodeStatusLine({ settingsPath });

    expect(result.changed).toBe(false);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      statusLine: { command: string };
    };
    expect(settings.statusLine.command.match(/--previous/g)).toHaveLength(1);
  });

  it("restores the previous Claude Code statusLine when uninstalling a chain", () => {
    const dir = createTempDir();
    const settingsPath = join(dir, "settings.json");
    writeFileSync(
      settingsPath,
      `${JSON.stringify({
        statusLine: {
          type: "command",
          command: "claude-hud statusline --compact",
        },
      })}\n`,
    );
    installClaudeCodeStatusLine({ settingsPath });

    const result = uninstallClaudeCodeStatusLine({ settingsPath });

    expect(result.changed).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      statusLine: { type: string; command: string };
    };
    expect(settings.statusLine).toEqual({
      type: "command",
      command: "claude-hud statusline --compact",
    });
  });

  it("uninstalls only prompt-coach statusLine entries", () => {
    const dir = createTempDir();
    const settingsPath = join(dir, "settings.json");
    installClaudeCodeStatusLine({ settingsPath });

    const result = uninstallClaudeCodeStatusLine({ settingsPath });

    expect(result.changed).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      statusLine?: unknown;
    };
    expect(settings.statusLine).toBeUndefined();
  });
});

describe("renderChainedClaudeCodeStatusLine", () => {
  it("prints prompt-coach on a separate line after an existing status line", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptCoachCommand: "prompt-coach",
      runCommand: (command) => ({
        stdout:
          command === "previous"
            ? "HUD ready\n"
            : "prompt: score 23/100 weak\n",
      }),
    });

    expect(line).toBe("HUD ready\nprompt: score 23/100 weak");
  });

  it("preserves multiline output from an existing Claude Code status line", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptCoachCommand: "prompt-coach",
      runCommand: (command) => ({
        stdout:
          command === "previous"
            ? "HUD model line\nHUD context line\n"
            : "prompt: score 23 weak\n",
      }),
    });

    expect(line).toBe(
      "HUD model line\nHUD context line\nprompt: score 23 weak",
    );
  });

  it("preserves multiline prompt-coach output after an existing status line", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptCoachCommand: "prompt-coach",
      runCommand: (command) => ({
        stdout:
          command === "previous"
            ? "HUD model line\nHUD context line\n"
            : "prompt: save failed (HTTP 401)\nprompt: score 23/100 weak | weakest: Goal clarity\n",
      }),
    });

    expect(line).toBe(
      "HUD model line\nHUD context line\nprompt: save failed (HTTP 401)\nprompt: score 23/100 weak | weakest: Goal clarity",
    );
  });

  it("treats an empty chained command as a fail-open no-op rather than throwing", () => {
    // Uses the default runStatusLineCommand path. An empty command would
    // otherwise reach spawnSync and crash with ERR_INVALID_ARG_VALUE,
    // which would surface as a stack trace in the Claude Code statusline.
    expect(() =>
      renderChainedClaudeCodeStatusLine({
        previousCommand: "",
        promptCoachCommand: "",
      }),
    ).not.toThrow();
    expect(
      renderChainedClaudeCodeStatusLine({
        previousCommand: "",
        promptCoachCommand: "",
      }),
    ).toBe("");
  });

  it("keeps prompt-coach output when the previous status line fails", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptCoachCommand: "prompt-coach",
      runCommand: (command) => ({
        stdout: command === "previous" ? "" : "prompt: score 23/100 weak\n",
      }),
    });

    expect(line).toBe("prompt: score 23/100 weak");
  });

  it("passes Claude Code statusLine stdin to chained commands", () => {
    const calls: Array<{ command: string; input?: string }> = [];

    renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptCoachCommand: "prompt-coach",
      stdin: '{"cwd":"/Users/example/project"}',
      runCommand: (command, input) => {
        calls.push({ command, input });
        return { stdout: command };
      },
    });

    expect(calls).toEqual([
      { command: "previous", input: '{"cwd":"/Users/example/project"}' },
      { command: "prompt-coach", input: '{"cwd":"/Users/example/project"}' },
    ]);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-statusline-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
