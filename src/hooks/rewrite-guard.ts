import { spawnSync } from "node:child_process";
import { platform } from "node:os";

import { analyzePrompt } from "../analysis/analyze.js";
import { improvePrompt } from "../analysis/improve.js";

export type PromptRewriteGuardMode = "off" | "block-and-copy" | "context";

export type PromptRewriteGuardOptions = {
  mode?: PromptRewriteGuardMode;
  minScore?: number;
  language?: "en" | "ko";
  now?: Date;
  copyToClipboard?: (text: string) => boolean;
};

export type PromptRewriteGuardOutput =
  | {
      decision: "block";
      reason: string;
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit";
      };
    }
  | {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit";
        additionalContext: string;
      };
    };

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

  const improvement = improvePrompt({
    prompt,
    createdAt,
    language: options.language,
  });

  if (mode === "context") {
    return {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: [
          "prompt-memory rewrite guidance",
          `Original local score: ${analysis.quality_score.value}/100 (${analysis.quality_score.band})`,
          "Use this improved request as the working brief when it is clearer than the submitted prompt.",
          "",
          improvement.improved_prompt,
        ].join("\n"),
      },
    };
  }

  const copied =
    options.copyToClipboard?.(improvement.improved_prompt) ??
    copyTextToClipboard(improvement.improved_prompt);

  return {
    decision: "block",
    reason: [
      `prompt-memory blocked this prompt before submission because its local score was ${analysis.quality_score.value}/100 (${analysis.quality_score.band}), below the configured threshold ${minScore}.`,
      copied
        ? "An improved prompt was copied to your clipboard. Paste it and press Enter to resubmit."
        : "Copy the improved prompt below, paste it, and press Enter to resubmit.",
      "",
      "Improved prompt:",
      improvement.improved_prompt,
      "",
      "Safety notes:",
      ...improvement.safety_notes.map((note) => `- ${note}`),
    ].join("\n"),
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
    },
  };
}

export function parsePromptRewriteGuardMode(
  value: string | undefined,
): PromptRewriteGuardMode {
  if (value === "block-and-copy" || value === "context" || value === "off") {
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

  return Math.max(0, Math.min(100, Math.round(value)));
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
