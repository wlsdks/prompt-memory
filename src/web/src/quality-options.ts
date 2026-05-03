import type { PromptFilters, PromptQualityGap } from "./api.js";

export const PROMPT_TAGS = [
  "bugfix",
  "refactor",
  "docs",
  "test",
  "ui",
  "backend",
  "security",
  "db",
  "release",
  "ops",
];

export const QUALITY_GAP_OPTIONS: Array<{
  key: PromptQualityGap;
  label: string;
}> = [
  { key: "goal_clarity", label: "Goal clarity" },
  { key: "background_context", label: "Background context" },
  { key: "scope_limits", label: "Scope limits" },
  { key: "output_format", label: "Output format" },
  { key: "verification_criteria", label: "Verification criteria" },
];

export const TOOL_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  manual: "Manual",
  unknown: "Unknown",
};

export const SENSITIVITY_LABELS: Record<string, string> = {
  true: "Contains sensitive data",
  false: "No sensitive data",
};

export const FOCUS_LABELS: Record<
  NonNullable<PromptFilters["focus"]>,
  string
> = {
  saved: "Saved",
  reused: "Reused",
  duplicated: "Duplicate candidates",
  "quality-gap": "Quality gaps",
};

export function isQualityGapKey(
  value: string | null,
): value is PromptQualityGap {
  return QUALITY_GAP_OPTIONS.some((item) => item.key === value);
}

export function qualityGapLabel(key?: PromptQualityGap): string | undefined {
  return QUALITY_GAP_OPTIONS.find((item) => item.key === key)?.label;
}

export function qualityGapKeyFromLabel(
  label?: string,
): PromptQualityGap | undefined {
  return QUALITY_GAP_OPTIONS.find((item) => item.label === label)?.key;
}

export function exportFieldLabel(value: string): string {
  const labels: Record<string, string> = {
    masked_prompt: "masked prompt",
    tags: "tags",
    quality_gaps: "quality gaps",
    tool: "tool",
    coarse_date: "coarse date",
    project_alias: "project alias",
    cwd: "cwd",
    project_root: "project root",
    transcript_path: "transcript path",
    raw_metadata: "raw metadata",
    stable_prompt_id: "stable prompt id",
    exact_timestamp: "exact timestamp",
  };

  return labels[value] ?? value;
}
