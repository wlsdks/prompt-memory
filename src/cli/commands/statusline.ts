import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";

import type { LastHookStatus } from "../../hooks/hook-status.js";
import { doctorClaudeCode } from "./doctor.js";
import type { ClaudeSettings } from "./install-hook.js";

export type StatusLineOptions = {
  dataDir?: string;
  settingsPath?: string;
  checkServer?: () => Promise<boolean>;
};

export type StatusLineInstallOptions = {
  settingsPath?: string;
  dataDir?: string;
  dryRun?: boolean;
};

export type StatusLineSettings = ClaudeSettings & {
  statusLine?: {
    type: "command";
    command: string;
  };
};

export type StatusLineInstallResult = {
  changed: boolean;
  dryRun: boolean;
  settingsPath: string;
  backupPath?: string;
  nextSettings: StatusLineSettings;
};

const STATUSLINE_MARKER = "prompt-memory statusline claude-code";

export function registerStatusLineCommand(program: Command): void {
  program
    .command("statusline")
    .argument("<tool>", "Tool to render a status line for.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .action(async (tool: string, options: StatusLineOptions) => {
      if (tool !== "claude-code") {
        throw new Error(`Unsupported statusline target: ${tool}`);
      }

      console.log(await renderClaudeCodeStatusLine(options));
    });

  program
    .command("install-statusline")
    .argument("<tool>", "Tool to install status line for.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--dry-run", "Preview settings change without writing.")
    .action((tool: string, options: StatusLineInstallOptions) => {
      if (tool !== "claude-code") {
        throw new Error(`Unsupported statusline target: ${tool}`);
      }

      const result = installClaudeCodeStatusLine(options);
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
    .command("uninstall-statusline")
    .argument("<tool>", "Tool to uninstall status line for.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .action((tool: string, options: StatusLineInstallOptions) => {
      if (tool !== "claude-code") {
        throw new Error(`Unsupported statusline target: ${tool}`);
      }

      const result = uninstallClaudeCodeStatusLine(options);
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

export async function renderClaudeCodeStatusLine(
  options: StatusLineOptions = {},
): Promise<string> {
  const result = await doctorClaudeCode(options);
  const configured = result.token.ok && result.settings.hookInstalled;
  const ready = result.server.ok && configured;
  const parts = [
    ready
      ? "PM capture on"
      : configured
        ? "PM capture paused"
        : "PM setup needed",
  ];

  parts.push(result.server.ok ? "server ok" : "server down");

  if (!result.settings.hookInstalled) {
    parts.push("hook missing");
  } else if (!result.token.ok) {
    parts.push("token missing");
  } else {
    const ingest = formatLastIngest(result.lastIngestStatus);
    if (ingest) {
      parts.push(ingest);
    }
  }

  return parts.join(" | ");
}

export function installClaudeCodeStatusLine(
  options: StatusLineInstallOptions = {},
): StatusLineInstallResult {
  const settingsPath = options.settingsPath ?? defaultClaudeSettingsPath();
  const current = readStatusLineSettings(settingsPath);
  const next = ensureStatusLine(
    current,
    buildStatusLineCommand(options.dataDir),
  );
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  if (options.dryRun) {
    return {
      changed,
      dryRun: true,
      settingsPath,
      nextSettings: next,
    };
  }

  const backupPath = changed
    ? writeSettingsWithBackup(settingsPath, next)
    : undefined;

  return {
    changed,
    dryRun: false,
    settingsPath,
    backupPath,
    nextSettings: next,
  };
}

export function uninstallClaudeCodeStatusLine(
  options: StatusLineInstallOptions = {},
): StatusLineInstallResult {
  const settingsPath = options.settingsPath ?? defaultClaudeSettingsPath();
  const current = readStatusLineSettings(settingsPath);
  const next = removeStatusLine(current);
  const changed = JSON.stringify(current) !== JSON.stringify(next);
  const backupPath = changed
    ? writeSettingsWithBackup(settingsPath, next)
    : undefined;

  return {
    changed,
    dryRun: false,
    settingsPath,
    backupPath,
    nextSettings: next,
  };
}

function formatLastIngest(
  status: LastHookStatus | undefined,
): string | undefined {
  if (!status) {
    return undefined;
  }

  if (status.ok) {
    return "last ingest ok";
  }

  return `last ingest failed${status.status ? ` ${status.status}` : ""}`;
}

function ensureStatusLine(
  settings: StatusLineSettings,
  command: string,
): StatusLineSettings {
  return {
    ...settings,
    statusLine: {
      type: "command",
      command,
    },
  };
}

function removeStatusLine(settings: StatusLineSettings): StatusLineSettings {
  if (!isPromptMemoryStatusLine(settings.statusLine?.command)) {
    return settings;
  }

  const next = { ...settings };
  delete next.statusLine;
  return next;
}

function buildStatusLineCommand(dataDir?: string): string {
  const dataDirArg = dataDir ? ` --data-dir ${JSON.stringify(dataDir)}` : "";
  return `${markerAssignment(STATUSLINE_MARKER)} ${shellQuote(
    process.execPath,
  )} ${shellQuote(cliEntryPath())} statusline claude-code${dataDirArg}`;
}

function isPromptMemoryStatusLine(command: string | undefined): boolean {
  return Boolean(command?.includes(STATUSLINE_MARKER));
}

function markerAssignment(marker: string): string {
  return `PROMPT_MEMORY_STATUSLINE=${shellQuote(marker)}`;
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function cliEntryPath(): string {
  return fileURLToPath(new URL("../index.js", import.meta.url));
}

function readStatusLineSettings(settingsPath: string): StatusLineSettings {
  if (!existsSync(settingsPath)) {
    return {};
  }

  return JSON.parse(readFileSync(settingsPath, "utf8")) as StatusLineSettings;
}

function writeSettingsWithBackup(
  settingsPath: string,
  settings: StatusLineSettings,
): string | undefined {
  mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
  const backupPath = existsSync(settingsPath)
    ? `${settingsPath}.prompt-memory.${Date.now()}.bak`
    : undefined;

  if (backupPath) {
    copyFileSync(settingsPath, backupPath);
  }

  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, {
    mode: 0o600,
  });

  return backupPath;
}

function defaultClaudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}
