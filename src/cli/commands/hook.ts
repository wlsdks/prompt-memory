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

type HookCliOptions = {
  dataDir?: string;
  rewriteGuard?: string;
  rewriteMinScore?: string;
  rewriteLanguage?: "en" | "ko";
  openWeb?: boolean;
};

export function registerHookCommand(program: Command): void {
  const hook = program
    .command("hook")
    .description("Run prompt-memory hook handlers.");

  hook
    .command("session-start")
    .argument("<tool>", "Tool that triggered SessionStart.")
    .description("Handle Claude Code/Codex SessionStart hook payload.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--open-web", "Open the local web UI for this session.")
    .action(async (tool: string, options: HookCliOptions) => {
      if (tool !== "claude-code" && tool !== "codex") {
        throw new Error(`Unsupported SessionStart hook target: ${tool}`);
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
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
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
    .command("codex")
    .description("Handle Codex UserPromptSubmit hook payload.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
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
