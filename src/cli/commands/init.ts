import type { Command } from "commander";

import { initializePromptCoach } from "../../config/config.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize prompt-coach config and local data directories.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .action((options: { dataDir?: string }) => {
      const result = initializePromptCoach({ dataDir: options.dataDir });

      console.log(`Initialized prompt-coach at ${result.config.data_dir}`);
    });
}
