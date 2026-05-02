import type { Command } from "commander";

import { runPromptMemoryMcpServer } from "../../mcp/server.js";

type McpCliOptions = {
  dataDir?: string;
};

export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Run the local prompt-memory MCP server over stdio.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .action(async (options: McpCliOptions) => {
      await runPromptMemoryMcpServer({ dataDir: options.dataDir });
    });
}
