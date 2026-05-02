import { analyzePrompt } from "../analysis/analyze.js";
import { loadHookAuth, loadPromptMemoryConfig } from "../config/config.js";
import type {
  PromptAnalysisPreview,
  PromptQualityScore,
} from "../shared/schema.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";

export type ScorePromptToolArguments = {
  prompt?: string;
  prompt_id?: string;
  latest?: boolean;
  include_suggestions?: boolean;
};

export type ScorePromptToolOptions = {
  dataDir?: string;
  now?: Date;
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

export const SCORE_PROMPT_TOOL_DEFINITION = {
  name: "score_prompt",
  description:
    "Score a coding prompt with prompt-memory's local deterministic 0-100 Prompt Quality Score. Use this when the user asks Claude Code or Codex to evaluate the current request, a pasted prompt, a stored prompt id, or the latest captured prompt. The tool does not call external LLMs, does not store direct prompt input, and does not return prompt bodies.",
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
