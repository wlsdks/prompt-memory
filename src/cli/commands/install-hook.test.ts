import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory, loadHookAuth } from "../../config/config.js";
import {
  installCodexHook,
  installClaudeCodeHook,
  uninstallCodexHook,
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

  it("can install Claude Code hook with opt-in rewrite guard flags", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });

    const result = installClaudeCodeHook({
      dataDir,
      settingsPath,
      dryRun: true,
      rewriteGuard: "block-and-copy",
      rewriteMinScore: "85",
      rewriteLanguage: "ko",
    });

    const command =
      result.nextSettings.hooks.UserPromptSubmit[0].hooks[0].command;
    expect(command).toContain("prompt-memory hook claude-code");
    expect(command).toContain("--rewrite-guard");
    expect(command).toContain("block-and-copy");
    expect(command).toContain("--rewrite-min-score");
    expect(command).toContain("85");
    expect(command).toContain("--rewrite-language");
    expect(command).toContain("ko");
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

describe("Codex hook install/uninstall", () => {
  it("dry-run reports hooks.json and config.toml changes without writing", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    initializePromptMemory({ dataDir });

    const result = installCodexHook({
      dataDir,
      hooksPath,
      configPath,
      dryRun: true,
    });

    expect(result.changed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.nextHooks.hooks.UserPromptSubmit).toHaveLength(1);
    expect(result.nextConfig).toContain("[features]");
    expect(result.nextConfig).toContain("codex_hooks = true");
    expect(() => readFileSync(hooksPath, "utf8")).toThrow();
    expect(() => readFileSync(configPath, "utf8")).toThrow();
  });

  it("installs once, preserves unrelated hooks/config, and creates backups", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    initializePromptMemory({ dataDir });
    mkdirSync(join(dir, ".codex"), { recursive: true });
    writeFileSync(
      hooksPath,
      `${JSON.stringify(
        {
          hooks: {
            Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }],
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      configPath,
      'model = "gpt-5.5"\n[features]\ncodex_hooks = false\n',
    );

    const first = installCodexHook({ dataDir, hooksPath, configPath });
    const second = installCodexHook({ dataDir, hooksPath, configPath });
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    const config = readFileSync(configPath, "utf8");

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(first.hooksBackupPath).toBeTruthy();
    expect(first.configBackupPath).toBeTruthy();
    expect(hooks.hooks.Stop).toHaveLength(1);
    expect(hooks.hooks.UserPromptSubmit).toHaveLength(1);
    expect(hooks.hooks.UserPromptSubmit[0].hooks[0].command).toContain(
      "prompt-memory hook codex",
    );
    expect(hooks.hooks.UserPromptSubmit[0].hooks[0].command).not.toContain(
      loadHookAuth(dataDir).ingest_token,
    );
    expect(config).toContain('model = "gpt-5.5"');
    expect(config).toContain("codex_hooks = true");
  });

  it("can install Codex hook with opt-in rewrite guard flags", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    initializePromptMemory({ dataDir });

    const result = installCodexHook({
      dataDir,
      hooksPath,
      configPath,
      dryRun: true,
      rewriteGuard: "context",
      rewriteMinScore: "70",
    });

    const command = result.nextHooks.hooks.UserPromptSubmit[0].hooks[0].command;
    expect(command).toContain("prompt-memory hook codex");
    expect(command).toContain("--rewrite-guard");
    expect(command).toContain("context");
    expect(command).toContain("--rewrite-min-score");
    expect(command).toContain("70");
  });

  it("uninstalls hook and revokes the previous ingest token", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    initializePromptMemory({ dataDir });
    const oldToken = loadHookAuth(dataDir).ingest_token;
    installCodexHook({ dataDir, hooksPath, configPath });

    const result = uninstallCodexHook({ dataDir, hooksPath, configPath });
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    const config = readFileSync(configPath, "utf8");

    expect(result.changed).toBe(true);
    expect(hooks.hooks.UserPromptSubmit).toEqual([]);
    expect(config).toContain("codex_hooks = true");
    expect(loadHookAuth(dataDir).ingest_token).not.toBe(oldToken);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-install-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
