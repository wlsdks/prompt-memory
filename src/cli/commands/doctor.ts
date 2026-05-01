import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";

import { loadHookAuth, loadPromptMemoryConfig } from "../../config/config.js";
import {
  readLastHookStatus,
  type LastHookStatus,
} from "../../hooks/hook-status.js";
import {
  hasPromptMemoryCodexHook,
  hasPromptMemoryHook,
  isCodexHooksFeatureEnabled,
  type ClaudeSettings,
  type CodexHooksSettings,
} from "./install-hook.js";

export type DoctorClaudeCodeOptions = {
  dataDir?: string;
  settingsPath?: string;
  checkServer?: () => Promise<boolean>;
};

export type DoctorCodexOptions = {
  dataDir?: string;
  hooksPath?: string;
  configPath?: string;
  projectHooksPath?: string;
  projectConfigPath?: string;
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

export type DoctorCodexResult = {
  server: { ok: boolean };
  token: { ok: boolean };
  settings: {
    ok: boolean;
    invalid: boolean;
    hookInstalled: boolean;
    codexHooksEnabled: boolean;
    duplicateHooks: boolean;
    hookSources: string[];
  };
  lastIngestStatus?: LastHookStatus;
};

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .argument("<tool>", "Tool to inspect.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .option("--hooks-path <path>", "Override Codex hooks.json path.")
    .option("--config-path <path>", "Override Codex config.toml path.")
    .option("--project-hooks-path <path>", "Override project Codex hooks path.")
    .option(
      "--project-config-path <path>",
      "Override project Codex config path.",
    )
    .action(
      async (
        tool: string,
        options: DoctorClaudeCodeOptions & DoctorCodexOptions,
      ) => {
        if (tool === "codex") {
          const result = await doctorCodex(options);
          console.log(JSON.stringify(result, null, 2));

          if (!result.server.ok || !result.token.ok || !result.settings.ok) {
            process.exitCode = 1;
          }
          return;
        }

        if (tool !== "claude-code") {
          throw new Error(`Unsupported doctor target: ${tool}`);
        }

        const result = await doctorClaudeCode(options);
        console.log(JSON.stringify(result, null, 2));

        if (!result.server.ok || !result.token.ok || !result.settings.ok) {
          process.exitCode = 1;
        }
      },
    );
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

export async function doctorCodex(
  options: DoctorCodexOptions = {},
): Promise<DoctorCodexResult> {
  const settings = inspectCodexSettings(options);

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

function inspectCodexSettings(
  options: DoctorCodexOptions,
): DoctorCodexResult["settings"] {
  const sources = [
    {
      name: "user",
      hooksPath: options.hooksPath ?? defaultCodexHooksPath(),
      configPath: options.configPath ?? defaultCodexConfigPath(),
    },
  ];

  if (options.projectHooksPath || options.projectConfigPath) {
    sources.push({
      name: "project",
      hooksPath: options.projectHooksPath ?? "",
      configPath: options.projectConfigPath ?? "",
    });
  }

  const hookSources: string[] = [];
  let invalid = false;
  let codexHooksEnabled = false;

  for (const source of sources) {
    try {
      if (
        source.hooksPath &&
        existsSync(source.hooksPath) &&
        hasPromptMemoryCodexHook(
          JSON.parse(
            readFileSync(source.hooksPath, "utf8"),
          ) as CodexHooksSettings,
        )
      ) {
        hookSources.push(source.name);
      }
    } catch {
      invalid = true;
    }

    try {
      if (
        source.configPath &&
        existsSync(source.configPath) &&
        isCodexHooksFeatureEnabled(readFileSync(source.configPath, "utf8"))
      ) {
        codexHooksEnabled = true;
      }
    } catch {
      invalid = true;
    }
  }

  const hookInstalled = hookSources.length > 0;
  const duplicateHooks = hookSources.length > 1;

  return {
    ok: hookInstalled && codexHooksEnabled && !duplicateHooks && !invalid,
    invalid,
    hookInstalled,
    codexHooksEnabled,
    duplicateHooks,
    hookSources,
  };
}

async function inspectServer(
  options: DoctorClaudeCodeOptions | DoctorCodexOptions,
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

function defaultCodexHooksPath(): string {
  return join(homedir(), ".codex", "hooks.json");
}

function defaultCodexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}
