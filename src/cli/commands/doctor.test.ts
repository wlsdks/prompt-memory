import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory } from "../../config/config.js";
import { writeLastHookStatus } from "../../hooks/hook-status.js";
import { installClaudeCodeHook, installCodexHook } from "./install-hook.js";
import { doctorClaudeCode, doctorCodex, formatDoctorResult } from "./doctor.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("doctorClaudeCode", () => {
  it("detects missing server and token", async () => {
    const dir = createTempDir();

    const result = await doctorClaudeCode({
      dataDir: join(dir, "missing-data"),
      settingsPath: join(dir, "settings.json"),
      mcpConfigPath: join(dir, "claude.json"),
      checkServer: async () => false,
    });

    expect(result.server.ok).toBe(false);
    expect(result.token.ok).toBe(false);
    expect(result.settings.hookInstalled).toBe(false);
  });

  it("detects invalid settings JSON", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    writeFileSync(settingsPath, "{not-json");

    const result = await doctorClaudeCode({
      dataDir,
      settingsPath,
      mcpConfigPath: join(dir, "claude.json"),
      checkServer: async () => true,
    });

    expect(result.settings.ok).toBe(false);
    expect(result.settings.invalid).toBe(true);
  });

  it("detects installed hook and last ingest status", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    writeLastHookStatus(dataDir, {
      ok: false,
      status: 503,
      checked_at: "2026-05-01T00:00:00.000Z",
    });

    const result = await doctorClaudeCode({
      dataDir,
      settingsPath,
      mcpConfigPath: join(dir, "claude.json"),
      checkServer: async () => true,
    });

    expect(result.server.ok).toBe(true);
    expect(result.token.ok).toBe(true);
    expect(result.settings.ok).toBe(true);
    expect(result.settings.hookInstalled).toBe(true);
    expect(result.mcp.registered).toBe(false);
    expect(result.lastIngestStatus).toEqual({
      ok: false,
      status: 503,
      checked_at: "2026-05-01T00:00:00.000Z",
    });
  });

  it("formats Claude Code doctor output with next actions", async () => {
    const dir = createTempDir();

    const result = await doctorClaudeCode({
      dataDir: join(dir, "missing-data"),
      settingsPath: join(dir, "settings.json"),
      mcpConfigPath: join(dir, "claude.json"),
      checkServer: async () => false,
    });

    const output = formatDoctorResult("claude-code", result);

    expect(output).toContain("prompt-memory doctor: claude-code");
    expect(output).toContain("Status: needs attention");
    expect(output).toContain("Local server: not reachable");
    expect(output).toContain("MCP command access: not detected");
    expect(output).toContain("Register MCP: claude mcp add");
    expect(output).toContain("prompt-memory setup --profile coach");
    expect(output).toContain("Use --json for automation.");
  });

  it("recommends reinstalling the hook when last ingest returned 401 and no other cause is detected", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    writeLastHookStatus(dataDir, {
      ok: false,
      status: 401,
      checked_at: "2026-05-04T00:00:00.000Z",
    });

    const options = {
      dataDir,
      settingsPath,
      mcpConfigPath: join(dir, "claude.json"),
      checkServer: async () => true,
    };
    const result = await doctorClaudeCode(options);

    const output = formatDoctorResult("claude-code", result, options);

    expect(output).toContain("Last ingest: failed (401)");
    expect(output).toContain(
      "Reinstall the hook to refresh the local ingest token: prompt-memory install-hook claude-code.",
    );
  });

  it("recommends buddy diagnostics when last ingest failed for a non-token reason", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    writeLastHookStatus(dataDir, {
      ok: false,
      status: 503,
      checked_at: "2026-05-04T00:00:00.000Z",
    });

    const options = {
      dataDir,
      settingsPath,
      mcpConfigPath: join(dir, "claude.json"),
      checkServer: async () => true,
    };
    const result = await doctorClaudeCode(options);

    const output = formatDoctorResult("claude-code", result, options);

    expect(output).toContain("Last ingest: failed (503)");
    expect(output).toContain(
      "Run prompt-memory buddy --once to inspect the most recent failed hook ingest.",
    );
  });

  it("detects Claude Code MCP registration when config includes prompt-memory mcp", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    const mcpConfigPath = join(dir, "claude.json");
    initializePromptMemory({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    writeFileSync(
      mcpConfigPath,
      JSON.stringify({
        mcpServers: {
          "prompt-memory": {
            command: "prompt-memory",
            args: ["mcp"],
          },
        },
      }),
    );

    const result = await doctorClaudeCode({
      dataDir,
      settingsPath,
      mcpConfigPath,
      checkServer: async () => true,
    });

    expect(result.mcp.registered).toBe(true);
    expect(formatDoctorResult("claude-code", result)).toContain(
      "MCP command access: registered",
    );
  });

  it("detects Claude Code MCP registration from read-only mcp list fallback", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    const commands: string[] = [];
    initializePromptMemory({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });

    const result = await doctorClaudeCode({
      dataDir,
      settingsPath,
      mcpConfigPath: join(dir, "missing-claude-mcp.json"),
      checkServer: async () => true,
      commandRunner: (command, args) => {
        commands.push([command, ...args].join(" "));
        return {
          status: 0,
          stdout: "prompt-memory  prompt-memory mcp\n",
        };
      },
    });

    expect(commands).toEqual(["claude mcp list"]);
    expect(result.mcp.registered).toBe(true);
  });

  it("keeps Claude Code MCP missing when mcp list fallback fails", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });

    const result = await doctorClaudeCode({
      dataDir,
      settingsPath,
      mcpConfigPath: join(dir, "missing-claude-mcp.json"),
      checkServer: async () => true,
      commandRunner: () => ({
        status: 1,
        stderr: "no mcp server registered",
      }),
    });

    expect(result.mcp.registered).toBe(false);
  });
});

describe("doctorCodex", () => {
  it("detects missing Codex feature flag and hook", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    initializePromptMemory({ dataDir });

    const result = await doctorCodex({
      dataDir,
      hooksPath: join(dir, ".codex", "hooks.json"),
      configPath: join(dir, ".codex", "config.toml"),
      mcpConfigPath: join(dir, "missing-codex-mcp.toml"),
      checkServer: async () => true,
      commandRunner: () => ({ status: 1, stderr: "no mcp server registered" }),
    });

    expect(result.server.ok).toBe(true);
    expect(result.token.ok).toBe(true);
    expect(result.settings.hookInstalled).toBe(false);
    expect(result.settings.codexHooksEnabled).toBe(false);
    expect(result.settings.duplicateHooks).toBe(false);
    expect(result.settings.ok).toBe(false);
    expect(result.mcp.registered).toBe(false);
  });

  it("detects installed Codex hook and enabled feature flag", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    initializePromptMemory({ dataDir });
    installCodexHook({ dataDir, hooksPath, configPath });
    writeFileSync(
      configPath,
      `${readFileSync(configPath, "utf8")}\n[mcp_servers.prompt-memory]\ncommand = "prompt-memory"\nargs = ["mcp"]\n`,
    );

    const result = await doctorCodex({
      dataDir,
      hooksPath,
      configPath,
      checkServer: async () => true,
    });

    expect(result.settings.ok).toBe(true);
    expect(result.settings.hookInstalled).toBe(true);
    expect(result.settings.codexHooksEnabled).toBe(true);
    expect(result.mcp.registered).toBe(true);
    expect(result.settings.duplicateHooks).toBe(false);
  });

  it("detects duplicate Codex hooks across user and project sources", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    const projectHooksPath = join(dir, "project", ".codex", "hooks.json");
    const projectConfigPath = join(dir, "project", ".codex", "config.toml");
    initializePromptMemory({ dataDir });
    installCodexHook({ dataDir, hooksPath, configPath });
    installCodexHook({
      dataDir,
      hooksPath: projectHooksPath,
      configPath: projectConfigPath,
    });

    const result = await doctorCodex({
      dataDir,
      hooksPath,
      configPath,
      projectHooksPath,
      projectConfigPath,
      checkServer: async () => true,
    });

    expect(result.settings.hookInstalled).toBe(true);
    expect(result.settings.codexHooksEnabled).toBe(true);
    expect(result.settings.duplicateHooks).toBe(true);
    expect(result.settings.ok).toBe(false);
  });

  it("formats Codex doctor output with hook and feature flag status", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    initializePromptMemory({ dataDir });

    const result = await doctorCodex({
      dataDir,
      hooksPath: join(dir, ".codex", "hooks.json"),
      configPath: join(dir, ".codex", "config.toml"),
      mcpConfigPath: join(dir, "missing-codex-mcp.toml"),
      checkServer: async () => true,
      commandRunner: () => ({ status: 1, stderr: "no mcp server registered" }),
    });

    const output = formatDoctorResult("codex", result);

    expect(output).toContain("prompt-memory doctor: codex");
    expect(output).toContain("Codex hook: missing");
    expect(output).toContain("hooks disabled");
    expect(output).toContain("MCP command access: not detected");
    expect(output).toContain("Register MCP: codex mcp add prompt-memory");
    expect(output).toContain("Run prompt-memory install-hook codex");
  });

  it("detects Codex MCP registration from read-only mcp list fallback", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const hooksPath = join(dir, ".codex", "hooks.json");
    const configPath = join(dir, ".codex", "config.toml");
    const commands: string[] = [];
    initializePromptMemory({ dataDir });
    installCodexHook({ dataDir, hooksPath, configPath });

    const result = await doctorCodex({
      dataDir,
      hooksPath,
      configPath,
      mcpConfigPath: join(dir, "missing-codex-mcp.toml"),
      checkServer: async () => true,
      commandRunner: (command, args) => {
        commands.push([command, ...args].join(" "));
        return {
          status: 0,
          stdout:
            "Name             Command\nprompt-memory    prompt-memory mcp\n",
        };
      },
    });

    expect(commands).toEqual(["codex mcp list"]);
    expect(result.mcp.registered).toBe(true);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-doctor-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
