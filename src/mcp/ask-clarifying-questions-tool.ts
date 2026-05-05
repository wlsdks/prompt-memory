import {
  applyClarifications,
  improvePrompt,
  type ClarifyingAnswer,
  type ClarifyingQuestion,
  type PromptImprovement,
} from "../analysis/improve.js";
import type { PromptQualityCriterion } from "../shared/schema.js";
import type { PromptMemoryMcpToolDefinition } from "./score-tool-definitions.js";
import type { PromptMemoryMcpServerOptions } from "./server.js";

const LOCAL_READ_ONLY_TOOL_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

export type AskClarifyingQuestionsToolArguments = {
  prompt?: string;
  language?: "en" | "ko";
  timeout_ms?: number;
};

export type AskClarifyingQuestionsInteractionStatus =
  | "answered"
  | "declined"
  | "unsupported"
  | "timeout"
  | "no_questions";

export type AskClarifyingQuestionsToolResult =
  | (PromptImprovement & {
      source: "text";
      rewrite_source: "direct_prompt";
      answers_count: number;
      interaction_status: AskClarifyingQuestionsInteractionStatus;
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

const ASK_CLARIFYING_REQUEST_MESSAGE =
  "Please answer these clarifying questions before prompt-memory composes the rewrite.";

const NEXT_ACTION_BY_STATUS: Record<
  AskClarifyingQuestionsInteractionStatus,
  string
> = {
  answered:
    "Every clarifying axis was answered by the user. Review the draft, copy it manually, and resubmit only after final user approval.",
  no_questions:
    "The prompt was already strong; no clarifying questions were needed. Review the draft and resubmit only after final user approval.",
  declined:
    "The user declined or skipped the clarifying questions. Do not auto-submit. Ask again through your native ask UI before composing or sending any rewrite.",
  unsupported:
    "This MCP client does not advertise elicitation support. Ask the user the listed clarifying_questions through your native ask UI (Claude Code AskUserQuestion, Codex ask_user_question), then call apply_clarifications with verbatim user answers.",
  timeout:
    "The elicitation request timed out before the user answered. Ask the user the listed clarifying_questions through your native ask UI, then call apply_clarifications with verbatim user answers.",
};

export const ASK_CLARIFYING_QUESTIONS_TOOL_DEFINITION: PromptMemoryMcpToolDefinition =
  {
    name: "ask_clarifying_questions",
    description:
      "Score the supplied prompt with prompt-memory's local rules; if any prompt-quality axis is missing, ask the user a small set of clarifying questions through MCP elicitation/create and compose the final approval-ready rewrite from the user's verbatim answers. Falls back to returning clarifying_questions metadata when the client does not advertise elicitation support, when the user declines, or when the elicitation request times out — never auto-submits a rewrite. Local-only, copy-based, no external LLM calls, no input storage.",
    annotations: {
      ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
      title: "Ask clarifying questions and compose draft",
    },
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description: "Prompt text to coach. Redacted locally; not stored.",
        },
        language: {
          type: "string",
          enum: ["en", "ko"],
          description:
            "Language for the improved draft. Defaults to auto-detection.",
        },
        timeout_ms: {
          type: "integer",
          minimum: 1000,
          maximum: 600000,
          description:
            "How long to wait for the elicitation answer before falling back to metadata-only output. Defaults to 60000.",
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
        clarifying_questions: { type: "array" },
        safety_notes: { type: "array", items: { type: "string" } },
        created_at: { type: "string" },
        analyzer: { type: "string" },
        next_action: { type: "string" },
        answers_count: { type: "integer", minimum: 0 },
        interaction_status: {
          type: "string",
          enum: [
            "answered",
            "declined",
            "unsupported",
            "timeout",
            "no_questions",
          ],
        },
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
            "interaction_status",
            "privacy",
          ],
        },
        { required: ["is_error", "error_code", "message"] },
      ],
    },
  } as const;

export async function askClarifyingQuestionsTool(
  args: AskClarifyingQuestionsToolArguments,
  options: PromptMemoryMcpServerOptions = {},
): Promise<AskClarifyingQuestionsToolResult> {
  if (typeof args.prompt !== "string" || args.prompt.trim().length === 0) {
    return {
      is_error: true,
      error_code: "invalid_input",
      message: "`prompt` must be a non-empty string.",
    };
  }

  const trimmed = args.prompt.trim();
  const createdAt = (options.now ?? new Date()).toISOString();
  const baseImprovement = improvePrompt({
    prompt: trimmed,
    createdAt,
    language: args.language,
  });

  if (baseImprovement.clarifying_questions.length === 0) {
    return packResult(baseImprovement, 0, "no_questions");
  }

  const ctx = options.ctx;
  if (!ctx || !hasElicitationCapability(ctx.clientCapabilities)) {
    return packResult(baseImprovement, 0, "unsupported");
  }

  let elicitResult: ElicitationResult;
  try {
    elicitResult = await ctx.channel.sendRequest<ElicitationResult>(
      "elicitation/create",
      buildElicitParams(baseImprovement.clarifying_questions),
      { timeoutMs: clampTimeout(args.timeout_ms) },
    );
  } catch {
    return packResult(baseImprovement, 0, "timeout");
  }

  if (
    !elicitResult ||
    elicitResult.action !== "accept" ||
    !isStringRecord(elicitResult.content)
  ) {
    return packResult(baseImprovement, 0, "declined");
  }

  const answers = collectAnswers(
    baseImprovement.clarifying_questions,
    elicitResult.content,
  );
  if (answers.length === 0) {
    return packResult(baseImprovement, 0, "declined");
  }

  const finalImprovement = applyClarifications({
    prompt: trimmed,
    createdAt,
    language: args.language,
    answers,
  });

  return packResult(finalImprovement, answers.length, "answered");
}

type ElicitationResult = {
  action?: string;
  content?: unknown;
};

function buildElicitParams(questions: ClarifyingQuestion[]): {
  message: string;
  requestedSchema: {
    type: "object";
    properties: Record<
      string,
      { type: "string"; description: string; examples?: string[] }
    >;
    required: string[];
  };
} {
  const properties: Record<
    string,
    { type: "string"; description: string; examples?: string[] }
  > = {};
  const required: string[] = [];
  for (const question of questions) {
    properties[question.axis] = {
      type: "string",
      description: question.ask,
      ...(question.answer_schema.examples.length > 0
        ? { examples: [...question.answer_schema.examples] }
        : {}),
    };
    required.push(question.axis);
  }
  return {
    message: ASK_CLARIFYING_REQUEST_MESSAGE,
    requestedSchema: {
      type: "object",
      properties,
      required,
    },
  };
}

function collectAnswers(
  questions: ClarifyingQuestion[],
  content: Record<string, string>,
): ClarifyingAnswer[] {
  const answers: ClarifyingAnswer[] = [];
  for (const question of questions) {
    const candidate = content[question.axis];
    if (typeof candidate !== "string") continue;
    if (candidate.trim().length === 0) continue;
    answers.push({
      question_id: question.id,
      axis: question.axis as PromptQualityCriterion,
      answer: candidate,
      origin: "user",
    });
  }
  return answers;
}

function hasElicitationCapability(
  capabilities: Record<string, unknown>,
): boolean {
  return (
    typeof capabilities === "object" &&
    capabilities !== null &&
    typeof capabilities.elicitation !== "undefined"
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object") return false;
  for (const entry of Object.values(value)) {
    if (typeof entry !== "string") return false;
  }
  return true;
}

function clampTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 60_000;
  return Math.max(1_000, Math.min(600_000, Math.round(value)));
}

function packResult(
  improvement: PromptImprovement,
  answersCount: number,
  status: AskClarifyingQuestionsInteractionStatus,
): AskClarifyingQuestionsToolResult {
  // Tag drafts that consumed user answers so downstream surfaces (web saved-
  // draft pills, record_clarifications follow-ups) can distinguish a real
  // user-driven rewrite from the auto rule-based baseline. Matches the same
  // tag the web onSave path uses.
  const analyzer: PromptImprovement["analyzer"] =
    status === "answered" ? "clarifications-v1" : improvement.analyzer;
  return {
    ...improvement,
    analyzer,
    source: "text",
    rewrite_source: "direct_prompt",
    answers_count: answersCount,
    interaction_status: status,
    next_action: NEXT_ACTION_BY_STATUS[status],
    privacy: {
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_stored_prompt_body: false,
    },
  };
}
