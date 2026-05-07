import { spawnSync } from "node:child_process";
import { platform } from "node:os";

import { analyzePrompt } from "../analysis/analyze.js";
import { detectPromptLanguage, improvePrompt } from "../analysis/improve.js";
import { clampScore } from "../shared/clamp-score.js";
import { HOOK_COPY } from "./rewrite-guard-copy.js";

export type PromptRewriteGuardMode =
  | "off"
  | "block-and-copy"
  | "context"
  | "ask";

const ASK_MIN_LENGTH = 30;
const ASK_MAX_SCORE = 60;

// Korean has no ASCII word boundary, so `\b` does not match between Hangul
// characters. STRICT roots must end the token (followed by space,
// punctuation, or end-of-string) so "응" reads as ack but "응답" does not.
// LOOSE roots may carry the usual Korean particle suffixes (으로/에/은/는/도
// etc.) since they are still acknowledgment intent ("다음으로 가자").
const STRICT_ACK_TAIL = String.raw`(?:\s|[!?.,]|$)`;
const ACK_PATTERNS: readonly RegExp[] = [
  /^[ㅇㅎㄴㅋㅠㅜ]+\s*[!?.]*$/,
  // Strict: must terminate after the root. 왜/뭐 are interrogatives that
  // usually start a real question ("왜 안되지", "뭐가 잘못된 거지"), not
  // an acknowledgment, so they are not listed here.
  new RegExp(`^(응|어|네|아니|아뇨)${STRICT_ACK_TAIL}`),
  // Loose: particle suffixes allowed.
  /^(좋아|좋네|좋습니다|됐어|됐다|괜찮|훌륭)/,
  /^(고마워|감사|땡큐)/,
  /^(다음|진행|계속|넘어가)/,
  /^(그래|그러면|그럼|그렇구나|그렇네|아하|음+|일단)/,
  /^(그만|멈춰|취소|되돌려)/,
  // English acknowledgments / meta-control.
  /^(yes|yeah|yep|nope|no|ok|okay|sure|fine|alright)\b/i,
  /^(thanks|thx|ty)\b/i,
  /^(next|continue|proceed|go(?:\s|$)|stop|cancel|undo)\b/i,
  /^(perfect|great|nice|cool|awesome|got it)\b/i,
  /^let'?s\b/i,
];

export type AskEventReport = {
  tool: "claude-code" | "codex";
  score: number;
  band: "weak" | "needs_work" | "good" | "excellent";
  missing_axes: string[];
  language: "en" | "ko";
  prompt_length: number;
  triggered_at: string;
};

export type PromptRewriteGuardOptions = {
  mode?: PromptRewriteGuardMode;
  minScore?: number;
  language?: "en" | "ko";
  now?: Date;
  copyToClipboard?: (text: string) => boolean;
  /**
   * Tool that triggered the hook. Ask mode emits a Claude-Code-specific
   * AskUserQuestion instruction by default; on Codex it switches to an
   * MCP-tool-call instruction since Codex has no native AskUserQuestion
   * but can call the prompt-memory `ask_clarifying_questions` MCP tool.
   */
  tool?: "claude-code" | "codex";
  /**
   * When true, ask the host CLI to keep the hook output (additionalContext or
   * block reason) hidden from the user-visible chat surface and only feed it
   * to the model. Codex's UserPromptSubmit honors this `suppressOutput` field
   * from the shared hook JSON; Claude Code ignores it. Defaults to false to
   * preserve existing Claude Code behavior.
   */
  suppressOutput?: boolean;
  /**
   * Optional sink invoked exactly when ask mode actually fires
   * (additionalContext built). Lets the wrapper post a measurement event
   * to the local server for dashboard analytics.
   */
  onAskTriggered?: (report: AskEventReport) => void;
};

export type PromptRewriteGuardOutput =
  | {
      decision: "block";
      reason: string;
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit";
      };
      suppressOutput?: true;
    }
  | {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit";
        additionalContext: string;
      };
      suppressOutput?: true;
    };

export function isAcknowledgment(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return true;
  }

  return ACK_PATTERNS.some((pattern) => pattern.test(trimmed));
}

const DEFAULT_MIN_SCORE = 80;

export function createPromptRewriteGuardOutput(
  payload: unknown,
  options: PromptRewriteGuardOptions = {},
): PromptRewriteGuardOutput | undefined {
  const mode = options.mode ?? "off";
  if (mode === "off") {
    return undefined;
  }

  const prompt = readSubmittedPrompt(payload);
  if (!prompt.trim()) {
    return undefined;
  }

  const createdAt = (options.now ?? new Date()).toISOString();
  const analysis = analyzePrompt({ prompt, createdAt });
  const minScore = normalizeMinScore(options.minScore);
  if (analysis.quality_score.value >= minScore) {
    return undefined;
  }

  const language = options.language ?? detectPromptLanguage(prompt);
  const improvement = improvePrompt({
    prompt,
    createdAt,
    language,
  });
  const copy = HOOK_COPY[language];

  if (mode === "ask") {
    // Ask mode is conservative: only fire when the prompt is meaningfully
    // long, scored low enough to plausibly be a real ambiguous request,
    // and not a leading acknowledgment / meta-control message. Length and
    // ack guards keep "ㅇㅇ", "고마워", "다음으로 가자" from triggering
    // a clarifying-question prompt.
    if (
      prompt.trim().length < ASK_MIN_LENGTH ||
      analysis.quality_score.value >= ASK_MAX_SCORE ||
      isAcknowledgment(prompt) ||
      improvement.clarifying_questions.length === 0
    ) {
      return undefined;
    }

    const sectionLabels =
      language === "ko"
        ? {
            goal_clarity: "목표 명확성",
            background_context: "배경 맥락",
            scope_limits: "범위 제한",
            output_format: "출력 형식",
            verification_criteria: "검증 기준",
          }
        : {
            goal_clarity: "Goal clarity",
            background_context: "Background context",
            scope_limits: "Scope limits",
            output_format: "Output format",
            verification_criteria: "Verification criteria",
          };
    const axesLabel = improvement.clarifying_questions
      .map((question) => sectionLabels[question.axis])
      .join(", ");
    const numberedQuestions = improvement.clarifying_questions
      .map((question, index) => `${index + 1}. ${question.ask}`)
      .join("\n");
    const isCodex = options.tool === "codex";
    const askInstruction = isCodex
      ? copy.askInstructionCodex
      : copy.askInstruction;

    if (options.onAskTriggered) {
      try {
        options.onAskTriggered({
          tool: options.tool ?? "claude-code",
          score: analysis.quality_score.value,
          band: analysis.quality_score.band,
          missing_axes: improvement.clarifying_questions.map(
            (question) => question.axis,
          ),
          language,
          prompt_length: prompt.trim().length,
          triggered_at: createdAt,
        });
      } catch {
        // Telemetry must never block the hook.
      }
    }

    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: [
          copy.askHeader,
          copy.askIntro(
            analysis.quality_score.value,
            analysis.quality_score.band,
            axesLabel,
          ),
          "",
          askInstruction,
          "",
          copy.askQuestionsHeader,
          numberedQuestions,
          "",
          copy.askFooter,
        ].join("\n"),
      },
      ...(options.suppressOutput ? { suppressOutput: true as const } : {}),
    };
  }

  if (mode === "context") {
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: [
          copy.contextHeader,
          copy.scoreLine(
            analysis.quality_score.value,
            analysis.quality_score.band,
          ),
          copy.contextHint,
          "",
          improvement.improved_prompt,
        ].join("\n"),
      },
      ...(options.suppressOutput ? { suppressOutput: true as const } : {}),
    };
  }

  const copied =
    options.copyToClipboard?.(improvement.improved_prompt) ??
    copyTextToClipboard(improvement.improved_prompt);

  return {
    decision: "block",
    reason: [
      copy.blockedReason(
        analysis.quality_score.value,
        analysis.quality_score.band,
        minScore,
      ),
      copied ? copy.clipboardHit : copy.clipboardMiss,
      "",
      copy.improvedHeader,
      improvement.improved_prompt,
      "",
      copy.safetyHeader,
      ...improvement.safety_notes.map((note) => `- ${note}`),
    ].join("\n"),
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
    },
    ...(options.suppressOutput ? { suppressOutput: true as const } : {}),
  };
}

export function parsePromptRewriteGuardMode(
  value: string | undefined,
): PromptRewriteGuardMode {
  if (
    value === "block-and-copy" ||
    value === "context" ||
    value === "off" ||
    value === "ask"
  ) {
    return value;
  }

  return "off";
}

function readSubmittedPrompt(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const prompt = (payload as { prompt?: unknown }).prompt;
  return typeof prompt === "string" ? prompt : "";
}

function normalizeMinScore(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MIN_SCORE;
  }

  return clampScore(value);
}

function copyTextToClipboard(text: string): boolean {
  const currentPlatform = platform();
  if (currentPlatform === "darwin") {
    return runClipboardCommand("pbcopy", [], text);
  }

  if (currentPlatform === "win32") {
    return runClipboardCommand("clip.exe", [], text);
  }

  return (
    runClipboardCommand("wl-copy", [], text) ||
    runClipboardCommand("xclip", ["-selection", "clipboard"], text) ||
    runClipboardCommand("xsel", ["--clipboard", "--input"], text)
  );
}

function runClipboardCommand(
  command: string,
  args: string[],
  input: string,
): boolean {
  const result = spawnSync(command, args, {
    input,
    encoding: "utf8",
    timeout: 1_000,
    windowsHide: true,
  });

  return result.status === 0;
}
