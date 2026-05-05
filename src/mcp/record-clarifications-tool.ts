import {
  applyClarifications,
  type ClarifyingAnswer,
  type PromptImprovement,
} from "../analysis/improve.js";
import { loadHookAuth, loadPromptMemoryConfig } from "../config/config.js";
import type { PromptQualityCriterion } from "../shared/schema.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import type { PromptMemoryMcpToolDefinition } from "./score-tool-definitions.js";
import type { ScorePromptToolOptions } from "./score-tool-types.js";

const QUALITY_CRITERIA: readonly PromptQualityCriterion[] = [
  "goal_clarity",
  "background_context",
  "scope_limits",
  "output_format",
  "verification_criteria",
];

const NON_DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
  readOnlyHint: false,
} as const;

export type RecordClarificationsToolArguments = {
  prompt_id?: string;
  language?: "en" | "ko";
  answers?: readonly {
    question_id?: string;
    axis?: string;
    answer?: string;
    origin?: string;
  }[];
};

export type RecordClarificationsToolResult =
  | {
      draft_id: string;
      prompt_id: string;
      answers_count: number;
      changed_sections: PromptQualityCriterion[];
      safety_notes: string[];
      analyzer: string;
      recorded_at: string;
      next_action: string;
      privacy: {
        local_only: true;
        stores_input: true;
        external_calls: false;
        returns_stored_prompt_body: false;
      };
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

const RECORD_CLARIFICATIONS_ANALYZER = "clarifications-v1";

export const RECORD_CLARIFICATIONS_TOOL_DEFINITION: PromptMemoryMcpToolDefinition =
  {
    name: "record_clarifications",
    description:
      "Save the user's verbatim answers to clarifying_questions, plus the resulting approval-ready draft, against a stored prompt in the local prompt-memory archive. Each answer must be tagged origin: \"user\" — agents must not guess on the user's behalf. The tool writes a redacted improvement draft to the local SQLite archive (prompt_improvement_drafts) and returns metadata only — never the prompt body or the draft text. Local-only, no external LLM calls.",
    annotations: {
      ...NON_DESTRUCTIVE_WRITE_TOOL_ANNOTATIONS,
      title: "Record clarifying answers and draft",
    },
    inputSchema: {
      type: "object",
      required: ["prompt_id", "answers"],
      properties: {
        prompt_id: {
          type: "string",
          description:
            "The stored prompt id whose archive entry the new improvement draft should be attached to.",
        },
        language: {
          type: "string",
          enum: ["en", "ko"],
          description:
            "Language for the composed draft. Defaults to auto-detection from the stored prompt.",
        },
        answers: {
          type: "array",
          minItems: 1,
          description:
            "User answers collected through the agent's native ask UI or MCP elicitation. Pass each one verbatim.",
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
        draft_id: { type: "string" },
        prompt_id: { type: "string" },
        answers_count: { type: "integer", minimum: 0 },
        changed_sections: { type: "array", items: { type: "string" } },
        safety_notes: { type: "array", items: { type: "string" } },
        analyzer: { type: "string" },
        recorded_at: { type: "string" },
        next_action: { type: "string" },
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
            stores_input: { const: true },
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
            "draft_id",
            "prompt_id",
            "answers_count",
            "changed_sections",
            "safety_notes",
            "analyzer",
            "recorded_at",
            "next_action",
            "privacy",
          ],
        },
        { required: ["is_error", "error_code", "message"] },
      ],
    },
  } as const;

export function recordClarificationsTool(
  args: RecordClarificationsToolArguments,
  options: ScorePromptToolOptions = {},
): RecordClarificationsToolResult {
  const promptId = args.prompt_id;
  if (typeof promptId !== "string" || promptId.trim().length === 0) {
    return invalidInput("`prompt_id` must be a non-empty string.");
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

  let storage: ReturnType<typeof createSqlitePromptStorage> | undefined;
  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const auth = loadHookAuth(options.dataDir);
    storage = createSqlitePromptStorage({
      dataDir: config.data_dir,
      hmacSecret: auth.web_session_secret,
    });
  } catch (error) {
    return {
      is_error: true,
      error_code: "storage_unavailable",
      message: storageUnavailableMessage(error),
    };
  }

  try {
    const stored = storage.getPrompt(promptId);
    if (!stored) {
      return {
        is_error: true,
        error_code: "not_found",
        message: `Prompt not found in the local archive: ${promptId}.`,
      };
    }

    const createdAt = (options.now ?? new Date()).toISOString();
    const improvement: PromptImprovement = applyClarifications({
      prompt: stored.markdown,
      createdAt,
      language: args.language,
      source: "stored",
      answers: validated,
    });

    const draft = storage.createPromptImprovementDraft(promptId, {
      draft_text: improvement.improved_prompt,
      analyzer: RECORD_CLARIFICATIONS_ANALYZER,
      changed_sections: improvement.changed_sections,
      safety_notes: improvement.safety_notes,
      accepted: true,
    });

    if (!draft) {
      return {
        is_error: true,
        error_code: "not_found",
        message: `Failed to record clarifications draft for prompt ${promptId}.`,
      };
    }

    return {
      draft_id: draft.id,
      prompt_id: promptId,
      answers_count: validated.length,
      changed_sections: improvement.changed_sections,
      safety_notes: improvement.safety_notes,
      analyzer: RECORD_CLARIFICATIONS_ANALYZER,
      recorded_at: draft.created_at,
      next_action:
        "Open the draft in the local archive to review and copy. The draft body is not echoed in this response — fetch it via the local web UI or `prompt-memory show` if needed.",
      privacy: {
        local_only: true,
        stores_input: true,
        external_calls: false,
        returns_stored_prompt_body: false,
      },
    };
  } finally {
    storage.close();
  }
}

function invalidInput(message: string): RecordClarificationsToolResult {
  return {
    is_error: true,
    error_code: "invalid_input",
    message,
  };
}

function storageUnavailableMessage(error: unknown): string {
  const reason =
    error instanceof Error && error.message.length > 0
      ? ` (${error.message.split("\n")[0]})`
      : "";
  return `Local prompt-memory archive is not available. Run \`prompt-memory init\` first or pass --data-dir.${reason}`;
}
