import { loadHookAuth, loadPromptMemoryConfig } from "../config/config.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import type { PromptSummary } from "../storage/ports.js";
import type {
  PrepareAgentJudgeBatchToolArguments,
  PrepareAgentJudgeBatchToolResult,
  RecordAgentJudgmentsToolArguments,
  RecordAgentJudgmentsToolResult,
} from "./agent-judge-tool-types.js";
import type { ScorePromptToolOptions } from "./score-tool-types.js";

const AGENT_JUDGE_RUBRIC = {
  scale: "0-100",
  criteria: [
    {
      key: "goal_clarity",
      label: "Goal clarity",
      weight: 25,
      guidance:
        "The request states the exact outcome and target behavior before asking for work.",
    },
    {
      key: "context",
      label: "Context",
      weight: 20,
      guidance:
        "The request names relevant files, current state, constraints, or evidence needed for the task.",
    },
    {
      key: "scope",
      label: "Scope control",
      weight: 20,
      guidance:
        "The request defines what may change and what should remain untouched.",
    },
    {
      key: "verification",
      label: "Verification",
      weight: 20,
      guidance:
        "The request includes tests, checks, acceptance criteria, or runtime proof expected after work.",
    },
    {
      key: "output",
      label: "Output contract",
      weight: 15,
      guidance:
        "The request makes the desired response format and handoff clear without unnecessary verbosity.",
    },
  ],
} satisfies Extract<
  PrepareAgentJudgeBatchToolResult,
  { mode: string }
>["rubric"];

export function prepareAgentJudgeBatchTool(
  args: PrepareAgentJudgeBatchToolArguments,
  options: ScorePromptToolOptions = {},
): PrepareAgentJudgeBatchToolResult {
  const maxPrompts = normalizeJudgeLimit(args.max_prompts);
  if (!maxPrompts) {
    return batchError(
      "invalid_input",
      "`max_prompts` must be an integer between 1 and 20.",
    );
  }

  const selection = args.selection ?? "latest";
  if (selection !== "latest" && selection !== "low_score") {
    return batchError(
      "invalid_input",
      "`selection` must be latest or low_score.",
    );
  }

  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const auth = loadHookAuth(options.dataDir);
    const storage = createSqlitePromptStorage({
      dataDir: config.data_dir,
      hmacSecret: auth.web_session_secret,
    });

    try {
      const page = storage.listPrompts({
        limit: Math.max(maxPrompts, 20),
        tool: args.tool,
        cwdPrefix: args.cwd_prefix,
      });
      const selected = selectPromptsForJudge(page.items, selection).slice(
        0,
        maxPrompts,
      );

      if (selected.length === 0) {
        return batchError(
          "not_found",
          "No stored prompts are available for agent judging.",
        );
      }

      const includeRedactedPrompt = args.include_redacted_prompt !== false;
      const prompts = selected.flatMap((summary) => {
        const detail = storage.getPrompt(summary.id);
        if (!detail?.analysis) {
          return [];
        }

        return [
          {
            prompt_id: summary.id,
            tool: summary.tool,
            project: projectLabel(summary.cwd),
            received_at: summary.received_at,
            local_score: detail.analysis.quality_score,
            quality_gaps: summary.quality_gaps,
            ...(includeRedactedPrompt
              ? { redacted_prompt: detail.markdown }
              : {}),
          },
        ];
      });

      if (prompts.length === 0) {
        return batchError(
          "not_found",
          "No analyzed prompts are available for agent judging.",
        );
      }

      return {
        mode: "agent_judge_packet",
        generated_at: (options.now ?? new Date()).toISOString(),
        selection,
        rubric: AGENT_JUDGE_RUBRIC,
        prompts,
        agent_instructions:
          "Evaluate each redacted_prompt as the current user-controlled coding-agent session. Score 0-100 using the rubric, do not reward verbosity by itself, then call record_agent_judgments without prompt bodies.",
        privacy: {
          local_only: true,
          external_calls_by_prompt_memory: false,
          intended_external_evaluator: "current_agent_session",
          returns_redacted_prompt_bodies: includeRedactedPrompt,
          returns_raw_prompt_bodies: false,
          returns_raw_paths: false,
          stores_judgment_results: false,
          auto_submits: false,
        },
      };
    } finally {
      storage.close();
    }
  } catch (error) {
    return batchError("storage_unavailable", storageUnavailableMessage(error));
  }
}

export function recordAgentJudgmentsTool(
  args: RecordAgentJudgmentsToolArguments,
  options: ScorePromptToolOptions = {},
): RecordAgentJudgmentsToolResult {
  const validationError = validateAgentJudgmentInput(args);
  if (validationError) {
    return recordError("invalid_input", validationError);
  }

  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const auth = loadHookAuth(options.dataDir);
    const storage = createSqlitePromptStorage({
      dataDir: config.data_dir,
      hmacSecret: auth.web_session_secret,
      now: options.now ? () => options.now! : undefined,
    });

    try {
      const judgments = [];
      const failedPromptIds: string[] = [];

      for (const judgment of args.judgments) {
        const stored = storage.createAgentPromptJudgment(judgment.prompt_id, {
          provider: args.provider,
          judge_model: args.judge_model,
          score: judgment.score,
          confidence: judgment.confidence,
          summary: judgment.summary,
          strengths: judgment.strengths,
          risks: judgment.risks,
          suggestions: judgment.suggestions,
        });

        stored
          ? judgments.push(stored)
          : failedPromptIds.push(judgment.prompt_id);
      }

      return {
        recorded: judgments.length,
        judgments,
        failed_prompt_ids: failedPromptIds,
        next_action:
          judgments.length > 0
            ? "Use the stored agent judgments alongside local scores to coach the next prompt."
            : "No judgments were recorded. Check prompt ids and retry with a fresh prepare_agent_judge_batch packet.",
        privacy: {
          local_only: true,
          external_calls_by_prompt_memory: false,
          stores_prompt_bodies: false,
          stores_raw_paths: false,
          stores_judgment_results: true,
        },
      };
    } finally {
      storage.close();
    }
  } catch (error) {
    return recordError("storage_unavailable", storageUnavailableMessage(error));
  }
}

function normalizeJudgeLimit(value: number | undefined): number | undefined {
  if (value === undefined) {
    return 5;
  }
  return Number.isInteger(value) && value >= 1 && value <= 20
    ? value
    : undefined;
}

function selectPromptsForJudge(
  prompts: PromptSummary[],
  selection: "latest" | "low_score",
): PromptSummary[] {
  if (selection === "low_score") {
    return [...prompts].sort(
      (a, b) =>
        a.quality_score - b.quality_score ||
        b.received_at.localeCompare(a.received_at) ||
        a.id.localeCompare(b.id),
    );
  }
  return prompts;
}

function validateAgentJudgmentInput(
  args: RecordAgentJudgmentsToolArguments,
): string | undefined {
  if (
    !["claude-code", "codex", "gemini-cli", "other"].includes(args.provider)
  ) {
    return "`provider` must be claude-code, codex, gemini-cli, or other.";
  }
  if (!Array.isArray(args.judgments) || args.judgments.length === 0) {
    return "`judgments` must contain at least one judgment.";
  }
  if (args.judgments.length > 20) {
    return "`judgments` can contain at most 20 judgments.";
  }

  for (const judgment of args.judgments) {
    if (!judgment.prompt_id?.trim()) {
      return "Each judgment requires a non-empty prompt_id.";
    }
    if (
      !Number.isInteger(judgment.score) ||
      judgment.score < 0 ||
      judgment.score > 100
    ) {
      return "Each judgment score must be an integer between 0 and 100.";
    }
    if (
      typeof judgment.confidence !== "number" ||
      judgment.confidence < 0 ||
      judgment.confidence > 1
    ) {
      return "Each judgment confidence must be between 0 and 1.";
    }
    if (!judgment.summary?.trim()) {
      return "Each judgment requires a non-empty summary.";
    }
  }

  return undefined;
}

function projectLabel(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? "project";
}

function storageUnavailableMessage(error: unknown): string {
  const reason =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? ` Reason: ${error.code}.`
      : "";
  return `Local prompt-memory archive is not available. Run \`prompt-memory init\` first or pass --data-dir.${reason}`;
}

function batchError(
  errorCode: Extract<
    PrepareAgentJudgeBatchToolResult,
    { is_error: true }
  >["error_code"],
  message: string,
): PrepareAgentJudgeBatchToolResult {
  return { is_error: true, error_code: errorCode, message };
}

function recordError(
  errorCode: Extract<
    RecordAgentJudgmentsToolResult,
    { is_error: true }
  >["error_code"],
  message: string,
): RecordAgentJudgmentsToolResult {
  return { is_error: true, error_code: errorCode, message };
}
