import {
  applyClarifications,
  type ApplyClarificationsInput,
  type ClarifyingAnswer,
  type PromptImprovement,
} from "../analysis/improve.js";
import type { PromptQualityCriterion } from "../shared/schema.js";
import type { PromptMemoryMcpToolDefinition } from "./score-tool-definitions.js";
import type { ScorePromptToolOptions } from "./score-tool-types.js";

const LOCAL_READ_ONLY_TOOL_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

const QUALITY_CRITERIA: readonly PromptQualityCriterion[] = [
  "goal_clarity",
  "background_context",
  "scope_limits",
  "output_format",
  "verification_criteria",
];

export type ApplyClarificationsToolArguments = {
  prompt?: string;
  language?: "en" | "ko";
  answers?: readonly {
    question_id?: string;
    axis?: string;
    answer?: string;
    origin?: string;
  }[];
};

export type ApplyClarificationsToolResult =
  | (PromptImprovement & {
      source: "text";
      rewrite_source: "direct_prompt";
      answers_count: number;
      next_action: string;
      privacy: {
        local_only: true;
        stores_input: false;
        external_calls: false;
        returns_stored_prompt_body: false;
      };
    })
  | {
      is_error: true;
      error_code: "invalid_input";
      message: string;
    };

export const APPLY_CLARIFICATIONS_TOOL_DEFINITION: PromptMemoryMcpToolDefinition =
  {
    name: "apply_clarifications",
    description:
      'Compose an approval-ready prompt rewrite from the user\'s own answers to clarifying_questions returned by improve_prompt or coach_prompt. The active Claude Code/Codex/Gemini agent must collect each answer through its own ask UI and pass them through verbatim with `origin: "user"`. The tool is local-only, copy-based, never auto-submits the rewrite, never calls external LLMs, and does not store the input prompt or the answers.',
    annotations: {
      ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
      title: "Apply user clarifying answers",
    },
    inputSchema: {
      type: "object",
      required: ["prompt", "answers"],
      properties: {
        prompt: {
          type: "string",
          description:
            "The original prompt text the user wants to improve. Redacted locally before analysis. Not stored.",
        },
        language: {
          type: "string",
          enum: ["en", "ko"],
          description:
            "Language for the improved draft. Defaults to auto-detection.",
        },
        answers: {
          type: "array",
          minItems: 1,
          description:
            "Answers the user gave to the clarifying_questions. Pass each through verbatim — do not summarize, paraphrase, or invent.",
          items: {
            type: "object",
            required: ["question_id", "axis", "answer", "origin"],
            properties: {
              question_id: { type: "string" },
              axis: {
                type: "string",
                enum: [
                  "goal_clarity",
                  "background_context",
                  "scope_limits",
                  "output_format",
                  "verification_criteria",
                ],
              },
              answer: { type: "string" },
              origin: { const: "user" },
            },
          },
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        source: { const: "text" },
        rewrite_source: { const: "direct_prompt" },
        mode: { const: "copy" },
        requires_user_approval: { const: true },
        summary: { type: "string" },
        improved_prompt: { type: "string" },
        changed_sections: { type: "array", items: { type: "string" } },
        clarifying_questions: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "axis", "ask"],
            properties: {
              id: { type: "string" },
              axis: { type: "string" },
              ask: { type: "string" },
            },
          },
        },
        safety_notes: { type: "array", items: { type: "string" } },
        created_at: { type: "string" },
        analyzer: { type: "string" },
        next_action: { type: "string" },
        answers_count: { type: "integer", minimum: 0 },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "stores_input",
            "external_calls",
            "returns_stored_prompt_body",
          ],
          properties: {
            local_only: { const: true },
            stores_input: { const: false },
            external_calls: { const: false },
            returns_stored_prompt_body: { const: false },
          },
        },
        is_error: { const: true },
        error_code: { type: "string" },
        message: { type: "string" },
      },
      oneOf: [
        {
          required: [
            "source",
            "rewrite_source",
            "mode",
            "requires_user_approval",
            "summary",
            "improved_prompt",
            "changed_sections",
            "clarifying_questions",
            "safety_notes",
            "created_at",
            "analyzer",
            "next_action",
            "answers_count",
            "privacy",
          ],
        },
        { required: ["is_error", "error_code", "message"] },
      ],
    },
  } as const;

export function applyClarificationsTool(
  args: ApplyClarificationsToolArguments,
  options: ScorePromptToolOptions = {},
): ApplyClarificationsToolResult {
  if (typeof args.prompt !== "string" || args.prompt.trim().length === 0) {
    return invalidInput("`prompt` must be a non-empty string.");
  }
  if (!Array.isArray(args.answers) || args.answers.length === 0) {
    return invalidInput("`answers` must contain at least one entry.");
  }

  const validated: ClarifyingAnswer[] = [];
  for (const entry of args.answers) {
    if (!entry || typeof entry !== "object") {
      return invalidInput("Each answer must be an object.");
    }
    if (entry.origin !== "user") {
      return invalidInput(
        'Each answer must have `origin: "user"`. Pass the user\'s own response verbatim — do not guess on their behalf.',
      );
    }
    if (typeof entry.answer !== "string" || entry.answer.trim().length === 0) {
      return invalidInput(
        "Each answer must include a non-empty `answer` string.",
      );
    }
    if (
      typeof entry.axis !== "string" ||
      !(QUALITY_CRITERIA as readonly string[]).includes(entry.axis)
    ) {
      return invalidInput(
        "Each answer must include a known `axis` (goal_clarity, background_context, scope_limits, output_format, verification_criteria).",
      );
    }
    if (
      typeof entry.question_id !== "string" ||
      entry.question_id.length === 0
    ) {
      return invalidInput("Each answer must include a `question_id` string.");
    }
    validated.push({
      question_id: entry.question_id,
      axis: entry.axis as PromptQualityCriterion,
      answer: entry.answer,
      origin: "user",
    });
  }

  const compositeInput: ApplyClarificationsInput = {
    prompt: args.prompt.trim(),
    createdAt: (options.now ?? new Date()).toISOString(),
    language: args.language,
    answers: validated,
  };
  const improvement = applyClarifications(compositeInput);
  const hasRemaining = improvement.clarifying_questions.length > 0;

  return {
    ...improvement,
    source: "text",
    rewrite_source: "direct_prompt",
    answers_count: validated.length,
    next_action: hasRemaining
      ? "Some clarifying_questions are still unanswered. Ask the user the remaining items through the agent's native ask UI before producing or submitting any rewrite."
      : "All clarifying questions were answered. Review the draft, copy it manually, and resubmit only after final user approval.",
    privacy: {
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_stored_prompt_body: false,
    },
  };
}

function invalidInput(message: string): ApplyClarificationsToolResult {
  return {
    is_error: true,
    error_code: "invalid_input",
    message,
  };
}
