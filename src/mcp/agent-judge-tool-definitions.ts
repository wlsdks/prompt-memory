import type { PromptCoachMcpToolDefinition } from "./score-tool-definitions.js";

const LOCAL_READ_ONLY_TOOL_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

const LOCAL_WRITE_TOOL_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
  readOnlyHint: false,
} as const;

const QUALITY_BAND_SCHEMA = {
  type: "string",
  enum: ["excellent", "good", "needs_work", "weak"],
} as const;

const QUALITY_SCORE_SCHEMA = {
  type: "object",
  required: ["value", "max", "band", "breakdown"],
  properties: {
    value: { type: "integer", minimum: 0, maximum: 100 },
    max: { const: 100 },
    band: QUALITY_BAND_SCHEMA,
    breakdown: { type: "array", items: { type: "object" } },
  },
} as const;

const TOOL_ERROR_OUTPUT_SCHEMA = {
  type: "object",
  required: ["is_error", "error_code", "message"],
  properties: {
    is_error: { const: true },
    error_code: { type: "string" },
    message: { type: "string" },
  },
} as const;

export const PREPARE_AGENT_JUDGE_BATCH_TOOL_DEFINITION: PromptCoachMcpToolDefinition =
  {
    name: "prepare_agent_judge_batch",
    description:
      "Prepare a redacted prompt-evaluation packet for the current Claude Code, Codex, or Gemini CLI agent session to judge. Use this when the user asks the active coding agent to evaluate accumulated prompt quality with an LLM judge. prompt-coach itself does not call external LLMs or route provider credentials; it only returns local redacted prompt bodies, metadata, and a rubric so the current user-controlled agent session can evaluate and then call record_agent_judgments. Defaults to recent prompts and returns no raw prompt bodies, raw absolute paths, or secrets.",
    annotations: {
      ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
      title: "Prepare agent judge packet",
    },
    inputSchema: {
      type: "object",
      properties: {
        max_prompts: { type: "integer", minimum: 1, maximum: 20 },
        selection: { type: "string", enum: ["latest", "low_score"] },
        tool: { type: "string" },
        cwd_prefix: { type: "string" },
        include_redacted_prompt: { type: "boolean" },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        mode: { const: "agent_judge_packet" },
        generated_at: { type: "string" },
        selection: { type: "string", enum: ["latest", "low_score"] },
        rubric: { type: "object" },
        prompts: {
          type: "array",
          items: {
            type: "object",
            required: [
              "prompt_id",
              "tool",
              "project",
              "received_at",
              "local_score",
              "quality_gaps",
            ],
            properties: {
              prompt_id: { type: "string" },
              tool: { type: "string" },
              project: { type: "string" },
              received_at: { type: "string" },
              local_score: QUALITY_SCORE_SCHEMA,
              quality_gaps: { type: "array", items: { type: "string" } },
              redacted_prompt: { type: "string" },
            },
          },
        },
        agent_instructions: { type: "string" },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "external_calls_by_prompt_coach",
            "intended_external_evaluator",
            "returns_redacted_prompt_bodies",
            "returns_raw_prompt_bodies",
            "returns_raw_paths",
            "stores_judgment_results",
            "auto_submits",
          ],
          properties: {
            local_only: { const: true },
            external_calls_by_prompt_coach: { const: false },
            intended_external_evaluator: {
              const: "current_agent_session",
            },
            returns_redacted_prompt_bodies: { type: "boolean" },
            returns_raw_prompt_bodies: { const: false },
            returns_raw_paths: { const: false },
            stores_judgment_results: { const: false },
            auto_submits: { const: false },
          },
        },
        is_error: TOOL_ERROR_OUTPUT_SCHEMA.properties.is_error,
        error_code: TOOL_ERROR_OUTPUT_SCHEMA.properties.error_code,
        message: TOOL_ERROR_OUTPUT_SCHEMA.properties.message,
      },
      oneOf: [
        {
          required: [
            "mode",
            "generated_at",
            "selection",
            "rubric",
            "prompts",
            "agent_instructions",
            "privacy",
          ],
        },
        TOOL_ERROR_OUTPUT_SCHEMA,
      ],
    },
  } as const;

export const RECORD_AGENT_JUDGMENTS_TOOL_DEFINITION: PromptCoachMcpToolDefinition =
  {
    name: "record_agent_judgments",
    description:
      "Store advisory prompt-quality judgments produced by the current Claude Code, Codex, or Gemini CLI agent session after prepare_agent_judge_batch. Use this only after the active agent has evaluated the redacted packet. This writes scores, confidence, summaries, risks, and suggestions, but never stores prompt bodies or raw paths. prompt-coach does not call external LLMs through this tool; the active user-controlled agent provides the judgment result.",
    annotations: {
      ...LOCAL_WRITE_TOOL_ANNOTATIONS,
      title: "Record agent prompt judgments",
    },
    inputSchema: {
      type: "object",
      required: ["provider", "judgments"],
      properties: {
        provider: {
          type: "string",
          enum: ["claude-code", "codex", "gemini-cli", "other"],
        },
        judge_model: { type: "string" },
        judgments: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            required: ["prompt_id", "score", "confidence", "summary"],
            properties: {
              prompt_id: { type: "string" },
              score: { type: "integer", minimum: 0, maximum: 100 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              summary: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
              suggestions: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        recorded: { type: "integer", minimum: 0 },
        judgments: { type: "array", items: { type: "object" } },
        failed_prompt_ids: { type: "array", items: { type: "string" } },
        next_action: { type: "string" },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "external_calls_by_prompt_coach",
            "stores_prompt_bodies",
            "stores_raw_paths",
            "stores_judgment_results",
          ],
          properties: {
            local_only: { const: true },
            external_calls_by_prompt_coach: { const: false },
            stores_prompt_bodies: { const: false },
            stores_raw_paths: { const: false },
            stores_judgment_results: { const: true },
          },
        },
        is_error: TOOL_ERROR_OUTPUT_SCHEMA.properties.is_error,
        error_code: TOOL_ERROR_OUTPUT_SCHEMA.properties.error_code,
        message: TOOL_ERROR_OUTPUT_SCHEMA.properties.message,
      },
      oneOf: [
        {
          required: [
            "recorded",
            "judgments",
            "failed_prompt_ids",
            "next_action",
            "privacy",
          ],
        },
        TOOL_ERROR_OUTPUT_SCHEMA,
      ],
    },
  } as const;
