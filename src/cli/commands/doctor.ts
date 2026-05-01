import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";

import { loadHookAuth, loadPromptMemoryConfig } from "../../config/config.js";
import {
  readLastHookStatus,
  type LastHookStatus,
} from "../../hooks/hook-status.js";
import { hasPromptMemoryHook, type ClaudeSettings } from "./install-hook.js";

export type DoctorClaudeCodeOptions = {
  dataDir?: string;
  settingsPath?: string;
  checkServer?: () => Promise<boolean>;
};

export type DoctorClaudeCodeResult = {
  server: { ok: boolean };
  token: { ok: boolean };
  settings: {
    ok: boolean;
    invalid: boolean;
    hookInstalled: boolean;
  };
  lastIngestStatus?: LastHookStatus;
};

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .argument("<tool>", "Tool to inspect.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .action(async (tool: string, options: DoctorClaudeCodeOptions) => {
      if (tool !== "claude-code") {
        throw new Error(`Unsupported doctor target: ${tool}`);
      }

      const result = await doctorClaudeCode(options);
      console.log(JSON.stringify(result, null, 2));

      if (!result.server.ok || !result.token.ok || !result.settings.ok) {
        process.exitCode = 1;
      }
    });
}

export async function doctorClaudeCode(
  options: DoctorClaudeCodeOptions = {},
): Promise<DoctorClaudeCodeResult> {
  const settings = inspectSettings(
    options.settingsPath ?? defaultClaudeSettingsPath(),
  );

  return {
    server: { ok: await inspectServer(options) },
    token: { ok: inspectToken(options.dataDir) },
    settings,
    lastIngestStatus: readLastHookStatus(options.dataDir),
  };
}

function inspectToken(dataDir?: string): boolean {
  try {
    return loadHookAuth(dataDir).ingest_token.length > 0;
  } catch {
    return false;
  }
}

function inspectSettings(
  settingsPath: string,
): DoctorClaudeCodeResult["settings"] {
  if (!existsSync(settingsPath)) {
    return { ok: false, invalid: false, hookInstalled: false };
  }

  try {
    const settings = JSON.parse(
      readFileSync(settingsPath, "utf8"),
    ) as ClaudeSettings;
    const hookInstalled = hasPromptMemoryHook(settings);
    return { ok: hookInstalled, invalid: false, hookInstalled };
  } catch {
    return { ok: false, invalid: true, hookInstalled: false };
  }
}

async function inspectServer(
  options: DoctorClaudeCodeOptions,
): Promise<boolean> {
  if (options.checkServer) {
    return options.checkServer();
  }

  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);

    try {
      const response = await fetch(
        `http://${config.server.host}:${config.server.port}/api/v1/health`,
        { signal: controller.signal },
      );
      return response.ok;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

function defaultClaudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}
