import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Command } from "commander";

import {
  initializePromptMemory,
  revokeIngestToken,
} from "../../config/config.js";

export type ClaudeSettings = {
  hooks?: Record<string, Array<ClaudeHookGroup>>;
  [key: string]: unknown;
};

export type ClaudeHookGroup = {
  matcher?: string;
  hooks: Array<ClaudeHookHandler>;
};

export type ClaudeHookHandler = {
  type: "command";
  command: string;
  timeout?: number;
};

export type HookInstallOptions = {
  dataDir?: string;
  settingsPath?: string;
  dryRun?: boolean;
};

export type HookInstallResult = {
  changed: boolean;
  dryRun: boolean;
  settingsPath: string;
  backupPath?: string;
  nextSettings: ClaudeSettings & { hooks: Record<string, ClaudeHookGroup[]> };
};

const PROMPT_MEMORY_MARKER = "prompt-memory hook claude-code";

export function registerInstallHookCommands(program: Command): void {
  program
    .command("install-hook")
    .argument("<tool>", "Tool to install hook for.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .option("--dry-run", "Print intended settings change without writing.")
    .action((tool: string, options: HookInstallOptions) => {
      if (tool !== "claude-code") {
        throw new Error(`Unsupported hook target: ${tool}`);
      }

      const result = installClaudeCodeHook(options);
      console.log(
        JSON.stringify(
          {
            changed: result.changed,
            dry_run: result.dryRun,
            settings_path: result.settingsPath,
            backup_path: result.backupPath,
          },
          null,
          2,
        ),
      );
    });

  program
    .command("uninstall-hook")
    .argument("<tool>", "Tool to uninstall hook for.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .action((tool: string, options: HookInstallOptions) => {
      if (tool !== "claude-code") {
        throw new Error(`Unsupported hook target: ${tool}`);
      }

      const result = uninstallClaudeCodeHook(options);
      console.log(
        JSON.stringify(
          {
            changed: result.changed,
            settings_path: result.settingsPath,
            backup_path: result.backupPath,
          },
          null,
          2,
        ),
      );
    });
}

export function installClaudeCodeHook(
  options: HookInstallOptions = {},
): HookInstallResult {
  initializePromptMemory({ dataDir: options.dataDir });

  const settingsPath = options.settingsPath ?? defaultClaudeSettingsPath();
  const current = readSettings(settingsPath);
  const next = ensureHook(current, buildHookCommand(options.dataDir));
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  if (options.dryRun) {
    return {
      changed,
      dryRun: true,
      settingsPath,
      nextSettings: next,
    };
  }

  let backupPath: string | undefined;
  if (changed) {
    mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
    if (existsSync(settingsPath)) {
      backupPath = `${settingsPath}.prompt-memory.${Date.now()}.bak`;
      copyFileSync(settingsPath, backupPath);
    }
    writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  return {
    changed,
    dryRun: false,
    settingsPath,
    backupPath,
    nextSettings: next,
  };
}

export function uninstallClaudeCodeHook(
  options: HookInstallOptions = {},
): HookInstallResult {
  const settingsPath = options.settingsPath ?? defaultClaudeSettingsPath();
  const current = readSettings(settingsPath);
  const next = removeHook(current);
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  let backupPath: string | undefined;
  if (changed) {
    mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
    if (existsSync(settingsPath)) {
      backupPath = `${settingsPath}.prompt-memory.${Date.now()}.bak`;
      copyFileSync(settingsPath, backupPath);
    }
    writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
    });
    revokeIngestToken(options.dataDir);
  }

  return {
    changed,
    dryRun: false,
    settingsPath,
    backupPath,
    nextSettings: next,
  };
}

export function hasPromptMemoryHook(settings: ClaudeSettings): boolean {
  return Boolean(
    settings.hooks?.UserPromptSubmit?.some((group) =>
      group.hooks?.some((hook) => hook.command.includes(PROMPT_MEMORY_MARKER)),
    ),
  );
}

function ensureHook(
  settings: ClaudeSettings,
  command: string,
): ClaudeSettings & { hooks: Record<string, ClaudeHookGroup[]> } {
  const hooks = { ...(settings.hooks ?? {}) };
  const userPromptSubmit = [...(hooks.UserPromptSubmit ?? [])];

  if (!hasPromptMemoryHook(settings)) {
    userPromptSubmit.push({
      hooks: [
        {
          type: "command",
          command,
          timeout: 2,
        },
      ],
    });
  }

  hooks.UserPromptSubmit = userPromptSubmit;

  return {
    ...settings,
    hooks,
  };
}

function removeHook(
  settings: ClaudeSettings,
): ClaudeSettings & { hooks: Record<string, ClaudeHookGroup[]> } {
  const hooks = { ...(settings.hooks ?? {}) };
  const userPromptSubmit = [...(hooks.UserPromptSubmit ?? [])]
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter(
        (hook) => !hook.command.includes(PROMPT_MEMORY_MARKER),
      ),
    }))
    .filter((group) => group.hooks.length > 0);

  hooks.UserPromptSubmit = userPromptSubmit;

  return {
    ...settings,
    hooks,
  };
}

function buildHookCommand(dataDir?: string): string {
  const dataDirArg = dataDir ? ` --data-dir ${JSON.stringify(dataDir)}` : "";
  return `prompt-memory hook claude-code${dataDirArg}`;
}

function readSettings(settingsPath: string): ClaudeSettings {
  if (!existsSync(settingsPath)) {
    return {};
  }

  return JSON.parse(readFileSync(settingsPath, "utf8")) as ClaudeSettings;
}

function defaultClaudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}
