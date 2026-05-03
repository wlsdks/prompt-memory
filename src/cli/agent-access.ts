export type AgentTool = "claude-code" | "codex";

export type AgentCommandSpec = {
  command: string;
  args: string[];
};

export function mcpRegistrationSpec(tool: AgentTool): AgentCommandSpec {
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
        "prompt-memory",
        "mcp",
      ],
    };
  }

  return {
    command: "codex",
    args: ["mcp", "add", "prompt-memory", "--", "prompt-memory", "mcp"],
  };
}

export function mcpListSpec(tool: AgentTool): AgentCommandSpec {
  if (tool === "claude-code") {
    return { command: "claude", args: ["mcp", "list"] };
  }

  return { command: "codex", args: ["mcp", "list"] };
}

export function mcpRegistrationCommand(tool: AgentTool): string {
  const spec = mcpRegistrationSpec(tool);
  return [spec.command, ...spec.args].join(" ");
}

export function doctorCommand(tool: AgentTool): string {
  return `prompt-memory doctor ${tool}`;
}
