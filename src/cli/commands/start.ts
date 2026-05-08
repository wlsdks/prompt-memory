import type { Command } from "commander";

import {
  doctorCommand,
  mcpRegistrationCommand,
  type AgentTool,
} from "../agent-access.js";
import { UserError } from "../user-error.js";

export type StartOptions = {
  tool?: string;
  openWeb?: boolean;
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
    .option(
      "--open-web",
      "Include the opt-in SessionStart web opener in the setup command.",
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
    goal: "Capture one real coding prompt, score it, and get one improvement suggestion in about three minutes.",
    tools,
    steps: [
      {
        title: "Run the coach setup",
        detail:
          options.openWeb === true
            ? "Installs local storage, hooks, service startup, low-friction rewrite guidance, agent MCP commands, and opens the web workspace automatically on new agent sessions."
            : "Installs local storage, hooks, service startup, low-friction rewrite guidance, and agent MCP commands.",
        commands: [
          `prompt-memory setup --profile coach --register-mcp${options.openWeb === true ? " --open-web" : ""}`,
        ],
      },
      {
        title: "Send one real coding prompt",
        detail:
          "Use Claude Code or Codex normally. The prompt should be a real coding request, not a test string.",
        commands: [],
      },
      {
        title: "See the first score",
        detail:
          "Shows the latest score, weakest habit, and the next prompt improvement to try.",
        commands: ["prompt-memory coach"],
      },
      {
        title: "If capture does not appear",
        detail:
          "Checks local server, ingest token, hook status, and MCP access.",
        commands: tools.map((tool) => doctorCommand(tool)),
      },
      {
        title: "If MCP registration needs attention",
        detail:
          "Use these only if setup reports MCP registration failed or you skipped --register-mcp.",
        commands: tools.map((tool) => mcpRegistrationCommand(tool)),
      },
      {
        title: "Optional archive review",
        detail:
          "Start the web UI only when you want search, dashboards, export, or visual history review.",
        commands: ["prompt-memory server"],
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
    if (index === 3) {
      lines.push("", "Troubleshooting:");
    } else if (index === 5) {
      lines.push("", "Optional:");
    }

    lines.push(`${index + 1}. ${step.title}`);
    lines.push(`   ${step.detail}`);
    for (const command of step.commands) {
      lines.push(`   ${command}`);
    }
  });

  lines.push("", "Use --json for automation.");
  return lines.join("\n");
}

const SUPPORTED_TOOLS: AgentTool[] = ["claude-code", "codex"];

function resolveTools(value: string | undefined): AgentTool[] {
  if (value === undefined) {
    return [...SUPPORTED_TOOLS];
  }
  if (value === "claude-code" || value === "codex") {
    return [value];
  }
  throw new UserError(`Unsupported tool: ${value}. Use claude-code or codex.`);
}
