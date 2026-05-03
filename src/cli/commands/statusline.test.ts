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
    expect(line).toContain("score");
    expect(line).toContain("needs_work");
    expect(line).toContain("try improve-last");
    expect(line).toContain("server ok");
    expect(line).toContain("last ingest ok");
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

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-statusline-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
