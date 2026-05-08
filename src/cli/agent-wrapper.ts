#!/usr/bin/env node
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as defaultStdin, stdout as defaultStdout } from "node:process";

import { analyzePrompt } from "../analysis/analyze.js";
import { improvePrompt } from "../analysis/improve.js";
import { clampScore } from "../shared/clamp-score.js";
import { UserError } from "./user-error.js";

export type AgentWrapperTool = "claude" | "codex";
export type AgentWrapperMode = "ask" | "auto" | "off";

export type AgentWrapperOptions = {
  mode: AgentWrapperMode;
  minScore: number;
  language?: "en" | "ko";
  dryRun: boolean;
  agentPath?: string;
};

export type AgentWrapperPlan = {
  tool: AgentWrapperTool;
  command: string;
  args: string[];
  prompt?: {
    originalIndex: number;
    originalLength: number;
    selectedLength: number;
    changed: boolean;
    score: number;
    threshold: number;
    mode: AgentWrapperMode;
    reason: "no_prompt" | "mode_off" | "above_threshold" | "rewritten";
    selectedPrompt?: string;
  };
  passthroughReason?: string;
};

export type RunAgentWrapperOptions = {
  tool: AgentWrapperTool;
  argv: string[];
  env?: NodeJS.ProcessEnv;
  now?: Date;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
  isTTY?: boolean;
  spawn?: typeof spawnSync;
};

type ParsedWrapperArgs = {
  wrapper: AgentWrapperOptions;
  agentArgs: string[];
};

const DEFAULT_MIN_SCORE = 80;
const CLAUDE_COMMANDS = new Set([
  "agents",
  "auth",
  "auto-mode",
  "doctor",
  "install",
  "mcp",
  "plugin",
  "plugins",
  "project",
  "setup-token",
  "ultrareview",
  "update",
  "upgrade",
]);
const CODEX_COMMANDS = new Set([
  "apply",
  "app",
  "app-server",
  "cloud",
  "completion",
  "debug",
  "exec",
  "exec-server",
  "features",
  "fork",
  "help",
  "login",
  "logout",
  "mcp",
  "mcp-server",
  "plugin",
  "resume",
  "review",
  "sandbox",
  "update",
]);
const CODEX_EXEC_SUBCOMMANDS = new Set(["help", "resume", "review"]);
const SHARED_VALUE_OPTIONS = [
  "--add-dir",
  "--agent",
  "--agents",
  "--allowed-tools",
  "--allowedTools",
  "--append-system-prompt",
  "--ask-for-approval",
  "--betas",
  "--cd",
  "--config",
  "--debug",
  "--debug-file",
  "--disallowed-tools",
  "--disallowedTools",
  "--effort",
  "--fallback-model",
  "--file",
  "--image",
  "--input-format",
  "--json-schema",
  "--local-provider",
  "--max-budget-usd",
  "--mcp-config",
  "--model",
  "--name",
  "--output-format",
  "--output-last-message",
  "--output-schema",
  "--permission-mode",
  "--plugin-dir",
  "--profile",
  "--remote",
  "--remote-auth-token-env",
  "--remote-control-session-name-prefix",
  "--resume",
  "--sandbox",
  "--setting-sources",
  "--settings",
  "--system-prompt",
  "--tmux",
  "--tools",
  "--worktree",
];
const CLAUDE_VALUE_OPTIONS = new Set([
  "-C",
  "-d",
  "-n",
  "-r",
  "-w",
  ...SHARED_VALUE_OPTIONS,
]);
const CODEX_VALUE_OPTIONS = new Set([
  "-C",
  "-a",
  "-c",
  "-i",
  "-m",
  "-o",
  "-p",
  "-s",
  ...SHARED_VALUE_OPTIONS,
]);

export async function runAgentWrapper(
  options: RunAgentWrapperOptions,
): Promise<number> {
  const parsed = parseWrapperArgs(options.tool, options.argv, options.env);
  if (isHelpRequested(parsed.agentArgs)) {
    writeWrapperHelp(options.stdout ?? defaultStdout, options.tool);
    return 0;
  }

  const plan = await createAgentWrapperPlan(parsed, {
    tool: options.tool,
    now: options.now ?? new Date(),
    isTTY:
      options.isTTY ?? Boolean(options.stdin?.isTTY ?? process.stdin.isTTY),
    stdin: options.stdin ?? defaultStdin,
    stdout: options.stdout ?? defaultStdout,
  });

  if (parsed.wrapper.dryRun) {
    (options.stdout ?? defaultStdout).write(
      `${JSON.stringify(formatDryRunPlan(plan), null, 2)}\n`,
    );
    return 0;
  }

  const spawn = options.spawn ?? spawnSync;
  const result = spawn(plan.command, plan.args, { stdio: "inherit" });
  return normalizeExitStatus(result);
}

export async function createAgentWrapperPlan(
  parsed: ParsedWrapperArgs,
  context: {
    tool: AgentWrapperTool;
    now: Date;
    isTTY: boolean;
    stdin: NodeJS.ReadStream;
    stdout: NodeJS.WriteStream;
  },
): Promise<AgentWrapperPlan> {
  const command =
    parsed.wrapper.agentPath ?? defaultAgentCommand(context.tool, process.env);
  const promptIndex = findPromptIndex(context.tool, parsed.agentArgs);
  if (promptIndex === undefined) {
    return {
      tool: context.tool,
      command,
      args: parsed.agentArgs,
      passthroughReason: "no supported initial prompt argument",
      prompt: undefined,
    };
  }

  const originalPrompt = parsed.agentArgs[promptIndex] ?? "";
  const replacement = await selectPromptReplacement({
    prompt: originalPrompt,
    wrapper: parsed.wrapper,
    now: context.now,
    isTTY: context.isTTY,
    stdin: context.stdin,
    stdout: context.stdout,
  });
  const args = [...parsed.agentArgs];
  args[promptIndex] = replacement.selectedPrompt;

  return {
    tool: context.tool,
    command,
    args,
    prompt: {
      originalIndex: promptIndex,
      originalLength: originalPrompt.length,
      selectedLength: replacement.selectedPrompt.length,
      changed: replacement.selectedPrompt !== originalPrompt,
      score: replacement.score,
      threshold: parsed.wrapper.minScore,
      mode: parsed.wrapper.mode,
      reason: replacement.reason,
      selectedPrompt: replacement.selectedPrompt,
    },
  };
}

export function parseWrapperArgs(
  tool: AgentWrapperTool,
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): ParsedWrapperArgs {
  const wrapper: AgentWrapperOptions = {
    mode: parseWrapperMode(env.PROMPT_MEMORY_WRAPPER_MODE) ?? "ask",
    minScore: parseMinScore(env.PROMPT_MEMORY_WRAPPER_MIN_SCORE),
    language: parseLanguage(env.PROMPT_MEMORY_WRAPPER_LANGUAGE),
    dryRun: false,
    agentPath: defaultAgentCommand(tool, env),
  };
  const agentArgs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--") {
      agentArgs.push(...argv.slice(index + 1));
      break;
    }
    if (arg === "--pm-help") {
      agentArgs.push(arg);
      continue;
    }
    if (arg === "--pm-dry-run") {
      wrapper.dryRun = true;
      continue;
    }
    if (arg === "--pm-auto") {
      wrapper.mode = "auto";
      continue;
    }
    if (arg === "--pm-off") {
      wrapper.mode = "off";
      continue;
    }

    const parsedInline = parseInlineWrapperOption(arg);
    if (parsedInline) {
      applyWrapperOption(wrapper, parsedInline.key, parsedInline.value);
      continue;
    }

    if (isWrapperOptionWithValue(arg)) {
      const value = argv[index + 1];
      if (value !== undefined) {
        applyWrapperOption(wrapper, arg, value);
        index += 1;
        continue;
      }
    }

    agentArgs.push(arg);
  }

  return { wrapper, agentArgs };
}

function defaultAgentCommand(
  tool: AgentWrapperTool,
  env: NodeJS.ProcessEnv,
): string {
  if (tool === "claude") {
    return env.PROMPT_MEMORY_CLAUDE_BIN ?? "claude";
  }

  return env.PROMPT_MEMORY_CODEX_BIN ?? "codex";
}

function parseInlineWrapperOption(
  arg: string,
): { key: string; value: string } | undefined {
  const index = arg.indexOf("=");
  if (index < 0 || !arg.startsWith("--pm-")) {
    return undefined;
  }

  return {
    key: arg.slice(0, index),
    value: arg.slice(index + 1),
  };
}

function isWrapperOptionWithValue(arg: string): boolean {
  return (
    arg === "--pm-mode" ||
    arg === "--pm-min-score" ||
    arg === "--pm-language" ||
    arg === "--pm-agent-path"
  );
}

function applyWrapperOption(
  wrapper: AgentWrapperOptions,
  key: string,
  value: string,
): void {
  if (key === "--pm-mode") {
    const parsedMode = parseWrapperMode(value);
    if (parsedMode === undefined) {
      throw new UserError(
        `Unsupported --pm-mode: ${value}. Use ask, auto, or off.`,
      );
    }
    wrapper.mode = parsedMode;
  } else if (key === "--pm-min-score") {
    wrapper.minScore = parseMinScore(value);
  } else if (key === "--pm-language") {
    wrapper.language = parseLanguage(value);
  } else if (key === "--pm-agent-path") {
    wrapper.agentPath = value;
  }
}

function parseWrapperMode(
  value: string | undefined,
): AgentWrapperMode | undefined {
  if (value === "ask" || value === "auto" || value === "off") {
    return value;
  }

  return undefined;
}

function parseLanguage(value: string | undefined): "en" | "ko" | undefined {
  return value === "en" || value === "ko" ? value : undefined;
}

function parseMinScore(value: string | undefined): number {
  const parsed = value === undefined ? DEFAULT_MIN_SCORE : Number(value);
  return Number.isFinite(parsed) ? clampScore(parsed) : DEFAULT_MIN_SCORE;
}

function findPromptIndex(
  tool: AgentWrapperTool,
  args: string[],
): number | undefined {
  if (tool === "claude") {
    const first = firstPositional(tool, args, 0);
    if (first && CLAUDE_COMMANDS.has(first.value)) {
      return undefined;
    }

    return lastPositional(tool, args, 0)?.index;
  }

  const first = firstPositional(tool, args, 0);
  if (!first) {
    return undefined;
  }
  if (!CODEX_COMMANDS.has(first.value)) {
    return lastPositional(tool, args, 0)?.index;
  }
  if (first.value !== "exec") {
    return undefined;
  }

  const execFirst = firstPositional(tool, args, first.index + 1);
  if (execFirst && CODEX_EXEC_SUBCOMMANDS.has(execFirst.value)) {
    return undefined;
  }

  return lastPositional(tool, args, first.index + 1)?.index;
}

function firstPositional(
  tool: AgentWrapperTool,
  args: string[],
  startIndex: number,
): { index: number; value: string } | undefined {
  return positionalArgs(tool, args, startIndex)[0];
}

function lastPositional(
  tool: AgentWrapperTool,
  args: string[],
  startIndex: number,
): { index: number; value: string } | undefined {
  const values = positionalArgs(tool, args, startIndex);
  return values[values.length - 1];
}

function positionalArgs(
  tool: AgentWrapperTool,
  args: string[],
  startIndex: number,
): Array<{ index: number; value: string }> {
  const values: Array<{ index: number; value: string }> = [];
  const valueOptions =
    tool === "claude" ? CLAUDE_VALUE_OPTIONS : CODEX_VALUE_OPTIONS;

  for (let index = startIndex; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--") {
      for (let rest = index + 1; rest < args.length; rest += 1) {
        values.push({ index: rest, value: args[rest] ?? "" });
      }
      break;
    }
    if (arg.startsWith("--") && arg.includes("=")) {
      continue;
    }
    if (valueOptions.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }

    values.push({ index, value: arg });
  }

  return values;
}

async function selectPromptReplacement(options: {
  prompt: string;
  wrapper: AgentWrapperOptions;
  now: Date;
  isTTY: boolean;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
}): Promise<{
  selectedPrompt: string;
  score: number;
  reason: "mode_off" | "above_threshold" | "rewritten";
}> {
  const createdAt = options.now.toISOString();
  const analysis = analyzePrompt({ prompt: options.prompt, createdAt });
  if (options.wrapper.mode === "off") {
    return {
      selectedPrompt: options.prompt,
      score: analysis.quality_score.value,
      reason: "mode_off",
    };
  }
  if (analysis.quality_score.value >= options.wrapper.minScore) {
    return {
      selectedPrompt: options.prompt,
      score: analysis.quality_score.value,
      reason: "above_threshold",
    };
  }

  const improvement = improvePrompt({
    prompt: options.prompt,
    createdAt,
    language: options.wrapper.language,
  });
  if (options.wrapper.mode === "auto" || options.wrapper.dryRun) {
    return {
      selectedPrompt: improvement.improved_prompt,
      score: analysis.quality_score.value,
      reason: "rewritten",
    };
  }
  if (!options.isTTY) {
    return {
      selectedPrompt: options.prompt,
      score: analysis.quality_score.value,
      reason: "mode_off",
    };
  }

  const approved = await askForApproval({
    prompt: improvement.improved_prompt,
    score: analysis.quality_score.value,
    threshold: options.wrapper.minScore,
    stdin: options.stdin,
    stdout: options.stdout,
  });

  return {
    selectedPrompt: approved ? improvement.improved_prompt : options.prompt,
    score: analysis.quality_score.value,
    reason: approved ? "rewritten" : "mode_off",
  };
}

async function askForApproval(options: {
  prompt: string;
  score: number;
  threshold: number;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
}): Promise<boolean> {
  options.stdout.write(
    [
      `prompt-memory: score ${options.score}/100 below ${options.threshold}.`,
      "Improved prompt:",
      options.prompt,
      "",
    ].join("\n"),
  );

  const readline = createInterface({
    input: options.stdin,
    output: options.stdout,
  });
  try {
    const answer = await readline.question("Use improved prompt? [Y/n] ");
    return answer.trim().toLowerCase() !== "n";
  } finally {
    readline.close();
  }
}

function formatDryRunPlan(plan: AgentWrapperPlan): Record<string, unknown> {
  return {
    tool: plan.tool,
    command: plan.command,
    args_count: plan.args.length,
    passthrough_reason: plan.passthroughReason,
    prompt: plan.prompt
      ? {
          original_index: plan.prompt.originalIndex,
          original_length: plan.prompt.originalLength,
          selected_length: plan.prompt.selectedLength,
          changed: plan.prompt.changed,
          score: plan.prompt.score,
          threshold: plan.prompt.threshold,
          mode: plan.prompt.mode,
          reason: plan.prompt.reason,
          selected_prompt: plan.prompt.selectedPrompt,
        }
      : undefined,
    privacy: {
      local_only: true,
      external_calls: false,
      original_prompt_returned: false,
      selected_prompt_may_include_redacted_original: true,
    },
  };
}

function normalizeExitStatus(
  result: SpawnSyncReturns<Buffer> | SpawnSyncReturns<string>,
): number {
  if (typeof result.status === "number") {
    return result.status;
  }
  if (result.error) {
    return 1;
  }

  return 0;
}

function isHelpRequested(args: string[]): boolean {
  return args.includes("--pm-help");
}

function writeWrapperHelp(
  stdout: NodeJS.WriteStream,
  tool: AgentWrapperTool,
): void {
  stdout.write(
    [
      `pm-${tool}`,
      "",
      `Usage: pm-${tool} [--pm-mode ask|auto|off] [--pm-min-score 0-100] [--pm-language en|ko] [--pm-dry-run] -- [${tool} args] [prompt]`,
      "",
      "The wrapper rewrites only the supported initial prompt argument before launching the real CLI.",
      "It does not intercept every message typed later inside the interactive session.",
      "",
      "Examples:",
      `  # Ask before each rewrite (default)`,
      `  pm-${tool} -- "Fix src/foo.ts and run pnpm test"`,
      `  # Skip the rewrite entirely`,
      `  pm-${tool} --pm-mode off -- "Quick log check"`,
      `  # Auto-apply rewrites only when score is below 50`,
      `  pm-${tool} --pm-mode auto --pm-min-score 50 -- "Refactor the importer"`,
      `  # Force the Korean draft for an English-mixed prompt`,
      `  pm-${tool} --pm-language ko -- "AGENTS.md 갱신해줘"`,
      `  # Print the rewrite plan without launching ${tool}`,
      `  pm-${tool} --pm-dry-run -- "Plan the next refactor"`,
      "",
    ].join("\n"),
  );
}
