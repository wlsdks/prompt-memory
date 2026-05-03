import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory } from "../../config/config.js";
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
  it("renders capture on with latest score when server, token, hook, and archive are healthy", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    const init = initializePromptMemory({ dataDir });
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

    expect(line).toContain("PM capture on");
    expect(line).toContain("\nPM score");
    expect(line).toContain("score");
    expect(line).toContain("needs_work");
    expect(line).toContain("server ok");
    expect(line).toContain("ingest ok");
    expect(line).toContain("try /prompt-memory:improve-last");
    expect(line).not.toContain("sk-proj-1234567890abcdef");
    expect(line).not.toContain("/Users/example");
  });

  it("renders setup hints when capture is not ready", async () => {
    const dir = createTempDir();

    const line = await renderClaudeCodeStatusLine({
      dataDir: join(dir, "missing"),
      settingsPath: join(dir, "settings.json"),
      checkServer: async () => false,
    });

    expect(line).toBe("PM setup needed | server down | hook missing");
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
      "prompt-memory statusline claude-code",
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
      "prompt-memory statusline claude-code",
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
      "prompt-memory statusline claude-code",
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

  it("uninstalls only prompt-memory statusLine entries", () => {
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
  it("prints prompt-memory on a separate line after an existing status line", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptMemoryCommand: "prompt-memory",
      runCommand: (command) => ({
        stdout: command === "previous" ? "HUD ready\n" : "PM capture on\n",
      }),
    });

    expect(line).toBe("HUD ready\nPM capture on");
  });

  it("preserves multiline output from an existing Claude Code status line", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptMemoryCommand: "prompt-memory",
      runCommand: (command) => ({
        stdout:
          command === "previous"
            ? "HUD model line\nHUD context line\n"
            : "PM on | score 23 weak\n",
      }),
    });

    expect(line).toBe(
      "HUD model line\nHUD context line\nPM on | score 23 weak",
    );
  });

  it("preserves multiline prompt-memory output after an existing status line", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptMemoryCommand: "prompt-memory",
      runCommand: (command) => ({
        stdout:
          command === "previous"
            ? "HUD model line\nHUD context line\n"
            : "PM capture on | server ok\nPM score 23/100 weak | gap Goal clarity\n",
      }),
    });

    expect(line).toBe(
      "HUD model line\nHUD context line\nPM capture on | server ok\nPM score 23/100 weak | gap Goal clarity",
    );
  });

  it("keeps prompt-memory output when the previous status line fails", () => {
    const line = renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptMemoryCommand: "prompt-memory",
      runCommand: (command) => ({
        stdout: command === "previous" ? "" : "PM capture on\n",
      }),
    });

    expect(line).toBe("PM capture on");
  });

  it("passes Claude Code statusLine stdin to chained commands", () => {
    const calls: Array<{ command: string; input?: string }> = [];

    renderChainedClaudeCodeStatusLine({
      previousCommand: "previous",
      promptMemoryCommand: "prompt-memory",
      stdin: '{"cwd":"/Users/example/project"}',
      runCommand: (command, input) => {
        calls.push({ command, input });
        return { stdout: command };
      },
    });

    expect(calls).toEqual([
      { command: "previous", input: '{"cwd":"/Users/example/project"}' },
      { command: "prompt-memory", input: '{"cwd":"/Users/example/project"}' },
    ]);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-statusline-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
