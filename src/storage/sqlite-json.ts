import type {
  PromptQualityChecklistItem,
  PromptQualityCriterion,
  PromptTag,
} from "../shared/schema.js";
import type { ExportJob } from "./ports.js";

export function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function readNumberRecord(value: string): Record<string, number> {
  const parsed = parseJsonValue(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

export function isExportPreviewCounts(
  value: unknown,
): value is ExportJob["counts"] {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as ExportJob["counts"]).prompt_count === "number" &&
    typeof (value as ExportJob["counts"]).sensitive_count === "number" &&
    Array.isArray((value as ExportJob["counts"]).included_fields) &&
    Array.isArray((value as ExportJob["counts"]).excluded_fields) &&
    Boolean((value as ExportJob["counts"]).residual_identifier_counts) &&
    typeof (value as ExportJob["counts"]).residual_identifier_counts ===
      "object" &&
    typeof (value as ExportJob["counts"]).small_set_warning === "boolean"
  );
}

export function readChecklist(
  value: string | null,
): PromptQualityChecklistItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is PromptQualityChecklistItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as PromptQualityChecklistItem).key === "string" &&
        typeof (item as PromptQualityChecklistItem).label === "string" &&
        typeof (item as PromptQualityChecklistItem).status === "string" &&
        typeof (item as PromptQualityChecklistItem).reason === "string",
    );
  } catch {
    return [];
  }
}

export function readPromptTags(value: string | null): PromptTag[] {
  return readStringArray(value).filter((tag): tag is PromptTag =>
    [
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
    ].includes(tag),
  );
}

export function readQualityCriteria(
  value: string | null,
): PromptQualityCriterion[] {
  return readStringArray(value).filter((item): item is PromptQualityCriterion =>
    [
      "goal_clarity",
      "background_context",
      "scope_limits",
      "output_format",
      "verification_criteria",
    ].includes(item),
  );
}

export function readStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
