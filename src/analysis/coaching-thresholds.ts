import type { PromptAnalysisPreview } from "../shared/schema.js";
import { analyzePrompt } from "./analyze.js";
import {
  detectPromptLanguage,
  improvePrompt,
  type PromptImprovement,
} from "./improve.js";

export const DEFAULT_MIN_SCORE = 80;

export type CoachingLanguage = "en" | "ko";

export type CoachingEvaluation =
  | {
      needed: false;
      reason: "empty_prompt" | "above_threshold";
      score: number;
    }
  | {
      needed: true;
      score: number;
      analysis: PromptAnalysisPreview;
      improvement: PromptImprovement;
      language: CoachingLanguage;
    };

export type EvaluatePromptCoachingOptions = {
  minScore?: number;
  language?: CoachingLanguage;
  now?: Date;
};

export function evaluatePromptCoaching(
  prompt: string,
  options: EvaluatePromptCoachingOptions = {},
): CoachingEvaluation {
  if (!prompt.trim()) {
    return { needed: false, reason: "empty_prompt", score: 0 };
  }

  const createdAt = (options.now ?? new Date()).toISOString();
  const analysis = analyzePrompt({ prompt, createdAt });
  const score = analysis.quality_score.value;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  if (score >= minScore) {
    return { needed: false, reason: "above_threshold", score };
  }

  const language = options.language ?? detectPromptLanguage(prompt);
  const improvement = improvePrompt({
    prompt,
    createdAt,
    language,
  });

  return {
    needed: true,
    score,
    analysis,
    improvement,
    language,
  };
}
