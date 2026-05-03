import { readFileSync } from "node:fs";
import type { Command } from "commander";

import {
  improvePrompt,
  type PromptImprovement,
} from "../../analysis/improve.js";
import {
  improvePromptTool,
  type ImprovePromptToolResult,
} from "../../mcp/score-tool.js";

type ImproveCliOptions = {
  dataDir?: string;
  json?: boolean;
  latest?: boolean;
  promptId?: string;
  stdin?: boolean;
  text?: string;
};

export function registerImproveCommand(program: Command): void {
  program
    .command("improve")
    .description("Generate an approval-ready improved prompt locally.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--text <prompt>", "Prompt text to improve.")
    .option("--stdin", "Read prompt text from stdin.")
    .option("--latest", "Improve the latest stored prompt without printing it.")
    .option(
      "--prompt-id <id>",
      "Improve one stored prompt without printing the original prompt body.",
    )
    .option("--json", "Print JSON.")
    .action((options: ImproveCliOptions) => {
      console.log(improvePromptForCli(options));
    });
}

export function improvePromptForCli(options: ImproveCliOptions): string {
  if (options.latest || options.promptId) {
    const result = improvePromptTool(
      options.latest
        ? { latest: true }
        : { prompt_id: options.promptId as string },
      { dataDir: options.dataDir },
    );

    return options.json
      ? JSON.stringify(result, null, 2)
      : formatStoredImprovement(result);
  }

  const prompt = readPromptInput(options);
  const result = improvePrompt({
    prompt,
    createdAt: new Date().toISOString(),
  });

  return options.json
    ? JSON.stringify(result, null, 2)
    : formatImprovement(result);
}

function formatStoredImprovement(result: ImprovePromptToolResult): string {
  if ("is_error" in result) {
    return [
      "Prompt improvement",
      `error ${result.error_code}: ${result.message}`,
      "",
      "Privacy: local-only, no external calls, no stored prompt body.",
    ].join("\n");
  }

  return [
    result.summary,
    "",
    result.improved_prompt,
    "",
    "Next action",
    result.next_action,
    "",
    "Safety",
    ...result.safety_notes.map((note) => `- ${note}`),
    "",
    "Privacy: local-only, no external calls, no stored prompt body.",
  ].join("\n");
}

function readPromptInput(options: ImproveCliOptions): string {
  if (options.text !== undefined) {
    return options.text;
  }

  if (options.stdin) {
    return readFileSync(0, "utf8");
  }

  throw new Error("--text or --stdin is required for prompt improvement.");
}

function formatImprovement(result: PromptImprovement): string {
  return [
    result.summary,
    "",
    result.improved_prompt,
    "",
    "Safety",
    ...result.safety_notes.map((note) => `- ${note}`),
  ].join("\n");
}
