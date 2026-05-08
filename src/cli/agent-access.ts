export type AgentTool = "claude-code" | "codex";

export type AgentCommandSpec = {
  command: string;
  args: string[];
};

export type PromptMemoryEntry = {
  command: string;
  args: string[];
};

const DIST_CLI_PATTERN = /[/\\]dist[/\\]cli[/\\]index\.js$/;

export const PUBLISHED_PROMPT_MEMORY_ENTRY: PromptMemoryEntry = {
  command: "prompt-memory",
  args: [],
};

export function defaultPromptMemoryEntry(): PromptMemoryEntry {
  const cliPath = process.argv[1];
  if (typeof cliPath === "string" && DIST_CLI_PATTERN.test(cliPath)) {
    return { command: process.execPath, args: [cliPath] };
  }
  return { ...PUBLISHED_PROMPT_MEMORY_ENTRY };
}

export function mcpRegistrationSpec(
  tool: AgentTool,
  entry: PromptMemoryEntry = defaultPromptMemoryEntry(),
): AgentCommandSpec {
  if (tool === "claude-code") {
    return {
      command: "claude",
      args: [
        "mcp",
        "add",
        "--transport",
        "stdio",
        "prompt-memory",
        "--",
        entry.command,
        ...entry.args,
        "mcp",
      ],
    };
  }

  return {
    command: "codex",
    args: [
      "mcp",
      "add",
      "prompt-memory",
      "--",
      entry.command,
      ...entry.args,
      "mcp",
    ],
  };
}

export function mcpListSpec(tool: AgentTool): AgentCommandSpec {
  if (tool === "claude-code") {
    return { command: "claude", args: ["mcp", "list"] };
  }

  return { command: "codex", args: ["mcp", "list"] };
}

export function mcpRegistrationCommand(
  tool: AgentTool,
  entry?: PromptMemoryEntry,
): string {
  const spec = mcpRegistrationSpec(tool, entry);
  return [spec.command, ...spec.args].join(" ");
}

export function doctorCommand(tool: AgentTool): string {
  return `prompt-memory doctor ${tool}`;
}
