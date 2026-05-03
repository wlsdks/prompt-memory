import type { Command } from "commander";

import {
  readStdin,
  runClaudeCodeHook,
  runCodexHook,
} from "../../hooks/wrapper.js";
import {
  parsePromptRewriteGuardMode,
  type PromptRewriteGuardMode,
} from "../../hooks/rewrite-guard.js";

type HookCliOptions = {
  dataDir?: string;
  rewriteGuard?: string;
  rewriteMinScore?: string;
  rewriteLanguage?: "en" | "ko";
};

export function registerHookCommand(program: Command): void {
  const hook = program
    .command("hook")
    .description("Run prompt-memory hook handlers.");

  hook
    .command("claude-code")
    .description("Handle Claude Code UserPromptSubmit hook payload.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option(
      "--rewrite-guard <mode>",
      "Opt-in prompt rewrite guard: off, block-and-copy, or context.",
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
      "Opt-in prompt rewrite guard: off, block-and-copy, or context.",
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
