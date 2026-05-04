import { improvePrompt } from "../analysis/improve.js";
import { loadHookAuth, loadPromptMemoryConfig } from "../config/config.js";
import { redactPrompt } from "../redaction/redact.js";
import type { PromptQualityCriterion } from "../shared/schema.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import type {
  PrepareAgentRewriteToolArguments,
  PrepareAgentRewriteToolResult,
  RecordAgentRewriteToolArguments,
  RecordAgentRewriteToolResult,
} from "./agent-rewrite-tool-types.js";
import type { ScorePromptToolOptions } from "./score-tool-types.js";

const PROVIDERS = ["claude-code", "codex", "gemini-cli", "other"] as const;
const QUALITY_CRITERIA = [
  "goal_clarity",
  "background_context",
  "scope_limits",
  "output_format",
  "verification_criteria",
] as const satisfies readonly PromptQualityCriterion[];

export function prepareAgentRewriteTool(
  args: PrepareAgentRewriteToolArguments,
  options: ScorePromptToolOptions = {},
): PrepareAgentRewriteToolResult {
  const inputCount = [args.prompt_id, args.latest === true].filter(
    Boolean,
  ).length;
  if (inputCount !== 1) {
    return rewriteError(
      "invalid_input",
      "Provide exactly one of `prompt_id` or `latest: true`.",
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
      const promptId =
        args.prompt_id ??
        (args.latest === true
          ? storage.listPrompts({ limit: 1 }).items[0]?.id
          : undefined);

      if (!promptId) {
        return rewriteError(
          "not_found",
          "No stored prompt is available for agent rewrite. Capture a Claude Code or Codex prompt first, or pass `prompt_id` for an existing one.",
        );
      }

      const prompt = storage.getPrompt(promptId);
      if (!prompt?.analysis) {
        return rewriteError(
          "not_found",
          `Prompt not found or not analyzed: ${promptId}. Run get_prompt_memory_status to confirm the archive state, or pass a different \`prompt_id\`.`,
        );
      }

      const localBaseline =
        args.include_local_baseline === false
          ? undefined
          : improvePrompt({
              prompt: prompt.markdown,
              createdAt: (options.now ?? new Date()).toISOString(),
              language: args.language,
              source: "stored",
            });

      return {
        mode: "agent_rewrite_packet",
        generated_at: (options.now ?? new Date()).toISOString(),
        prompt: {
          prompt_id: prompt.id,
          tool: prompt.tool,
          project: projectLabel(prompt.cwd),
          received_at: prompt.received_at,
          local_score: {
            value: prompt.analysis.quality_score.value,
            max: prompt.analysis.quality_score.max,
            band: prompt.analysis.quality_score.band,
          },
          quality_gaps: prompt.quality_gaps,
          redacted_prompt: prompt.markdown,
        },
        ...(localBaseline
          ? {
              local_baseline: {
                analyzer: localBaseline.analyzer,
                improved_prompt: removeOriginalPromptSection(
                  localBaseline.improved_prompt,
                ),
                changed_sections: localBaseline.changed_sections,
              },
            }
          : {}),
        rewrite_contract: rewriteContractFor(args.language ?? "en"),
        agent_instructions:
          "Rewrite the redacted_prompt as the active user-controlled coding-agent session. Preserve the user's intent, remove ambiguity, keep secrets redacted, do not add unrelated scope, and call record_agent_rewrite with the improved_prompt only after the user wants it saved. Do not auto-submit the rewrite.",
        privacy: {
          local_only: true,
          external_calls_by_prompt_memory: false,
          intended_external_rewriter: "current_agent_session",
          returns_redacted_prompt_body: true,
          returns_raw_prompt_body: false,
          returns_raw_paths: false,
          stores_rewrite_result: false,
          auto_submits: false,
        },
      };
    } finally {
      storage.close();
    }
  } catch (error) {
    return rewriteError(
      "storage_unavailable",
      storageUnavailableMessage(error),
    );
  }
}

export function recordAgentRewriteTool(
  args: RecordAgentRewriteToolArguments,
  options: ScorePromptToolOptions = {},
): RecordAgentRewriteToolResult {
  const validationError = validateAgentRewriteInput(args);
  if (validationError) {
    return recordRewriteError("invalid_input", validationError);
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
      const safeSummary = args.summary
        ? redactMetadataText(args.summary)
        : undefined;
      const safeSafetyNotes = (args.safety_notes ?? []).map(redactMetadataText);
      const draft = storage.createPromptImprovementDraft(args.prompt_id, {
        draft_text: args.improved_prompt,
        analyzer: `agent-rewrite-v1:${args.provider}`,
        changed_sections: args.changed_sections,
        safety_notes: [
          "Generated by the active user-controlled agent session.",
          ...(safeSummary ? [`Agent summary: ${safeSummary}`] : []),
          ...safeSafetyNotes,
        ],
        copied: args.copied,
        accepted: args.accepted,
      });

      if (!draft) {
        return recordRewriteError(
          "not_found",
          `Prompt not found or deleted: ${args.prompt_id}`,
        );
      }

      return {
        recorded: true,
        draft: {
          id: draft.id,
          prompt_id: draft.prompt_id,
          analyzer: draft.analyzer,
          changed_sections: draft.changed_sections,
          safety_notes: draft.safety_notes,
          is_sensitive: draft.is_sensitive,
          redaction_policy: draft.redaction_policy,
          created_at: draft.created_at,
          ...(draft.copied_at ? { copied_at: draft.copied_at } : {}),
          ...(draft.accepted_at ? { accepted_at: draft.accepted_at } : {}),
        },
        agent_metadata: {
          provider: args.provider,
          ...(args.judge_model ? { judge_model: args.judge_model } : {}),
          ...(args.confidence !== undefined
            ? { confidence: args.confidence }
            : {}),
          ...(safeSummary ? { summary: safeSummary } : {}),
        },
        next_action:
          "Open the prompt detail or run improve/coach again to compare this saved agent rewrite with the local baseline before resubmitting.",
        privacy: {
          local_only: true,
          external_calls_by_prompt_memory: false,
          stores_original_prompt_body: false,
          stores_rewrite_draft: true,
          returns_rewrite_draft: false,
          stores_raw_paths: false,
        },
      };
    } finally {
      storage.close();
    }
  } catch (error) {
    return recordRewriteError(
      "storage_unavailable",
      storageUnavailableMessage(error),
    );
  }
}

function validateAgentRewriteInput(
  args: RecordAgentRewriteToolArguments,
): string | undefined {
  if (!PROVIDERS.includes(args.provider)) {
    return "`provider` must be claude-code, codex, gemini-cli, or other.";
  }
  if (!args.prompt_id?.trim()) {
    return "`prompt_id` must not be empty.";
  }
  if (!args.improved_prompt?.trim()) {
    return "`improved_prompt` must not be empty.";
  }
  if (args.improved_prompt.length > 20_000) {
    return "`improved_prompt` must be 20,000 characters or less.";
  }
  if (
    args.confidence !== undefined &&
    (typeof args.confidence !== "number" ||
      args.confidence < 0 ||
      args.confidence > 1)
  ) {
    return "`confidence` must be between 0 and 1.";
  }
  if (
    args.changed_sections?.some(
      (section) => !QUALITY_CRITERIA.includes(section),
    )
  ) {
    return "`changed_sections` contains an unknown prompt quality criterion.";
  }
  return undefined;
}

function rewriteContractFor(language: "en" | "ko"): {
  required_sections: string[];
  constraints: string[];
  success_criteria: string[];
} {
  if (language === "ko") {
    return {
      required_sections: ["목표", "맥락", "범위", "검증", "출력"],
      constraints: [
        "원래 의도를 바꾸지 않는다.",
        "민감정보 placeholder를 실제 값으로 복원하지 않는다.",
        "불필요한 작업 범위나 새 요구사항을 추가하지 않는다.",
        "사용자 승인 없이 자동 제출하지 않는다.",
      ],
      success_criteria: [
        "대상 파일, 기대 동작, 제약, 검증 명령이 명확하다.",
        "Claude Code/Codex가 바로 실행할 수 있는 작업 요청 형태다.",
        "짧지만 완료 판단 기준과 보고 형식이 포함되어 있다.",
      ],
    };
  }

  return {
    required_sections: ["Goal", "Context", "Scope", "Verification", "Output"],
    constraints: [
      "Do not change the user's original intent.",
      "Do not restore sensitive placeholders into real values.",
      "Do not add unrelated scope or new requirements.",
      "Do not auto-submit the rewrite without user approval.",
    ],
    success_criteria: [
      "Target files, expected behavior, constraints, and verification commands are explicit.",
      "The result is ready for Claude Code/Codex to execute as a coding request.",
      "It is concise while still defining done-state and final reporting.",
    ],
  };
}

function removeOriginalPromptSection(draft: string): string {
  return draft
    .replace(/\n## Original prompt\n[\s\S]*$/u, "")
    .replace(/\n## 원문\n[\s\S]*$/u, "")
    .trim();
}

function redactMetadataText(value: string): string {
  return redactPrompt(value, "mask").stored_text;
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

function rewriteError(
  errorCode: Extract<
    PrepareAgentRewriteToolResult,
    { is_error: true }
  >["error_code"],
  message: string,
): PrepareAgentRewriteToolResult {
  return { is_error: true, error_code: errorCode, message };
}

function recordRewriteError(
  errorCode: Extract<
    RecordAgentRewriteToolResult,
    { is_error: true }
  >["error_code"],
  message: string,
): RecordAgentRewriteToolResult {
  return { is_error: true, error_code: errorCode, message };
}
