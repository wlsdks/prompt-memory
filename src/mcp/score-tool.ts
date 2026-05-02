import { analyzePrompt } from "../analysis/analyze.js";
import {
  createArchiveScoreReport,
  type ArchiveScoreReport,
} from "../analysis/archive-score.js";
import { improvePrompt, type PromptImprovement } from "../analysis/improve.js";
import { loadHookAuth, loadPromptMemoryConfig } from "../config/config.js";
import type {
  PromptAnalysisPreview,
  PromptQualityScore,
} from "../shared/schema.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import type {
  ProjectInstructionReview,
  PromptSummary,
} from "../storage/ports.js";

export type ScorePromptToolArguments = {
  prompt?: string;
  prompt_id?: string;
  latest?: boolean;
  include_suggestions?: boolean;
};

export type ImprovePromptToolArguments = {
  prompt?: string;
  prompt_id?: string;
  latest?: boolean;
  language?: "en" | "ko";
};

export type ScorePromptToolOptions = {
  dataDir?: string;
  now?: Date;
};

export type ScorePromptArchiveToolArguments = {
  max_prompts?: number;
  low_score_limit?: number;
  tool?: string;
  cwd_prefix?: string;
  received_from?: string;
  received_to?: string;
};

export type ReviewProjectInstructionsToolArguments = {
  project_id?: string;
  latest?: boolean;
  analyze?: boolean;
  include_suggestions?: boolean;
};

export type GetPromptMemoryStatusToolArguments = {
  include_latest?: boolean;
};

export type ScorePromptToolResult =
  | {
      source: "text" | "prompt_id" | "latest";
      prompt_id?: string;
      quality_score: PromptQualityScore;
      summary: string;
      checklist: Array<
        PromptAnalysisPreview["checklist"][number] & {
          weight: number;
          earned: number;
        }
      >;
      warnings: string[];
      suggestions?: string[];
      analyzer: string;
      privacy: {
        local_only: true;
        stores_input: false;
        external_calls: false;
        returns_prompt_body: false;
      };
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type ScorePromptArchiveToolResult =
  | ArchiveScoreReport
  | {
      is_error: true;
      error_code: "storage_unavailable";
      message: string;
    };

export type ImprovePromptToolResult =
  | (PromptImprovement & {
      source: "text" | "prompt_id" | "latest";
      prompt_id?: string;
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
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type ReviewProjectInstructionsToolResult =
  | {
      source: "project_id" | "latest";
      project_id: string;
      project_label: string;
      generated_fresh: boolean;
      review: ProjectInstructionReview;
      suggestions?: string[];
      next_action: string;
      privacy: ProjectInstructionReview["privacy"];
    }
  | {
      is_error: true;
      error_code: "invalid_input" | "not_found" | "storage_unavailable";
      message: string;
    };

export type GetPromptMemoryStatusToolResult = {
  status: "ready" | "empty" | "setup_needed";
  total_prompts: number;
  scored_prompts: number;
  sensitive_prompts: number;
  project_count: number;
  latest_prompt?: {
    id: string;
    tool: string;
    project: string;
    received_at: string;
    quality_score: number;
    quality_score_band: string;
    is_sensitive: boolean;
  };
  available_tools: string[];
  next_actions: string[];
  privacy: {
    local_only: true;
    external_calls: false;
    returns_prompt_bodies: false;
    returns_raw_paths: false;
  };
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

export const GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION = {
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

export const SCORE_PROMPT_TOOL_DEFINITION = {
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

export const IMPROVE_PROMPT_TOOL_DEFINITION = {
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

export const SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION = {
  name: "score_prompt_archive",
  description:
    "Score the local prompt-memory archive across many stored Claude Code or Codex prompts. Use this when the user asks to evaluate accumulated prompt habits, score all recent prompts, find low scoring prompts, or summarize recurring prompt quality gaps. The result is a local-only aggregate report and low-score metadata; it does not return prompt bodies, raw paths, or call external LLMs.",
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
        required: ["average", "max", "band", "scored_prompts", "total_prompts"],
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

export const REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION = {
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

export function scorePromptTool(
  args: ScorePromptToolArguments,
  options: ScorePromptToolOptions = {},
): ScorePromptToolResult {
  const inputCount = [args.prompt, args.prompt_id, args.latest === true].filter(
    Boolean,
  ).length;

  if (inputCount !== 1) {
    return toolError(
      "invalid_input",
      "Provide exactly one of `prompt`, `prompt_id`, or `latest: true`.",
    );
  }

  if (args.prompt !== undefined) {
    const prompt = args.prompt.trim();
    if (!prompt) {
      return toolError("invalid_input", "`prompt` must not be empty.");
    }

    return toToolResult({
      source: "text",
      analysis: analyzePrompt({
        prompt,
        createdAt: (options.now ?? new Date()).toISOString(),
      }),
      includeSuggestions: args.include_suggestions !== false,
    });
  }

  return withStoredPrompt(args, options);
}

export function improvePromptTool(
  args: ImprovePromptToolArguments,
  options: ScorePromptToolOptions = {},
): ImprovePromptToolResult {
  const inputCount = [args.prompt, args.prompt_id, args.latest === true].filter(
    Boolean,
  ).length;

  if (inputCount !== 1) {
    return improvementToolError(
      "invalid_input",
      "Provide exactly one of `prompt`, `prompt_id`, or `latest: true`.",
    );
  }

  if (args.prompt !== undefined) {
    const prompt = args.prompt.trim();
    if (!prompt) {
      return improvementToolError(
        "invalid_input",
        "`prompt` must not be empty.",
      );
    }

    return toImprovementToolResult({
      source: "text",
      improvement: improvePrompt({
        prompt,
        createdAt: (options.now ?? new Date()).toISOString(),
        language: args.language,
      }),
    });
  }

  return withStoredPromptImprovement(args, options);
}

export function scorePromptArchiveTool(
  args: ScorePromptArchiveToolArguments,
  options: ScorePromptToolOptions = {},
): ScorePromptArchiveToolResult {
  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const auth = loadHookAuth(options.dataDir);
    const storage = createSqlitePromptStorage({
      dataDir: config.data_dir,
      hmacSecret: auth.web_session_secret,
    });

    try {
      return createArchiveScoreReport(
        storage,
        {
          maxPrompts: args.max_prompts,
          lowScoreLimit: args.low_score_limit,
          tool: args.tool,
          cwdPrefix: args.cwd_prefix,
          receivedFrom: args.received_from,
          receivedTo: args.received_to,
        },
        options.now,
      );
    } finally {
      storage.close();
    }
  } catch (error) {
    return {
      is_error: true,
      error_code: "storage_unavailable",
      message: `Local prompt-memory archive is not available. Run \`prompt-memory init\` first or pass --data-dir. ${errorMessage(error)}`,
    };
  }
}

export function getPromptMemoryStatusTool(
  args: GetPromptMemoryStatusToolArguments,
  options: ScorePromptToolOptions = {},
): GetPromptMemoryStatusToolResult {
  const privacy = {
    local_only: true,
    external_calls: false,
    returns_prompt_bodies: false,
    returns_raw_paths: false,
  } as const;

  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const auth = loadHookAuth(options.dataDir);
    const storage = createSqlitePromptStorage({
      dataDir: config.data_dir,
      hmacSecret: auth.web_session_secret,
    });

    try {
      const dashboard = storage.getQualityDashboard();
      const projects = storage.listProjects();
      const latest =
        args.include_latest === false
          ? undefined
          : storage.listPrompts({ limit: 1 }).items[0];

      return {
        status: dashboard.total_prompts > 0 ? "ready" : "empty",
        total_prompts: dashboard.total_prompts,
        scored_prompts: dashboard.quality_score.scored_prompts,
        sensitive_prompts: dashboard.sensitive_prompts,
        project_count: projects.items.length,
        ...(latest ? { latest_prompt: toSafeLatestPrompt(latest) } : {}),
        available_tools: availableMcpToolNames(),
        next_actions:
          dashboard.total_prompts > 0
            ? [
                "Use score_prompt with latest=true to evaluate the latest captured prompt.",
                "Use improve_prompt with latest=true to generate an approval-ready rewritten request.",
                "Use score_prompt_archive to review accumulated prompt habits.",
                "Use review_project_instructions to check AGENTS.md/CLAUDE.md quality for a captured project.",
              ]
            : [
                "Capture at least one Claude Code or Codex prompt, then rerun get_prompt_memory_status.",
                "Run prompt-memory setup if hooks are not installed yet.",
              ],
        privacy,
      };
    } finally {
      storage.close();
    }
  } catch {
    return {
      status: "setup_needed",
      total_prompts: 0,
      scored_prompts: 0,
      sensitive_prompts: 0,
      project_count: 0,
      available_tools: availableMcpToolNames(),
      next_actions: [
        "Run prompt-memory init or prompt-memory setup before using archive-backed MCP tools.",
        "After setup, capture a Claude Code or Codex prompt and rerun get_prompt_memory_status.",
      ],
      privacy,
    };
  }
}

export function reviewProjectInstructionsTool(
  args: ReviewProjectInstructionsToolArguments,
  options: ScorePromptToolOptions = {},
): ReviewProjectInstructionsToolResult {
  if (args.project_id && args.latest === true) {
    return projectInstructionToolError(
      "invalid_input",
      "Provide either `project_id` or `latest: true`, not both.",
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
      const project = args.project_id
        ? storage
            .listProjects()
            .items.find((item) => item.project_id === args.project_id)
        : storage.listProjects().items[0];

      if (!project) {
        return projectInstructionToolError(
          "not_found",
          "No stored project is available to review. Capture at least one prompt first.",
        );
      }

      const shouldAnalyze = args.analyze !== false;
      const review = shouldAnalyze
        ? storage.analyzeProjectInstructions(project.project_id)
        : storage.getProjectInstructionReview(project.project_id);

      if (!review) {
        return projectInstructionToolError(
          "not_found",
          `Project instruction review is not available for project_id: ${project.project_id}.`,
        );
      }

      const missingOrWeak = review.checklist.filter(
        (item) => item.status !== "good",
      );
      const nextItem = missingOrWeak[0];

      return {
        source: args.project_id ? "project_id" : "latest",
        project_id: project.project_id,
        project_label: project.label,
        generated_fresh: shouldAnalyze,
        review,
        ...(args.include_suggestions === false
          ? {}
          : { suggestions: review.suggestions }),
        next_action: nextItem
          ? (nextItem.suggestion ??
            `Improve the ${nextItem.label.toLowerCase()} section.`)
          : "Project instruction files cover the core agent workflow. Keep them updated when verification or privacy rules change.",
        privacy: review.privacy,
      };
    } finally {
      storage.close();
    }
  } catch (error) {
    return projectInstructionToolError(
      "storage_unavailable",
      `Local prompt-memory archive is not available. Run \`prompt-memory init\` first or pass --data-dir. ${errorMessage(error)}`,
    );
  }
}

function withStoredPrompt(
  args: ScorePromptToolArguments,
  options: ScorePromptToolOptions,
): ScorePromptToolResult {
  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const auth = loadHookAuth(options.dataDir);
    const storage = createSqlitePromptStorage({
      dataDir: config.data_dir,
      hmacSecret: auth.web_session_secret,
    });

    try {
      const id =
        args.prompt_id ??
        (args.latest === true
          ? storage.listPrompts({ limit: 1 }).items[0]?.id
          : undefined);

      if (!id) {
        return toolError(
          "not_found",
          "No stored prompt is available to score.",
        );
      }

      const prompt = storage.getPrompt(id);
      if (!prompt?.analysis) {
        return toolError(
          "not_found",
          `Prompt not found or not analyzed: ${id}`,
        );
      }

      return toToolResult({
        source: args.latest === true ? "latest" : "prompt_id",
        promptId: id,
        analysis: prompt.analysis,
        includeSuggestions: args.include_suggestions !== false,
      });
    } finally {
      storage.close();
    }
  } catch (error) {
    return toolError(
      "storage_unavailable",
      `Local prompt-memory archive is not available. Run \`prompt-memory init\` first or pass --data-dir. ${errorMessage(error)}`,
    );
  }
}

function toToolResult(input: {
  source: "text" | "prompt_id" | "latest";
  promptId?: string;
  analysis: PromptAnalysisPreview;
  includeSuggestions: boolean;
}): ScorePromptToolResult {
  const breakdownByKey = new Map(
    input.analysis.quality_score.breakdown.map((item) => [item.key, item]),
  );

  return {
    source: input.source,
    ...(input.promptId ? { prompt_id: input.promptId } : {}),
    quality_score: input.analysis.quality_score,
    summary: input.analysis.summary,
    checklist: input.analysis.checklist.map((item) => {
      const score = breakdownByKey.get(item.key);
      return {
        ...item,
        weight: score?.weight ?? 0,
        earned: score?.earned ?? 0,
      };
    }),
    warnings: input.analysis.warnings,
    ...(input.includeSuggestions
      ? { suggestions: input.analysis.suggestions }
      : {}),
    analyzer: input.analysis.analyzer,
    privacy: {
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_prompt_body: false,
    },
  };
}

function toSafeLatestPrompt(prompt: PromptSummary) {
  return {
    id: prompt.id,
    tool: prompt.tool,
    project: projectLabel(prompt.cwd),
    received_at: prompt.received_at,
    quality_score: prompt.quality_score,
    quality_score_band: prompt.quality_score_band,
    is_sensitive: prompt.is_sensitive,
  };
}

function projectLabel(cwd: string): string {
  return cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? "project";
}

function availableMcpToolNames(): string[] {
  return [
    GET_PROMPT_MEMORY_STATUS_TOOL_DEFINITION.name,
    SCORE_PROMPT_TOOL_DEFINITION.name,
    IMPROVE_PROMPT_TOOL_DEFINITION.name,
    SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION.name,
    REVIEW_PROJECT_INSTRUCTIONS_TOOL_DEFINITION.name,
  ];
}

function withStoredPromptImprovement(
  args: ImprovePromptToolArguments,
  options: ScorePromptToolOptions,
): ImprovePromptToolResult {
  try {
    const config = loadPromptMemoryConfig(options.dataDir);
    const auth = loadHookAuth(options.dataDir);
    const storage = createSqlitePromptStorage({
      dataDir: config.data_dir,
      hmacSecret: auth.web_session_secret,
    });

    try {
      const id =
        args.prompt_id ??
        (args.latest === true
          ? storage.listPrompts({ limit: 1 }).items[0]?.id
          : undefined);

      if (!id) {
        return improvementToolError(
          "not_found",
          "No stored prompt is available to improve.",
        );
      }

      const prompt = storage.getPrompt(id);
      if (!prompt?.analysis) {
        return improvementToolError(
          "not_found",
          `Prompt not found or not analyzed: ${id}`,
        );
      }

      return toImprovementToolResult({
        source: args.latest === true ? "latest" : "prompt_id",
        promptId: id,
        improvement: improvePrompt({
          prompt: prompt.analysis.summary,
          createdAt: (options.now ?? new Date()).toISOString(),
          language: args.language,
        }),
      });
    } finally {
      storage.close();
    }
  } catch (error) {
    return improvementToolError(
      "storage_unavailable",
      `Local prompt-memory archive is not available. Run \`prompt-memory init\` first or pass --data-dir. ${errorMessage(error)}`,
    );
  }
}

function toImprovementToolResult(input: {
  source: "text" | "prompt_id" | "latest";
  promptId?: string;
  improvement: PromptImprovement;
}): ImprovePromptToolResult {
  return {
    ...input.improvement,
    source: input.source,
    ...(input.promptId ? { prompt_id: input.promptId } : {}),
    improved_prompt: removeOriginalPromptSection(
      input.improvement.improved_prompt,
    ),
    next_action:
      "Review the draft, copy it manually, and resubmit it only after user approval.",
    privacy: {
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_stored_prompt_body: false,
    },
  };
}

function removeOriginalPromptSection(draft: string): string {
  return draft
    .replace(/\n## Original prompt\n[\s\S]*$/u, "")
    .replace(/\n## 원문\n[\s\S]*$/u, "")
    .trim();
}

function toolError(
  errorCode: ScorePromptToolResult extends infer TResult
    ? TResult extends { error_code: infer TCode }
      ? TCode
      : never
    : never,
  message: string,
): ScorePromptToolResult {
  return {
    is_error: true,
    error_code: errorCode,
    message,
  };
}

function improvementToolError(
  errorCode: ImprovePromptToolResult extends infer TResult
    ? TResult extends { error_code: infer TCode }
      ? TCode
      : never
    : never,
  message: string,
): ImprovePromptToolResult {
  return {
    is_error: true,
    error_code: errorCode,
    message,
  };
}

function projectInstructionToolError(
  errorCode: ReviewProjectInstructionsToolResult extends infer TResult
    ? TResult extends { error_code: infer TCode }
      ? TCode
      : never
    : never,
  message: string,
): ReviewProjectInstructionsToolResult {
  return {
    is_error: true,
    error_code: errorCode,
    message,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
