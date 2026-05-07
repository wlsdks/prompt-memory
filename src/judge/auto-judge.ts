import { spawnSync, type SpawnSyncReturns } from "node:child_process";

import { clampScore } from "../shared/clamp-score.js";

type JudgeTool = "claude" | "codex";

export type JudgeOutcome =
  | { kind: "ok"; score: number; reason: string }
  | {
      kind: "skipped";
      reason:
        | "cli_missing"
        | "non_zero_exit"
        | "invalid_output"
        | "timeout"
        | "empty_prompt";
    };

export type RunAutoJudgeOptions = {
  tool: JudgeTool;
  redactedPrompt: string;
  agentPath?: string;
  spawn?: typeof spawnSync;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export function runAutoJudge(options: RunAutoJudgeOptions): JudgeOutcome {
  if (options.redactedPrompt.trim().length === 0) {
    return { kind: "skipped", reason: "empty_prompt" };
  }

  const command = options.agentPath ?? defaultCommand(options.tool);
  const args = buildArgs(options.tool, options.redactedPrompt);
  const spawn = options.spawn ?? spawnSync;

  const result = spawn(command, args, {
    encoding: "utf8",
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (isMissingBinary(result)) {
    return { kind: "skipped", reason: "cli_missing" };
  }

  if (result.signal === "SIGTERM" || result.signal === "SIGKILL") {
    return { kind: "skipped", reason: "timeout" };
  }

  if (result.status !== 0) {
    return { kind: "skipped", reason: "non_zero_exit" };
  }

  return parseJudgeOutput(options.tool, result.stdout ?? "");
}

export function buildJudgePrompt(redactedPrompt: string): string {
  return [
    "You are a strict prompt quality judge for an AI coding assistant.",
    "Score the prompt on Goal, Context, Constraints, Verification, and Format.",
    'Reply with JSON only: {"score": <int 0-100>, "reason": "<one sentence>"}.',
    "Do not echo the prompt. Do not include any other text.",
    "",
    "Prompt:",
    "<<<",
    redactedPrompt,
    ">>>",
  ].join("\n");
}

function defaultCommand(tool: JudgeTool): string {
  return tool === "claude" ? "claude" : "codex";
}

function buildArgs(tool: JudgeTool, redactedPrompt: string): string[] {
  const judgePrompt = buildJudgePrompt(redactedPrompt);
  if (tool === "claude") {
    return ["-p", judgePrompt, "--output-format", "json"];
  }
  return ["exec", judgePrompt];
}

function isMissingBinary(result: SpawnSyncReturns<string>): boolean {
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR";
  }
  return result.status === 127;
}

function parseJudgeOutput(tool: JudgeTool, stdout: string): JudgeOutcome {
  const inner = tool === "claude" ? extractClaudeResult(stdout) : stdout;
  if (inner === undefined) {
    return { kind: "skipped", reason: "invalid_output" };
  }

  const parsed = extractScoreReason(inner);
  if (!parsed) {
    return { kind: "skipped", reason: "invalid_output" };
  }

  return {
    kind: "ok",
    score: clampScore(parsed.score),
    reason: parsed.reason,
  };
}

function extractClaudeResult(stdout: string): string | undefined {
  try {
    const wrapper = JSON.parse(stdout) as {
      result?: unknown;
      type?: unknown;
      subtype?: unknown;
    };
    if (typeof wrapper.result === "string") {
      return wrapper.result;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function extractScoreReason(
  text: string,
): { score: number; reason: string } | undefined {
  const candidate = locateJsonObject(text);
  if (!candidate) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(candidate) as {
      score?: unknown;
      reason?: unknown;
    };
    const score = typeof parsed.score === "number" ? parsed.score : undefined;
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    if (score === undefined || Number.isNaN(score)) {
      return undefined;
    }
    return { score, reason };
  } catch {
    return undefined;
  }
}

function locateJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return undefined;
  }
  return text.slice(start, end + 1);
}
