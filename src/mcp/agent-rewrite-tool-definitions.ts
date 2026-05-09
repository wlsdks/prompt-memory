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

const TOOL_ERROR_OUTPUT_SCHEMA = {
  type: "object",
  required: ["is_error", "error_code", "message"],
  properties: {
    is_error: { const: true },
    error_code: { type: "string" },
    message: { type: "string" },
  },
} as const;

const QUALITY_CRITERION_SCHEMA = {
  type: "string",
  enum: [
    "goal_clarity",
    "background_context",
    "scope_limits",
    "output_format",
    "verification_criteria",
  ],
} as const;

export const PREPARE_AGENT_REWRITE_TOOL_DEFINITION: PromptCoachMcpToolDefinition =
  {
    name: "prepare_agent_rewrite",
    description:
      "Prepare a redacted prompt-rewrite packet for the current Claude Code, Codex, or Gemini CLI agent session to rewrite semantically. Use this when the user explicitly wants the active coding agent to improve the latest or selected stored prompt beyond prompt-coach's local deterministic rewrite. prompt-coach itself does not call external LLMs or route provider credentials; it returns one redacted prompt, local score metadata, a local baseline draft, and a strict rewrite contract. The active user-controlled agent should then produce an improved prompt and call record_agent_rewrite.",
    annotations: {
      ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
      title: "Prepare agent prompt rewrite",
    },
    inputSchema: {
      type: "object",
      properties: {
        prompt_id: {
          type: "string",
          description: "Stored prompt id to rewrite.",
        },
        latest: {
          type: "boolean",
          description:
            "Set true to rewrite the latest stored prompt. Provide exactly one of prompt_id or latest=true.",
        },
        language: { type: "string", enum: ["en", "ko"] },
        include_local_baseline: {
          type: "boolean",
          description:
            "Whether to include prompt-coach's local deterministic rewrite as a baseline. Defaults to true.",
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        mode: { const: "agent_rewrite_packet" },
        generated_at: { type: "string" },
        prompt: {
          type: "object",
          required: [
            "prompt_id",
            "tool",
            "project",
            "received_at",
            "local_score",
            "quality_gaps",
            "redacted_prompt",
          ],
          properties: {
            prompt_id: { type: "string" },
            tool: { type: "string" },
            project: { type: "string" },
            received_at: { type: "string" },
            local_score: {
              type: "object",
              required: ["value", "max", "band"],
              properties: {
                value: { type: "integer", minimum: 0, maximum: 100 },
                max: { const: 100 },
                band: QUALITY_BAND_SCHEMA,
              },
            },
            quality_gaps: { type: "array", items: { type: "string" } },
            redacted_prompt: { type: "string" },
          },
        },
        local_baseline: {
          type: "object",
          properties: {
            analyzer: { type: "string" },
            improved_prompt: { type: "string" },
            changed_sections: {
              type: "array",
              items: QUALITY_CRITERION_SCHEMA,
            },
          },
        },
        rewrite_contract: {
          type: "object",
          required: ["required_sections", "constraints", "success_criteria"],
          properties: {
            required_sections: { type: "array", items: { type: "string" } },
            constraints: { type: "array", items: { type: "string" } },
            success_criteria: { type: "array", items: { type: "string" } },
          },
        },
        agent_instructions: { type: "string" },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "external_calls_by_prompt_coach",
            "intended_external_rewriter",
            "returns_redacted_prompt_body",
            "returns_raw_prompt_body",
            "returns_raw_paths",
            "stores_rewrite_result",
            "auto_submits",
          ],
          properties: {
            local_only: { const: true },
            external_calls_by_prompt_coach: { const: false },
            intended_external_rewriter: { const: "current_agent_session" },
            returns_redacted_prompt_body: { const: true },
            returns_raw_prompt_body: { const: false },
            returns_raw_paths: { const: false },
            stores_rewrite_result: { const: false },
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
            "prompt",
            "rewrite_contract",
            "agent_instructions",
            "privacy",
          ],
        },
        TOOL_ERROR_OUTPUT_SCHEMA,
      ],
    },
  } as const;

export const RECORD_AGENT_REWRITE_TOOL_DEFINITION: PromptCoachMcpToolDefinition =
  {
    name: "record_agent_rewrite",
    description:
      "Store an approval-ready prompt rewrite produced by the current Claude Code, Codex, or Gemini CLI agent session after prepare_agent_rewrite. Use this only after the active agent has rewritten the redacted packet and the user wants that improved draft saved locally. This writes a redacted improvement draft plus provider metadata; it never stores the original prompt body, never returns the rewrite body, never stores raw paths, and prompt-coach does not call external LLMs through this tool.",
    annotations: {
      ...LOCAL_WRITE_TOOL_ANNOTATIONS,
      title: "Record agent prompt rewrite",
    },
    inputSchema: {
      type: "object",
      required: ["provider", "prompt_id", "improved_prompt"],
      properties: {
        provider: {
          type: "string",
          enum: ["claude-code", "codex", "gemini-cli", "other"],
        },
        prompt_id: { type: "string" },
        improved_prompt: { type: "string" },
        judge_model: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        summary: { type: "string" },
        changed_sections: {
          type: "array",
          items: QUALITY_CRITERION_SCHEMA,
        },
        safety_notes: { type: "array", items: { type: "string" } },
        copied: { type: "boolean" },
        accepted: { type: "boolean" },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        recorded: { const: true },
        draft: {
          type: "object",
          required: [
            "id",
            "prompt_id",
            "analyzer",
            "changed_sections",
            "safety_notes",
            "is_sensitive",
            "redaction_policy",
            "created_at",
          ],
          properties: {
            id: { type: "string" },
            prompt_id: { type: "string" },
            analyzer: { type: "string" },
            changed_sections: {
              type: "array",
              items: QUALITY_CRITERION_SCHEMA,
            },
            safety_notes: { type: "array", items: { type: "string" } },
            is_sensitive: { type: "boolean" },
            redaction_policy: { const: "mask" },
            created_at: { type: "string" },
            copied_at: { type: "string" },
            accepted_at: { type: "string" },
          },
        },
        agent_metadata: { type: "object" },
        next_action: { type: "string" },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "external_calls_by_prompt_coach",
            "stores_original_prompt_body",
            "stores_rewrite_draft",
            "returns_rewrite_draft",
            "stores_raw_paths",
          ],
          properties: {
            local_only: { const: true },
            external_calls_by_prompt_coach: { const: false },
            stores_original_prompt_body: { const: false },
            stores_rewrite_draft: { const: true },
            returns_rewrite_draft: { const: false },
            stores_raw_paths: { const: false },
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
            "draft",
            "agent_metadata",
            "next_action",
            "privacy",
          ],
        },
        TOOL_ERROR_OUTPUT_SCHEMA,
      ],
    },
  } as const;
