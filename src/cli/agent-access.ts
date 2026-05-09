export type AgentTool = "claude-code" | "codex";

export type AgentCommandSpec = {
  command: string;
  args: string[];
};

export type PromptCoachEntry = {
  command: string;
  args: string[];
};

const DIST_CLI_PATTERN = /[/\\]dist[/\\]cli[/\\]index\.js$/;

export const PUBLISHED_PROMPT_COACH_ENTRY: PromptCoachEntry = {
  command: "prompt-coach",
  args: [],
};

export function defaultPromptCoachEntry(): PromptCoachEntry {
  const cliPath = process.argv[1];
  if (typeof cliPath === "string" && DIST_CLI_PATTERN.test(cliPath)) {
    return { command: process.execPath, args: [cliPath] };
  }
  return { ...PUBLISHED_PROMPT_COACH_ENTRY };
}

export function mcpRegistrationSpec(
  tool: AgentTool,
  entry: PromptCoachEntry = defaultPromptCoachEntry(),
): AgentCommandSpec {
  if (tool === "claude-code") {
    return {
      command: "claude",
      args: [
        "mcp",
        "add",
        "--transport",
        "stdio",
        "prompt-coach",
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
      "prompt-coach",
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
  entry?: PromptCoachEntry,
): string {
  const spec = mcpRegistrationSpec(tool, entry);
  return [spec.command, ...spec.args].join(" ");
}

export function doctorCommand(tool: AgentTool): string {
  return `prompt-coach doctor ${tool}`;
}
