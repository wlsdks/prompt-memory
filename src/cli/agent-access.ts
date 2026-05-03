export type AgentTool = "claude-code" | "codex";

export function mcpRegistrationCommand(tool: AgentTool): string {
  if (tool === "claude-code") {
    return "claude mcp add --transport stdio prompt-memory -- prompt-memory mcp";
  }

  return "codex mcp add prompt-memory -- prompt-memory mcp";
}

export function doctorCommand(tool: AgentTool): string {
  return `prompt-memory doctor ${tool}`;
}
