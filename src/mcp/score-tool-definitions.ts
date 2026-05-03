type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type JsonObject = { readonly [key: string]: JsonValue };

export type PromptMemoryMcpToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly annotations: JsonObject;
  readonly inputSchema: JsonObject;
  readonly outputSchema: JsonObject;
};

const LOCAL_READ_ONLY_TOOL_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
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
    breakdown: {
      type: "array",
      items: {
        type: "object",
        required: ["key", "label", "status", "weight", "earned"],
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          status: { type: "string", enum: ["good", "partial", "missing"] },
          weight: { type: "integer", minimum: 1 },
          earned: { type: "integer", minimum: 0 },
        },
      },
    },
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

export const GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION: PromptMemoryMcpToolDefinition =
  {
    name: "get_prompt_memory_status",
    description:
      "Check whether the local prompt-memory archive is initialized and has captured prompts before calling scoring tools. Use this first when the user asks if prompt-memory is working, whether Claude Code/Codex prompts are being captured, or which prompt-memory MCP tool to call next. Returns local readiness, safe counts, latest prompt metadata, available tool names, and next actions. It never returns prompt bodies, raw absolute paths, secrets, or external LLM results.",
    annotations: {
      ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
      title: "Prompt-memory status preflight",
    },
    inputSchema: {
      type: "object",
      properties: {
        include_latest: {
          type: "boolean",
          description:
            "Whether to include safe metadata for the latest stored prompt. Defaults to true.",
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      required: [
        "status",
        "total_prompts",
        "scored_prompts",
        "sensitive_prompts",
        "project_count",
        "available_tools",
        "next_actions",
        "privacy",
      ],
      properties: {
        status: { type: "string", enum: ["ready", "empty", "setup_needed"] },
        total_prompts: { type: "integer", minimum: 0 },
        scored_prompts: { type: "integer", minimum: 0 },
        sensitive_prompts: { type: "integer", minimum: 0 },
        project_count: { type: "integer", minimum: 0 },
        latest_prompt: {
          type: "object",
          properties: {
            id: { type: "string" },
            tool: { type: "string" },
            project: { type: "string" },
            received_at: { type: "string" },
            quality_score: { type: "integer", minimum: 0, maximum: 100 },
            quality_score_band: QUALITY_BAND_SCHEMA,
            is_sensitive: { type: "boolean" },
          },
        },
        available_tools: { type: "array", items: { type: "string" } },
        next_actions: { type: "array", items: { type: "string" } },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "external_calls",
            "returns_prompt_bodies",
            "returns_raw_paths",
          ],
          properties: {
            local_only: { const: true },
            external_calls: { const: false },
            returns_prompt_bodies: { const: false },
            returns_raw_paths: { const: false },
          },
        },
      },
    },
  } as const;

export const SCORE_PROMPT_TOOL_DEFINITION: PromptMemoryMcpToolDefinition = {
  name: "score_prompt",
  description:
    "Score a coding prompt with prompt-memory's local deterministic 0-100 Prompt Quality Score. Use this when the user asks Claude Code or Codex to evaluate the current request, a pasted prompt, a stored prompt id, or the latest captured prompt. The tool does not call external LLMs, does not store direct prompt input, and does not return prompt bodies.",
  annotations: {
    ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    title: "Prompt quality score",
  },
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Prompt text to score directly. Use for the user's current or pasted prompt. This input is analyzed locally and is not stored by this tool.",
      },
      prompt_id: {
        type: "string",
        description:
          "Stored prompt id to score from the local prompt-memory archive.",
      },
      latest: {
        type: "boolean",
        description:
          "Set true to score the latest stored prompt in the local prompt-memory archive.",
      },
      include_suggestions: {
        type: "boolean",
        description:
          "Whether to include concise improvement suggestions in the result. Defaults to true.",
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      source: { type: "string", enum: ["text", "prompt_id", "latest"] },
      prompt_id: { type: "string" },
      quality_score: QUALITY_SCORE_SCHEMA,
      summary: { type: "string" },
      checklist: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "label", "status", "reason", "weight", "earned"],
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            status: { type: "string", enum: ["good", "partial", "missing"] },
            reason: { type: "string" },
            suggestion: { type: "string" },
            weight: { type: "integer", minimum: 1 },
            earned: { type: "integer", minimum: 0 },
          },
        },
      },
      warnings: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
      analyzer: { type: "string" },
      privacy: {
        type: "object",
        required: [
          "local_only",
          "stores_input",
          "external_calls",
          "returns_prompt_body",
        ],
        properties: {
          local_only: { const: true },
          stores_input: { const: false },
          external_calls: { const: false },
          returns_prompt_body: { const: false },
        },
      },
      is_error: TOOL_ERROR_OUTPUT_SCHEMA.properties.is_error,
      error_code: TOOL_ERROR_OUTPUT_SCHEMA.properties.error_code,
      message: TOOL_ERROR_OUTPUT_SCHEMA.properties.message,
    },
    oneOf: [
      {
        required: [
          "source",
          "quality_score",
          "summary",
          "checklist",
          "warnings",
          "analyzer",
          "privacy",
        ],
      },
      TOOL_ERROR_OUTPUT_SCHEMA,
    ],
  },
} as const;

export const IMPROVE_PROMPT_TOOL_DEFINITION: PromptMemoryMcpToolDefinition = {
  name: "improve_prompt",
  description:
    "Generate an approval-ready improved coding prompt draft with prompt-memory's local deterministic Prompt Coach. Use this when the user asks Claude Code or Codex to rewrite, clarify, or upgrade the current request, a pasted prompt, a stored prompt id, or the latest captured prompt before resubmitting it. The tool is copy-based: it never auto-submits the draft, never calls external LLMs, does not store direct prompt input, and does not return the original stored prompt body.",
  annotations: {
    ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    title: "Approval-ready prompt rewrite",
  },
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "Prompt text to improve directly. Use for the user's current or pasted prompt. This input is redacted locally and is not stored by this tool.",
      },
      prompt_id: {
        type: "string",
        description:
          "Stored prompt id to improve from the local prompt-memory archive without returning the original stored body.",
      },
      latest: {
        type: "boolean",
        description:
          "Set true to improve the latest stored prompt in the local prompt-memory archive.",
      },
      language: {
        type: "string",
        enum: ["en", "ko"],
        description:
          "Language for the improved draft and safety notes. Defaults to en.",
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      source: { type: "string", enum: ["text", "prompt_id", "latest"] },
      prompt_id: { type: "string" },
      mode: { const: "copy" },
      requires_user_approval: { const: true },
      summary: { type: "string" },
      improved_prompt: { type: "string" },
      changed_sections: { type: "array", items: { type: "string" } },
      safety_notes: { type: "array", items: { type: "string" } },
      created_at: { type: "string" },
      analyzer: { type: "string" },
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
          stores_input: { const: false },
          external_calls: { const: false },
          returns_stored_prompt_body: { const: false },
        },
      },
      is_error: TOOL_ERROR_OUTPUT_SCHEMA.properties.is_error,
      error_code: TOOL_ERROR_OUTPUT_SCHEMA.properties.error_code,
      message: TOOL_ERROR_OUTPUT_SCHEMA.properties.message,
    },
    oneOf: [
      {
        required: [
          "source",
          "mode",
          "requires_user_approval",
          "summary",
          "improved_prompt",
          "changed_sections",
          "safety_notes",
          "created_at",
          "analyzer",
          "next_action",
          "privacy",
        ],
      },
      TOOL_ERROR_OUTPUT_SCHEMA,
    ],
  },
} as const;

export const SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION: PromptMemoryMcpToolDefinition =
  {
    name: "score_prompt_archive",
    description:
      "Score the local prompt-memory archive across many stored Claude Code or Codex prompts. Use this when the user asks to evaluate accumulated prompt habits, score all recent prompts, find low scoring prompts, summarize recurring prompt quality gaps, or prepare the next better request. The result is a local-only aggregate report with distribution, recurring gaps, a practice plan, a next prompt template, and low-score metadata; it does not return prompt bodies, raw paths, or call external LLMs.",
    annotations: {
      ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
      title: "Archive prompt habit score",
    },
    inputSchema: {
      type: "object",
      properties: {
        max_prompts: {
          type: "integer",
          minimum: 1,
          maximum: 1000,
          description:
            "Maximum number of recent stored prompts to score. Defaults to 200.",
        },
        low_score_limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description:
            "Maximum number of lowest scoring prompt summaries to return. Defaults to 10.",
        },
        tool: {
          type: "string",
          description:
            "Optional exact tool filter, for example claude-code or codex.",
        },
        cwd_prefix: {
          type: "string",
          description:
            "Optional project/path prefix filter. The response returns only a project label, not a raw path.",
        },
        received_from: {
          type: "string",
          description:
            "Optional lower received_at bound. Date-only or ISO timestamp.",
        },
        received_to: {
          type: "string",
          description:
            "Optional upper received_at bound. Date-only or ISO timestamp.",
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        generated_at: { type: "string" },
        archive_score: {
          type: "object",
          required: [
            "average",
            "max",
            "band",
            "scored_prompts",
            "total_prompts",
          ],
          properties: {
            average: { type: "integer", minimum: 0, maximum: 100 },
            max: { const: 100 },
            band: QUALITY_BAND_SCHEMA,
            scored_prompts: { type: "integer", minimum: 0 },
            total_prompts: { type: "integer", minimum: 0 },
          },
        },
        distribution: {
          type: "object",
          properties: {
            excellent: { type: "integer", minimum: 0 },
            good: { type: "integer", minimum: 0 },
            needs_work: { type: "integer", minimum: 0 },
            weak: { type: "integer", minimum: 0 },
          },
        },
        top_gaps: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "count", "rate"],
            properties: {
              label: { type: "string" },
              count: { type: "integer", minimum: 0 },
              rate: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
        practice_plan: {
          type: "array",
          items: {
            type: "object",
            required: [
              "priority",
              "label",
              "prompt_rule",
              "reason",
              "count",
              "rate",
            ],
            properties: {
              priority: { type: "integer", minimum: 1 },
              label: { type: "string" },
              prompt_rule: { type: "string" },
              reason: { type: "string" },
              count: { type: "integer", minimum: 0 },
              rate: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
        next_prompt_template: { type: "string" },
        low_score_prompts: {
          type: "array",
          items: {
            type: "object",
            required: [
              "id",
              "tool",
              "project",
              "received_at",
              "quality_score",
              "quality_score_band",
              "quality_gaps",
              "tags",
              "is_sensitive",
            ],
            properties: {
              id: { type: "string" },
              tool: { type: "string" },
              project: { type: "string" },
              received_at: { type: "string" },
              quality_score: { type: "integer", minimum: 0, maximum: 100 },
              quality_score_band: QUALITY_BAND_SCHEMA,
              quality_gaps: { type: "array", items: { type: "string" } },
              tags: { type: "array", items: { type: "string" } },
              is_sensitive: { type: "boolean" },
            },
          },
        },
        filters: {
          type: "object",
          properties: {
            tool: { type: "string" },
            project: { type: "string" },
            received_from: { type: "string" },
            received_to: { type: "string" },
            max_prompts: { type: "integer", minimum: 1 },
          },
        },
        has_more: { type: "boolean" },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "external_calls",
            "returns_prompt_bodies",
            "returns_raw_paths",
          ],
          properties: {
            local_only: { const: true },
            external_calls: { const: false },
            returns_prompt_bodies: { const: false },
            returns_raw_paths: { const: false },
          },
        },
        is_error: TOOL_ERROR_OUTPUT_SCHEMA.properties.is_error,
        error_code: TOOL_ERROR_OUTPUT_SCHEMA.properties.error_code,
        message: TOOL_ERROR_OUTPUT_SCHEMA.properties.message,
      },
      oneOf: [
        {
          required: [
            "generated_at",
            "archive_score",
            "distribution",
            "top_gaps",
            "practice_plan",
            "next_prompt_template",
            "low_score_prompts",
            "filters",
            "has_more",
            "privacy",
          ],
        },
        TOOL_ERROR_OUTPUT_SCHEMA,
      ],
    },
  } as const;

export const REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION: PromptMemoryMcpToolDefinition =
  {
    name: "review_project_instructions",
    description:
      "Review a local project's Claude Code/Codex instruction files such as AGENTS.md and CLAUDE.md using prompt-memory's deterministic local rubric. Use this when the user asks whether project rules are good enough, wants agent instructions scored, or wants suggestions for improving coding-agent behavior. With no project_id, set latest=true or omit project_id to review the most recently captured project. The tool can rescan local instruction files, but returns only file metadata, checklist scores, and suggestions; it never returns file bodies, raw absolute paths, or calls external LLMs.",
    annotations: {
      ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
      title: "Project instruction review",
    },
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description:
            "Optional prompt-memory project id from the Projects UI/API. Use this for an exact project.",
        },
        latest: {
          type: "boolean",
          description:
            "Set true to review the most recently captured local project. Defaults to true when project_id is omitted.",
        },
        analyze: {
          type: "boolean",
          description:
            "Whether to rescan AGENTS.md/CLAUDE.md before returning the review. Defaults to true.",
        },
        include_suggestions: {
          type: "boolean",
          description:
            "Whether to include concise instruction-file improvement suggestions. Defaults to true.",
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["project_id", "latest"] },
        project_id: { type: "string" },
        project_label: { type: "string" },
        generated_fresh: { type: "boolean" },
        review: {
          type: "object",
          required: [
            "generated_at",
            "analyzer",
            "score",
            "files",
            "files_found",
            "checklist",
            "suggestions",
            "privacy",
          ],
          properties: {
            generated_at: { type: "string" },
            analyzer: { type: "string" },
            score: {
              type: "object",
              required: ["value", "max", "band"],
              properties: {
                value: { type: "integer", minimum: 0, maximum: 100 },
                max: { const: 100 },
                band: QUALITY_BAND_SCHEMA,
              },
            },
            files: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "file_name",
                  "bytes",
                  "modified_at",
                  "content_hash",
                  "truncated",
                ],
                properties: {
                  file_name: { type: "string" },
                  bytes: { type: "integer", minimum: 0 },
                  modified_at: { type: "string" },
                  content_hash: { type: "string" },
                  truncated: { type: "boolean" },
                },
              },
            },
            files_found: { type: "integer", minimum: 0 },
            checklist: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  status: { type: "string" },
                  points: { type: "integer", minimum: 0 },
                  max_points: { type: "integer", minimum: 0 },
                  evidence: { type: "string" },
                  suggestion: { type: "string" },
                },
              },
            },
            suggestions: { type: "array", items: { type: "string" } },
            privacy: {
              type: "object",
              required: [
                "local_only",
                "external_calls",
                "stores_file_bodies",
                "returns_file_bodies",
                "returns_raw_paths",
              ],
              properties: {
                local_only: { const: true },
                external_calls: { const: false },
                stores_file_bodies: { const: false },
                returns_file_bodies: { const: false },
                returns_raw_paths: { const: false },
              },
            },
          },
        },
        suggestions: { type: "array", items: { type: "string" } },
        next_action: { type: "string" },
        privacy: {
          type: "object",
          required: [
            "local_only",
            "external_calls",
            "stores_file_bodies",
            "returns_file_bodies",
            "returns_raw_paths",
          ],
          properties: {
            local_only: { const: true },
            external_calls: { const: false },
            stores_file_bodies: { const: false },
            returns_file_bodies: { const: false },
            returns_raw_paths: { const: false },
          },
        },
        is_error: TOOL_ERROR_OUTPUT_SCHEMA.properties.is_error,
        error_code: TOOL_ERROR_OUTPUT_SCHEMA.properties.error_code,
        message: TOOL_ERROR_OUTPUT_SCHEMA.properties.message,
      },
      oneOf: [
        {
          required: [
            "source",
            "project_id",
            "project_label",
            "generated_fresh",
            "review",
            "next_action",
            "privacy",
          ],
        },
        TOOL_ERROR_OUTPUT_SCHEMA,
      ],
    },
  } as const;

export const COACH_PROMPT_TOOL_DEFINITION: PromptMemoryMcpToolDefinition = {
  name: "coach_prompt",
  description:
    "Run prompt-memory's one-call agent coaching workflow for Claude Code or Codex. Use this when the user asks to coach the latest request, check whether the prompt is good enough, improve it, summarize recurring habits, review project rules, or generate the next better request without opening the web UI. It combines local status, latest prompt score, approval-required rewrite, archive habit review, and optional AGENTS.md/CLAUDE.md rule review. It is read-only, local-only, never auto-submits drafts, and never returns prompt bodies, raw paths, instruction file bodies, secrets, or external LLM results.",
  annotations: {
    ...LOCAL_READ_ONLY_TOOL_ANNOTATIONS,
    title: "One-call prompt coach",
  },
  inputSchema: {
    type: "object",
    properties: {
      include_latest_score: {
        type: "boolean",
        description:
          "Whether to score the latest captured prompt. Defaults to true.",
      },
      include_improvement: {
        type: "boolean",
        description:
          "Whether to include an approval-ready rewrite for the latest captured prompt. Defaults to true.",
      },
      include_archive: {
        type: "boolean",
        description:
          "Whether to include recent habit analysis, practice plan, and next prompt template. Defaults to true.",
      },
      include_project_rules: {
        type: "boolean",
        description:
          "Whether to review AGENTS.md/CLAUDE.md for the latest captured project. Defaults to true.",
      },
      max_prompts: {
        type: "integer",
        minimum: 1,
        maximum: 1000,
        description:
          "Maximum recent prompts for habit review. Defaults to 200.",
      },
      low_score_limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Maximum low-score prompt ids to include. Defaults to 8.",
      },
      language: {
        type: "string",
        enum: ["en", "ko"],
        description: "Language for improvement draft. Defaults to en.",
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    required: ["mode", "generated_at", "status", "agent_brief", "privacy"],
    properties: {
      mode: { const: "agent_coach" },
      generated_at: { type: "string" },
      status: GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION.outputSchema,
      latest_score: SCORE_PROMPT_TOOL_DEFINITION.outputSchema,
      improvement: IMPROVE_PROMPT_TOOL_DEFINITION.outputSchema,
      archive: SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION.outputSchema,
      project_rules: REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION.outputSchema,
      agent_brief: {
        type: "object",
        required: [
          "headline",
          "summary",
          "next_actions",
          "suggested_user_response",
        ],
        properties: {
          headline: { type: "string" },
          summary: { type: "string" },
          next_actions: { type: "array", items: { type: "string" } },
          suggested_user_response: { type: "string" },
        },
      },
      privacy: {
        type: "object",
        required: [
          "local_only",
          "external_calls",
          "returns_prompt_bodies",
          "returns_raw_paths",
          "returns_instruction_file_bodies",
          "auto_submits",
        ],
        properties: {
          local_only: { const: true },
          external_calls: { const: false },
          returns_prompt_bodies: { const: false },
          returns_raw_paths: { const: false },
          returns_instruction_file_bodies: { const: false },
          auto_submits: { const: false },
        },
      },
    },
  },
} as const;

export const PROMPT_MEMORY_MCP_TOOL_DEFINITIONS: readonly PromptMemoryMcpToolDefinition[] =
  [
    GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION,
    COACH_PROMPT_TOOL_DEFINITION,
    SCORE_PROMPT_TOOL_DEFINITION,
    IMPROVE_PROMPT_TOOL_DEFINITION,
    SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION,
    REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION,
  ];

export function listPromptMemoryMcpToolNames(): string[] {
  return PROMPT_MEMORY_MCP_TOOL_DEFINITIONS.map((tool) => tool.name);
}
