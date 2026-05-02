import { readFileSync } from "node:fs";
import type { Command } from "commander";

import {
  improvePrompt,
  type PromptImprovement,
} from "../../analysis/improve.js";

type ImproveCliOptions = {
  json?: boolean;
  stdin?: boolean;
  text?: string;
};

export function registerImproveCommand(program: Command): void {
  program
    .command("improve")
    .description("Generate an approval-ready improved prompt locally.")
    .option("--text <prompt>", "Prompt text to improve.")
    .option("--stdin", "Read prompt text from stdin.")
    .option("--json", "Print JSON.")
    .action((options: ImproveCliOptions) => {
      console.log(improvePromptForCli(options));
    });
}

export function improvePromptForCli(options: ImproveCliOptions): string {
  const prompt = readPromptInput(options);
  const result = improvePrompt({
    prompt,
    createdAt: new Date().toISOString(),
  });

  return options.json
    ? JSON.stringify(result, null, 2)
    : formatImprovement(result);
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
