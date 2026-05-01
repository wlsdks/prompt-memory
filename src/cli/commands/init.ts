import type { Command } from "commander";

import { initializePromptMemory } from "../../config/config.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize prompt-memory config and local data directories.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .action((options: { dataDir?: string }) => {
      const result = initializePromptMemory({ dataDir: options.dataDir });

      console.log(`Initialized prompt-memory at ${result.config.data_dir}`);
    });
}
