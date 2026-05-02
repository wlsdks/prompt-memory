import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { runSetup } from "./setup.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("runSetup", () => {
  it("initializes storage, installs detected hooks, and installs a macOS service", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, ".claude", "settings.json");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    const plistPath = join(
      dir,
      "LaunchAgents",
      "com.prompt-memory.server.plist",
    );

    const result = runSetup({
      dataDir,
      settingsPath,
      hooksPath,
      configPath,
      plistPath,
      platform: "darwin",
      detectedTools: ["claude-code", "codex"],
      startService: false,
    });

    expect(result.dataDir).toBe(dataDir);
    expect(result.hooks.claudeCode?.installed).toBe(true);
    expect(result.hooks.codex?.installed).toBe(true);
    expect(result.service.supported).toBe(true);
    expect(result.service.installed).toBe(true);
    expect(existsSync(join(dataDir, "config.json"))).toBe(true);
    expect(readFileSync(settingsPath, "utf8")).toContain(
      "prompt-memory hook claude-code",
    );
    expect(readFileSync(hooksPath, "utf8")).toContain(
      "prompt-memory hook codex",
    );
    expect(readFileSync(configPath, "utf8")).toContain("codex_hooks = true");
    expect(readFileSync(plistPath, "utf8")).toContain(
      "com.prompt-memory.server",
    );
  });

  it("dry-run reports intended work without writing files", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, ".claude", "settings.json");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    const plistPath = join(
      dir,
      "LaunchAgents",
      "com.prompt-memory.server.plist",
    );

    const result = runSetup({
      dataDir,
      settingsPath,
      hooksPath,
      configPath,
      plistPath,
      platform: "darwin",
      detectedTools: ["claude-code"],
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.hooks.claudeCode?.installed).toBe(true);
    expect(result.hooks.codex).toBeUndefined();
    expect(result.service.installed).toBe(true);
    expect(existsSync(dataDir)).toBe(false);
    expect(existsSync(settingsPath)).toBe(false);
    expect(existsSync(hooksPath)).toBe(false);
    expect(existsSync(configPath)).toBe(false);
    expect(existsSync(plistPath)).toBe(false);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-setup-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
