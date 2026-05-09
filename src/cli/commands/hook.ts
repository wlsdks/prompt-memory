import type { Command } from "commander";

import {
  readStdin,
  runClaudeCodeHook,
  runCodexHook,
} from "../../hooks/wrapper.js";
import { runSessionStartHook } from "../../hooks/session-start.js";
import {
  parsePromptRewriteGuardMode,
  type PromptRewriteGuardMode,
} from "../../hooks/rewrite-guard.js";
import { UserError } from "../user-error.js";
import {
  defaultClaudeSettingsPath,
  defaultCodexHooksPath,
  readClaudeSettings,
  readCodexHooksSettings,
} from "./install-hook.js";

type HookCliOptions = {
  dataDir?: string;
  rewriteGuard?: string;
  rewriteMinScore?: string;
  rewriteLanguage?: "en" | "ko";
  openWeb?: boolean;
};

export type HookStatusReport = {
  tool: "claude-code" | "codex";
  installed: boolean;
  mode: PromptRewriteGuardMode | "unknown";
  minScore?: number;
  language?: "en" | "ko";
  configPath: string;
};

export function registerHookCommand(program: Command): void {
  const hook = program
    .command("hook")
    .description("Run prompt-coach hook handlers.");

  hook
    .command("session-start")
    .argument("<tool>", "Tool that triggered SessionStart.")
    .description("Handle Claude Code/Codex SessionStart hook payload.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option("--open-web", "Open the local web UI for this session.")
    .action(async (tool: string, options: HookCliOptions) => {
      if (tool !== "claude-code" && tool !== "codex") {
        throw new UserError(
          `Unsupported SessionStart hook target: ${tool}. Use claude-code or codex.`,
        );
      }
      const result = await runSessionStartHook({
        stdin: await readStdin(),
        dataDir: options.dataDir,
        openWeb: options.openWeb,
      });

      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    });

  hook
    .command("claude-code")
    .description("Handle Claude Code UserPromptSubmit hook payload.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option(
      "--rewrite-guard <mode>",
      "Opt-in prompt rewrite guard: off, context, ask, or block-and-copy.",
      "off",
    )
    .option(
      "--rewrite-min-score <score>",
      "Only rewrite prompts scoring below this 0-100 threshold.",
    )
    .option(
      "--rewrite-language <language>",
      "Improvement draft language: en or ko.",
    )
    .action(async (options: HookCliOptions) => {
      const result = await runClaudeCodeHook({
        stdin: await readStdin(),
        dataDir: options.dataDir,
        rewriteGuard: toRewriteGuardOptions(options),
      });

      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    });

  hook
    .command("status")
    .description(
      "Show the rewrite-guard mode currently installed for each detected tool.",
    )
    .option(
      "--settings-path <path>",
      "Override Claude Code settings.json path.",
    )
    .option("--hooks-path <path>", "Override Codex hooks.json path.")
    .option("--json", "Print machine-readable JSON.")
    .action(
      (options: {
        settingsPath?: string;
        hooksPath?: string;
        json?: boolean;
      }) => {
        const reports = readHookStatusReports({
          settingsPath: options.settingsPath,
          hooksPath: options.hooksPath,
        });
        if (options.json) {
          process.stdout.write(
            `${JSON.stringify({ tools: reports }, null, 2)}\n`,
          );
          return;
        }
        process.stdout.write(`${formatHookStatusReports(reports)}\n`);
      },
    );

  hook
    .command("codex")
    .description("Handle Codex UserPromptSubmit hook payload.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option(
      "--rewrite-guard <mode>",
      "Opt-in prompt rewrite guard: off, context, ask, or block-and-copy.",
      "off",
    )
    .option(
      "--rewrite-min-score <score>",
      "Only rewrite prompts scoring below this 0-100 threshold.",
    )
    .option(
      "--rewrite-language <language>",
      "Improvement draft language: en or ko.",
    )
    .action(async (options: HookCliOptions) => {
      const result = await runCodexHook({
        stdin: await readStdin(),
        dataDir: options.dataDir,
        rewriteGuard: toRewriteGuardOptions(options),
      });

      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    });
}

export function readHookStatusReports(options: {
  settingsPath?: string;
  hooksPath?: string;
}): HookStatusReport[] {
  const claudePath = options.settingsPath ?? defaultClaudeSettingsPath();
  const codexPath = options.hooksPath ?? defaultCodexHooksPath();
  const claudeSettings = tryRead(() => readClaudeSettings(claudePath));
  const codexSettings = tryRead(() => readCodexHooksSettings(codexPath));

  return [
    parseHookEntries(
      "claude-code",
      claudeSettings.hooks?.UserPromptSubmit ?? [],
      claudePath,
    ),
    parseHookEntries(
      "codex",
      codexSettings.hooks?.UserPromptSubmit ?? [],
      codexPath,
    ),
  ];
}

function tryRead<T extends { hooks?: { UserPromptSubmit?: unknown } }>(
  read: () => T,
): T | { hooks?: undefined } {
  try {
    return read();
  } catch {
    return {};
  }
}

function parseHookEntries(
  tool: "claude-code" | "codex",
  groups: ReadonlyArray<{
    hooks?: ReadonlyArray<{ command?: string }>;
  }>,
  configPath: string,
): HookStatusReport {
  const marker =
    tool === "claude-code"
      ? "prompt-coach hook claude-code"
      : "prompt-coach hook codex";
  for (const group of groups) {
    for (const entry of group.hooks ?? []) {
      const command = entry.command ?? "";
      if (!command.includes(marker)) {
        continue;
      }
      return {
        tool,
        installed: true,
        mode: extractFlagValue(command, "rewrite-guard") as
          | PromptRewriteGuardMode
          | "unknown",
        minScore: parseNumberFlag(command, "rewrite-min-score"),
        language: parseLanguageFlag(command),
        configPath,
      };
    }
  }
  return {
    tool,
    installed: false,
    mode: "unknown",
    configPath,
  };
}

function extractFlagValue(command: string, flag: string): string {
  const match = command.match(new RegExp(`--${flag}\\s+"([^"]+)"`));
  return match?.[1] ?? "off";
}

function parseNumberFlag(command: string, flag: string): number | undefined {
  const raw = command.match(new RegExp(`--${flag}\\s+"([^"]+)"`))?.[1];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseLanguageFlag(command: string): "en" | "ko" | undefined {
  const raw = command.match(/--rewrite-language\s+"([^"]+)"/)?.[1];
  return raw === "en" || raw === "ko" ? raw : undefined;
}

export function formatHookStatusReports(
  reports: readonly HookStatusReport[],
): string {
  const lines = ["prompt-coach hook status", ""];
  for (const report of reports) {
    if (!report.installed) {
      lines.push(`- ${report.tool}: not installed (${report.configPath})`);
      continue;
    }
    const extras: string[] = [];
    if (report.minScore !== undefined) {
      extras.push(`minScore=${report.minScore}`);
    }
    if (report.language) {
      extras.push(`language=${report.language}`);
    }
    const tail = extras.length === 0 ? "" : ` (${extras.join(", ")})`;
    lines.push(`- ${report.tool}: ${report.mode}${tail}`);
  }
  lines.push("");
  lines.push(
    "Switch modes with /prompt-coach:guard or `prompt-coach setup --rewrite-guard <mode>`.",
  );
  return lines.join("\n");
}

function toRewriteGuardOptions(options: HookCliOptions): {
  mode: PromptRewriteGuardMode;
  minScore?: number;
  language?: "en" | "ko";
} {
  const minScore =
    options.rewriteMinScore === undefined
      ? undefined
      : Number(options.rewriteMinScore);

  return {
    mode: parsePromptRewriteGuardMode(options.rewriteGuard),
    ...(Number.isFinite(minScore) ? { minScore } : {}),
    ...(options.rewriteLanguage === "en" || options.rewriteLanguage === "ko"
      ? { language: options.rewriteLanguage }
      : {}),
  };
}
