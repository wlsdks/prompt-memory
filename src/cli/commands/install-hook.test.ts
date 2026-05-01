import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory, loadHookAuth } from "../../config/config.js";
import {
  installClaudeCodeHook,
  uninstallClaudeCodeHook,
} from "./install-hook.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Claude Code hook install/uninstall", () => {
  it("dry-run reports the intended diff without writing settings", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });

    const result = installClaudeCodeHook({
      dataDir,
      settingsPath,
      dryRun: true,
    });

    expect(result.changed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.nextSettings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(() => readFileSync(settingsPath, "utf8")).toThrow();
  });

  it("installs once, preserves unrelated settings, and creates backup", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    writeFileSync(
      settingsPath,
      `${JSON.stringify({ theme: "dark", hooks: { Stop: [] } }, null, 2)}\n`,
    );

    const first = installClaudeCodeHook({ dataDir, settingsPath });
    const second = installClaudeCodeHook({ dataDir, settingsPath });
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(first.backupPath).toBeTruthy();
    expect(settings.theme).toBe("dark");
    expect(settings.hooks.Stop).toEqual([]);
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(settings.hooks.UserPromptSubmit[0].hooks).toHaveLength(1);
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toContain(
      "prompt-memory hook claude-code",
    );
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).not.toContain(
      loadHookAuth(dataDir).ingest_token,
    );
  });

  it("uninstalls hook and revokes the previous ingest token", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    const oldToken = loadHookAuth(dataDir).ingest_token;
    installClaudeCodeHook({ dataDir, settingsPath });

    const result = uninstallClaudeCodeHook({ dataDir, settingsPath });
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

    expect(result.changed).toBe(true);
    expect(settings.hooks.UserPromptSubmit).toEqual([]);
    expect(loadHookAuth(dataDir).ingest_token).not.toBe(oldToken);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-install-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
