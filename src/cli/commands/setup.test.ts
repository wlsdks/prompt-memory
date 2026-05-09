import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { formatSetupResult, runSetup, setupNeedsAttention } from "./setup.js";

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
      "com.prompt-coach.server.plist",
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
      "prompt-coach hook claude-code",
    );
    expect(readFileSync(hooksPath, "utf8")).toContain(
      "prompt-coach hook codex",
    );
    expect(readFileSync(configPath, "utf8")).toContain("hooks = true");
    expect(readFileSync(plistPath, "utf8")).toContain(
      "com.prompt-coach.server",
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
      "com.prompt-coach.server.plist",
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
    expect(result.nextSteps).toEqual(
      expect.arrayContaining([
        "Register MCP for agent commands: claude mcp add --transport stdio prompt-coach -- prompt-coach mcp.",
        "Register MCP for agent commands: codex mcp add prompt-coach -- prompt-coach mcp.",
        "Send one real coding prompt in Claude Code or Codex, then run prompt-coach coach.",
      ]),
    );
    expect(
      result.nextSteps.indexOf(
        "Send one real coding prompt in Claude Code or Codex, then run prompt-coach coach.",
      ),
    ).toBeLessThan(
      result.nextSteps.indexOf(
        "Open http://127.0.0.1:17373 when you want archive search, dashboards, or export.",
      ),
    );
    expect(result.statusLine.claudeCode?.installed).toBe(true);

    const claudeSettings = readFileSync(settingsPath, "utf8");
    const codexHooks = readFileSync(hooksPath, "utf8");
    expect(claudeSettings).toContain("prompt-coach hook claude-code");
    expect(claudeSettings).toContain("--rewrite-guard");
    expect(claudeSettings).toContain("context");
    expect(claudeSettings).toContain("--rewrite-min-score");
    expect(claudeSettings).toContain("80");
    expect(claudeSettings).toContain("prompt-coach statusline claude-code");
    expect(codexHooks).toContain("prompt-coach hook codex");
    expect(codexHooks).toContain("--rewrite-guard");
    expect(codexHooks).toContain("context");
  });

  it("setup can opt into opening the web UI on agent session start", () => {
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
      openWeb: true,
      detectedTools: ["claude-code", "codex"],
    });

    expect(result.autoOpenWeb.enabled).toBe(true);
    expect(formatSetupResult(result)).toContain(
      "Auto web open: installed on SessionStart",
    );
    expect(readFileSync(settingsPath, "utf8")).toContain(
      "prompt-coach hook session-start claude-code",
    );
    expect(readFileSync(hooksPath, "utf8")).toContain(
      "prompt-coach hook session-start codex",
    );
  });

  it("previews MCP registration without running external agent commands", () => {
    const commands: string[] = [];

    const result = runSetup({
      profile: "coach",
      dryRun: true,
      noService: true,
      registerMcp: true,
      detectedTools: ["claude-code", "codex"],
      commandRunner: (command, args) => {
        commands.push([command, ...args].join(" "));
        return { status: 0 };
      },
    });

    expect(commands).toEqual([]);
    expect(result.mcp.registerRequested).toBe(true);
    expect(result.mcp.claudeCode).toMatchObject({
      dryRun: true,
      ok: true,
    });
    expect(result.mcp.codex).toMatchObject({
      dryRun: true,
      ok: true,
    });
    expect(formatSetupResult(result)).toContain("Claude Code MCP: preview");
    expect(formatSetupResult(result)).toContain("Codex MCP: preview");
  });

  it("registers MCP only when explicitly requested", () => {
    const commands: string[] = [];

    const result = runSetup({
      profile: "coach",
      noService: true,
      registerMcp: true,
      detectedTools: ["claude-code", "codex"],
      commandRunner: (command, args) => {
        commands.push([command, ...args].join(" "));
        return { status: command === "claude" ? 0 : 1, stderr: "denied" };
      },
    });

    expect(commands).toEqual([
      "claude mcp add --transport stdio prompt-coach -- prompt-coach mcp",
      "codex mcp add prompt-coach -- prompt-coach mcp",
    ]);
    expect(result.mcp.claudeCode).toMatchObject({ ok: true, dryRun: false });
    expect(result.mcp.codex).toMatchObject({
      ok: false,
      dryRun: false,
      error: "denied",
    });
    expect(formatSetupResult(result)).toContain("Claude Code MCP: registered");
    expect(formatSetupResult(result)).toContain("Codex MCP: failed");
    expect(result.nextSteps).toContain(
      "Retry MCP registration: codex mcp add prompt-coach -- prompt-coach mcp.",
    );
    expect(setupNeedsAttention(result, true)).toBe(true);
  });

  it("does not register MCP during default coach setup", () => {
    const commands: string[] = [];

    const result = runSetup({
      profile: "coach",
      noService: true,
      detectedTools: ["claude-code"],
      commandRunner: (command, args) => {
        commands.push([command, ...args].join(" "));
        return { status: 0 };
      },
    });

    expect(commands).toEqual([]);
    expect(result.mcp.registerRequested).toBe(false);
    expect(result.mcp.claudeCode).toBeUndefined();
    expect(result.nextSteps).toContain(
      "Register MCP for agent commands: claude mcp add --transport stdio prompt-coach -- prompt-coach mcp.",
    );
  });

  it("rejects unknown rewrite-guard mode values with a hint at valid options", () => {
    expect(() =>
      runSetup({
        profile: "coach",
        rewriteGuard: "asking",
        noService: true,
        detectedTools: ["claude-code"],
      }),
    ).toThrow(/Unsupported rewrite-guard mode: asking/);
    expect(() =>
      runSetup({
        profile: "coach",
        rewriteGuard: "asking",
        noService: true,
        detectedTools: ["claude-code"],
      }),
    ).toThrow(/Valid modes: off, context, ask, block-and-copy/);
  });

  it("rejects unknown setup profile values with a hint at valid options", () => {
    expect(() =>
      runSetup({
        profile: "cooach",
        noService: true,
        detectedTools: ["claude-code"],
      }),
    ).toThrow(/Unsupported setup profile: cooach/);
    expect(() =>
      runSetup({
        profile: "cooach",
        noService: true,
        detectedTools: ["claude-code"],
      }),
    ).toThrow(/Valid profiles: capture, coach/);
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

  it("formats setup output for humans by default", () => {
    const result = runSetup({
      profile: "coach",
      noService: true,
      detectedTools: ["claude-code", "codex"],
      dryRun: true,
    });

    const output = formatSetupResult(result);

    expect(output).toContain("prompt-coach setup preview");
    expect(output).toContain("Profile: coach");
    expect(output).toContain("Claude Code hook: installed");
    expect(output).toContain("Codex hook: installed");
    expect(output).toContain("First score path:");
    expect(output.indexOf("Send one real coding prompt")).toBeLessThan(
      output.indexOf("If capture does not appear:"),
    );
    expect(output).toContain("Register MCP for agent commands");
    expect(output).toContain("prompt-coach coach");
    expect(output).toContain("/prompt-coach:improve-last");
    expect(output.indexOf("Send one real coding prompt")).toBeLessThan(
      output.indexOf("/prompt-coach:improve-last"),
    );
    expect(output).toContain("Use --json for automation.");
  });

  it("installs the prompt-coach slash commands under <claudeCommandsDir>/prompt-coach", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, ".claude", "settings.json");
    const claudeCommandsDir = join(dir, ".claude", "commands");
    const slashCommandsSourceDir = join(dir, "fake-pm-source");
    mkdirSync(slashCommandsSourceDir, { recursive: true });
    writeFileSync(
      join(slashCommandsSourceDir, "guard.md"),
      "# guard fixture\n",
    );
    writeFileSync(
      join(slashCommandsSourceDir, "improve-last.md"),
      "# improve-last fixture\n",
    );

    const result = runSetup({
      profile: "coach",
      dataDir,
      settingsPath,
      noService: true,
      detectedTools: ["claude-code"],
      claudeCommandsDir,
      slashCommandsSourceDir,
    });

    expect(result.slashCommands.claudeCode?.installedCount).toBe(2);
    expect(result.slashCommands.claudeCode?.namespaceDir).toBe(
      join(claudeCommandsDir, "prompt-coach"),
    );
    expect(
      readFileSync(join(claudeCommandsDir, "prompt-coach", "guard.md"), "utf8"),
    ).toBe("# guard fixture\n");
    expect(formatSetupResult(result)).toContain(
      "Claude Code slash commands: 2 installed",
    );
  });

  it("reports stale slash commands removed by setup", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, ".claude", "settings.json");
    const claudeCommandsDir = join(dir, ".claude", "commands");
    const slashCommandsSourceDir = join(dir, "fake-pm-source");
    mkdirSync(slashCommandsSourceDir, { recursive: true });
    writeFileSync(
      join(slashCommandsSourceDir, "guard.md"),
      "# guard fixture\n",
    );
    const namespaceDir = join(claudeCommandsDir, "prompt-coach");
    mkdirSync(namespaceDir, { recursive: true });
    writeFileSync(join(namespaceDir, "guard.md"), "# guard fixture\n");
    writeFileSync(join(namespaceDir, "score-last.md"), "# stale\n");

    const result = runSetup({
      profile: "coach",
      dataDir,
      settingsPath,
      noService: true,
      detectedTools: ["claude-code"],
      claudeCommandsDir,
      slashCommandsSourceDir,
    });

    expect(result.slashCommands.claudeCode?.removedCount).toBe(1);
    expect(result.slashCommands.claudeCode?.changed).toBe(true);
    expect(formatSetupResult(result)).toContain(
      "Claude Code slash commands: 1 removed",
    );
    expect(existsSync(join(namespaceDir, "score-last.md"))).toBe(false);
  });

  it("respects --skip-slash-commands and reports the slash status as skipped", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, ".claude", "settings.json");
    const claudeCommandsDir = join(dir, ".claude", "commands");

    const result = runSetup({
      profile: "coach",
      dataDir,
      settingsPath,
      noService: true,
      detectedTools: ["claude-code"],
      claudeCommandsDir,
      skipSlashCommands: true,
    });

    expect(result.slashCommands.claudeCode).toBeUndefined();
    expect(formatSetupResult(result)).toContain(
      "Claude Code slash commands: skipped",
    );
    expect(existsSync(join(claudeCommandsDir, "prompt-coach"))).toBe(false);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-setup-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
