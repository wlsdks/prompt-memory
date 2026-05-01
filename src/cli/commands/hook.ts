import type { Command } from "commander";

import {
  readStdin,
  runClaudeCodeHook,
  runCodexHook,
} from "../../hooks/wrapper.js";

export function registerHookCommand(program: Command): void {
  const hook = program
    .command("hook")
    .description("Run prompt-memory hook handlers.");

  hook
    .command("claude-code")
    .description("Handle Claude Code UserPromptSubmit hook payload.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .action(async (options: { dataDir?: string }) => {
      const result = await runClaudeCodeHook({
        stdin: await readStdin(),
        dataDir: options.dataDir,
      });

      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    });

  hook
    .command("codex")
    .description("Handle Codex UserPromptSubmit hook payload.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .action(async (options: { dataDir?: string }) => {
      const result = await runCodexHook({
        stdin: await readStdin(),
        dataDir: options.dataDir,
      });

      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exitCode = result.exitCode;
    });
}
