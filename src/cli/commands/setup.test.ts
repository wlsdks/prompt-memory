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

  it("coach profile installs low-friction coaching defaults in one setup run", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, ".claude", "settings.json");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");

    const result = runSetup({
      profile: "coach",
      dataDir,
      settingsPath,
      hooksPath,
      configPath,
      noService: true,
      detectedTools: ["claude-code", "codex"],
    });

    expect(result.profile).toBe("coach");
    expect(result.coach.rewriteGuard).toMatchObject({
      mode: "context",
      minScore: 80,
    });
    expect(result.statusLine.claudeCode?.installed).toBe(true);

    const claudeSettings = readFileSync(settingsPath, "utf8");
    const codexHooks = readFileSync(hooksPath, "utf8");
    expect(claudeSettings).toContain("prompt-memory hook claude-code");
    expect(claudeSettings).toContain("--rewrite-guard");
    expect(claudeSettings).toContain("context");
    expect(claudeSettings).toContain("--rewrite-min-score");
    expect(claudeSettings).toContain("80");
    expect(claudeSettings).toContain("prompt-memory statusline claude-code");
    expect(codexHooks).toContain("prompt-memory hook codex");
    expect(codexHooks).toContain("--rewrite-guard");
    expect(codexHooks).toContain("context");
  });

  it("coach profile can opt into stricter block-and-copy guard", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, ".claude", "settings.json");

    const result = runSetup({
      profile: "coach",
      rewriteGuard: "block-and-copy",
      rewriteMinScore: "65",
      rewriteLanguage: "ko",
      dataDir,
      settingsPath,
      noService: true,
      detectedTools: ["claude-code"],
    });

    expect(result.coach.rewriteGuard).toMatchObject({
      mode: "block-and-copy",
      minScore: 65,
      language: "ko",
    });
    const settings = readFileSync(settingsPath, "utf8");
    expect(settings).toContain("block-and-copy");
    expect(settings).toContain("--rewrite-min-score");
    expect(settings).toContain("65");
    expect(settings).toContain("--rewrite-language");
    expect(settings).toContain("ko");
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-setup-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
