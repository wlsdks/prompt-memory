import type { Command } from "commander";

import {
  doctorCommand,
  mcpRegistrationCommand,
  type AgentTool,
} from "../agent-access.js";

export type StartOptions = {
  tool?: string;
  json?: boolean;
};

export type StartStep = {
  title: string;
  detail: string;
  commands: string[];
};

export type StartGuide = {
  goal: string;
  tools: AgentTool[];
  steps: StartStep[];
};

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Show the shortest first-success path for prompt coaching.")
    .option(
      "--tool <tool>",
      "Focus the guide on claude-code or codex. Defaults to both.",
    )
    .option("--json", "Print machine-readable JSON.")
    .action((options: StartOptions) => {
      const guide = buildStartGuide(options);
      console.log(
        options.json ? JSON.stringify(guide, null, 2) : formatStartGuide(guide),
      );
    });
}

export function buildStartGuide(options: StartOptions = {}): StartGuide {
  const tools = resolveTools(options.tool);

  return {
    goal: "Capture one real coding prompt, score it, and get one improvement suggestion.",
    tools,
    steps: [
      {
        title: "Set up capture, coaching, and MCP",
        detail:
          "Installs local storage, hooks, service startup, low-friction rewrite guidance, and agent MCP commands.",
        commands: ["prompt-memory setup --profile coach --register-mcp"],
      },
      {
        title: "Manual MCP fallback",
        detail:
          "Use these only if setup reports MCP registration failed or you skipped --register-mcp.",
        commands: tools.map((tool) => mcpRegistrationCommand(tool)),
      },
      {
        title: "Send one real prompt",
        detail:
          "Use Claude Code or Codex normally. The prompt should be a real coding request, not a test string.",
        commands: [],
      },
      {
        title: "Confirm capture",
        detail:
          "Checks local server, ingest token, hook status, and MCP access.",
        commands: tools.map((tool) => doctorCommand(tool)),
      },
      {
        title: "Get the first coach result",
        detail:
          "Shows the latest score, weakest habit, and the next prompt improvement to try.",
        commands: ["prompt-memory coach"],
      },
    ],
  };
}

export function formatStartGuide(guide: StartGuide): string {
  const lines = [
    "prompt-memory start",
    `Goal: ${guide.goal}`,
    `Tools: ${guide.tools.join(", ")}`,
    "",
    "First success path:",
  ];

  guide.steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}`);
    lines.push(`   ${step.detail}`);
    for (const command of step.commands) {
      lines.push(`   ${command}`);
    }
  });

  lines.push("", "Use --json for automation.");
  return lines.join("\n");
}

function resolveTools(value: string | undefined): AgentTool[] {
  if (value === "claude-code" || value === "codex") {
    return [value];
  }

  return ["claude-code", "codex"];
}
