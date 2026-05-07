import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Command } from "commander";

import { resolveCliEntryPath } from "../entry-path.js";
import type { LastHookStatus } from "../../hooks/hook-status.js";
import {
  scorePromptTool,
  type ScorePromptToolResult,
} from "../../mcp/score-tool.js";
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

type ChainedStatusLineOptions = {
  previous: string;
  promptMemory: string;
};

type RenderChainedStatusLineOptions = {
  previousCommand: string;
  promptMemoryCommand: string;
  stdin?: string;
  runCommand?: StatusLineCommandRunner;
};

type StatusLineCommandRunner = (
  command: string,
  input: string | undefined,
) => {
  stdout?: string | Buffer | null;
};

const STATUSLINE_MARKER = "prompt-memory statusline claude-code";

export function registerStatusLineCommand(program: Command): void {
  registerRenderStatusLineCommand(program);
  registerChainedStatusLineCommand(program);
  registerInstallStatusLineCommand(program);
  registerUninstallStatusLineCommand(program);
}

function registerRenderStatusLineCommand(program: Command): void {
  program
    .command("statusline")
    .argument("<tool>", "Tool to render a status line for.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .action(async (tool: string, options: StatusLineOptions) => {
      if (tool !== "claude-code") {
        throw new Error(
          `Unsupported statusline target: ${tool}. Use claude-code.`,
        );
      }

      console.log(await renderClaudeCodeStatusLine(options));
    });
}

function registerChainedStatusLineCommand(program: Command): void {
  program
    .command("statusline-chain")
    .argument("<tool>", "Tool to render a chained status line for.")
    .requiredOption("--previous <base64url>", "Previous status line command.")
    .requiredOption(
      "--prompt-memory <base64url>",
      "prompt-memory status line command.",
    )
    .action((tool: string, options: ChainedStatusLineOptions) => {
      if (tool !== "claude-code") {
        throw new Error(
          `Unsupported statusline target: ${tool}. Use claude-code.`,
        );
      }

      console.log(
        renderChainedClaudeCodeStatusLine({
          previousCommand: decodeStatusLineCommand(options.previous),
          promptMemoryCommand: decodeStatusLineCommand(options.promptMemory),
          stdin: readStatusLineStdin(),
        }),
      );
    });
}

function registerInstallStatusLineCommand(program: Command): void {
  program
    .command("install-statusline")
    .argument("<tool>", "Tool to install status line for.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--dry-run", "Preview settings change without writing.")
    .action((tool: string, options: StatusLineInstallOptions) => {
      if (tool !== "claude-code") {
        throw new Error(
          `Unsupported statusline target: ${tool}. Use claude-code.`,
        );
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
}

function registerUninstallStatusLineCommand(program: Command): void {
  program
    .command("uninstall-statusline")
    .argument("<tool>", "Tool to uninstall status line for.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .action((tool: string, options: StatusLineInstallOptions) => {
      if (tool !== "claude-code") {
        throw new Error(
          `Unsupported statusline target: ${tool}. Use claude-code.`,
        );
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
  const readinessParts = [
    ready
      ? "PM capture on"
      : configured
        ? "PM capture paused"
        : "PM setup needed",
  ];

  readinessParts.push(result.server.ok ? "server ok" : "server down");

  let coachingLine: string | undefined;

  if (ready) {
    coachingLine = formatLatestScoreForStatusLine(
      scorePromptTool(
        { latest: true, include_suggestions: false },
        { dataDir: options.dataDir },
      ),
    );
  }

  if (!result.settings.hookInstalled) {
    readinessParts.push("hook missing");
  } else if (!result.token.ok) {
    readinessParts.push("token missing");
  } else {
    const ingest = formatLastIngest(result.lastIngestStatus);
    if (ingest) {
      readinessParts.push(ingest);
    }
  }

  return [readinessParts.join(" | "), coachingLine].filter(Boolean).join("\n");
}

export function renderChainedClaudeCodeStatusLine(
  options: RenderChainedStatusLineOptions,
): string {
  const runCommand = options.runCommand ?? runStatusLineCommand;
  const previous = normalizePreviousStatusLineOutput(
    runCommand(options.previousCommand, options.stdin).stdout,
  );
  const promptMemory = normalizePromptMemoryStatusLineOutput(
    runCommand(options.promptMemoryCommand, options.stdin).stdout,
  );

  return [previous, promptMemory].filter(Boolean).join("\n");
}

function formatLatestScoreForStatusLine(
  result: ScorePromptToolResult,
): string | undefined {
  if ("is_error" in result) {
    return undefined;
  }

  const gap = result.checklist.find(
    (item) => item.status === "missing" || item.status === "weak",
  );
  const score = `PM score ${result.quality_score.value}/${result.quality_score.max} ${result.quality_score.band}`;

  return gap
    ? `${score} | gap ${gap.label} | try /prompt-memory:improve-last`
    : score;
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
    return "ingest ok";
  }

  return `ingest failed${status.status ? ` ${status.status}` : ""}`;
}

function ensureStatusLine(
  settings: StatusLineSettings,
  command: string,
): StatusLineSettings {
  const currentCommand = settings.statusLine?.command;
  const previousCommand = currentCommand
    ? (extractPreviousStatusLineCommand(currentCommand) ??
      (isPromptMemoryStatusLine(currentCommand) ? undefined : currentCommand))
    : undefined;

  return {
    ...settings,
    statusLine: {
      type: "command",
      command: previousCommand
        ? buildChainedStatusLineCommand(previousCommand, command)
        : command,
    },
  };
}

function removeStatusLine(settings: StatusLineSettings): StatusLineSettings {
  const command = settings.statusLine?.command;

  if (!command || !isPromptMemoryStatusLine(command)) {
    return settings;
  }

  const previousCommand = extractPreviousStatusLineCommand(command);
  if (previousCommand) {
    return {
      ...settings,
      statusLine: {
        type: "command",
        command: previousCommand,
      },
    };
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

function buildChainedStatusLineCommand(
  previousCommand: string,
  promptMemoryCommand: string,
): string {
  return `${markerAssignment(STATUSLINE_MARKER)} ${shellQuote(
    process.execPath,
  )} ${shellQuote(cliEntryPath())} statusline-chain claude-code --previous ${shellQuote(
    encodeStatusLineCommand(previousCommand),
  )} --prompt-memory ${shellQuote(encodeStatusLineCommand(promptMemoryCommand))}`;
}

function isPromptMemoryStatusLine(command: string | undefined): boolean {
  return Boolean(command?.includes(STATUSLINE_MARKER));
}

function extractPreviousStatusLineCommand(command: string): string | undefined {
  const match = command.match(/--previous\s+("(?:\\.|[^"\\])*"|[^\s]+)/);
  if (!match) {
    return undefined;
  }

  const encoded = parseShellQuotedToken(match[1]);
  if (!encoded) {
    return undefined;
  }

  return decodeStatusLineCommand(encoded);
}

function parseShellQuotedToken(token: string): string | undefined {
  if (token.startsWith('"')) {
    try {
      return JSON.parse(token) as string;
    } catch {
      return undefined;
    }
  }

  return token;
}

function encodeStatusLineCommand(command: string): string {
  return Buffer.from(command, "utf8").toString("base64url");
}

function decodeStatusLineCommand(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

function runStatusLineCommand(
  command: string,
  input: string | undefined,
): { stdout: string } {
  const result = spawnSync(command, {
    shell: true,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "ignore"],
    timeout: 1_200,
  });

  return { stdout: result.stdout ?? "" };
}

function readStatusLineStdin(): string | undefined {
  if (process.stdin.isTTY) {
    return undefined;
  }

  try {
    return readFileSync(0, "utf8");
  } catch {
    return undefined;
  }
}

function normalizePreviousStatusLineOutput(
  output: string | Buffer | null | undefined,
): string {
  if (!output) {
    return "";
  }

  return output
    .toString("utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePromptMemoryStatusLineOutput(
  output: string | Buffer | null | undefined,
): string {
  if (!output) {
    return "";
  }

  return output
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function markerAssignment(marker: string): string {
  return `PROMPT_MEMORY_STATUSLINE=${shellQuote(marker)}`;
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function cliEntryPath(): string {
  return resolveCliEntryPath(import.meta.url, "../index.js");
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
