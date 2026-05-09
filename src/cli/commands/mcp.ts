import type { Command } from "commander";

import { runPromptCoachMcpServer } from "../../mcp/server.js";

type McpCliOptions = {
  dataDir?: string;
};

export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Run the local prompt-coach MCP server over stdio.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .action(async (options: McpCliOptions) => {
      await runPromptCoachMcpServer({ dataDir: options.dataDir });
    });
}
