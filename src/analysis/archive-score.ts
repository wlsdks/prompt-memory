import { basename } from "node:path";

import { qualityScoreBand } from "./analyze.js";
import type { PromptQualityScoreBand } from "../shared/schema.js";
import type {
  ListPromptsOptions,
  PromptReadStoragePort,
  PromptSummary,
} from "../storage/ports.js";

export type ArchiveScoreOptions = {
  maxPrompts?: number;
  lowScoreLimit?: number;
  tool?: string;
  cwdPrefix?: string;
  receivedFrom?: string;
  receivedTo?: string;
};

export type ArchiveScoreReport = {
  generated_at: string;
  archive_score: {
    average: number;
    max: 100;
    band: PromptQualityScoreBand;
    scored_prompts: number;
    total_prompts: number;
  };
  distribution: Record<PromptQualityScoreBand, number>;
  top_gaps: Array<{
    label: string;
    count: number;
    rate: number;
  }>;
  low_score_prompts: ArchivePromptScoreSummary[];
  filters: {
    tool?: string;
    project?: string;
    received_from?: string;
    received_to?: string;
    max_prompts: number;
  };
  has_more: boolean;
  privacy: {
    local_only: true;
    external_calls: false;
    returns_prompt_bodies: false;
    returns_raw_paths: false;
  };
};

export type ArchivePromptScoreSummary = {
  id: string;
  tool: string;
  project: string;
  received_at: string;
  quality_score: number;
  quality_score_band: PromptQualityScoreBand;
  quality_gaps: string[];
  tags: string[];
  is_sensitive: boolean;
};

const DEFAULT_MAX_PROMPTS = 200;
const DEFAULT_LOW_SCORE_LIMIT = 10;
const PAGE_LIMIT = 100;

export function createArchiveScoreReport(
  storage: Pick<PromptReadStoragePort, "listPrompts">,
  options: ArchiveScoreOptions = {},
  now: Date = new Date(),
): ArchiveScoreReport {
  const maxPrompts = clampPositiveInt(
    options.maxPrompts,
    DEFAULT_MAX_PROMPTS,
    1000,
  );
  const lowScoreLimit = clampPositiveInt(
    options.lowScoreLimit,
    DEFAULT_LOW_SCORE_LIMIT,
    50,
  );
  const page = readPromptPage(storage, options, maxPrompts);
  const prompts = page.prompts;
  const totalScore = prompts.reduce(
    (sum, prompt) => sum + prompt.quality_score,
    0,
  );
  const average =
    prompts.length > 0 ? Math.round(totalScore / prompts.length) : 0;
  const gapCounts = countGaps(prompts);

  return {
    generated_at: now.toISOString(),
    archive_score: {
      average,
      max: 100,
      band: qualityScoreBand(average),
      scored_prompts: prompts.length,
      total_prompts: prompts.length,
    },
    distribution: countBands(prompts),
    top_gaps: [...gapCounts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        rate: prompts.length > 0 ? roundRatio(count / prompts.length) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 8),
    low_score_prompts: prompts
      .map(toArchivePromptScoreSummary)
      .sort(
        (a, b) =>
          a.quality_score - b.quality_score ||
          b.received_at.localeCompare(a.received_at) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, lowScoreLimit),
    filters: {
      tool: options.tool,
      project: options.cwdPrefix ? projectLabel(options.cwdPrefix) : undefined,
      received_from: options.receivedFrom,
      received_to: options.receivedTo,
      max_prompts: maxPrompts,
    },
    has_more: page.hasMore,
    privacy: {
      local_only: true,
      external_calls: false,
      returns_prompt_bodies: false,
      returns_raw_paths: false,
    },
  };
}

function readPromptPage(
  storage: Pick<PromptReadStoragePort, "listPrompts">,
  options: ArchiveScoreOptions,
  maxPrompts: number,
): { prompts: PromptSummary[]; hasMore: boolean } {
  const prompts: PromptSummary[] = [];
  let cursor: string | undefined;

  while (prompts.length < maxPrompts) {
    const limit = Math.min(PAGE_LIMIT, maxPrompts - prompts.length);
    const page = storage.listPrompts({
      ...toListOptions(options),
      cursor,
      limit,
    });
    prompts.push(...page.items);
    cursor = page.nextCursor;

    if (!cursor || page.items.length === 0) {
      break;
    }
  }

  return {
    prompts,
    hasMore: Boolean(cursor) && prompts.length >= maxPrompts,
  };
}

function toListOptions(options: ArchiveScoreOptions): ListPromptsOptions {
  return {
    tool: options.tool,
    cwdPrefix: options.cwdPrefix,
    receivedFrom: options.receivedFrom,
    receivedTo: options.receivedTo,
  };
}

function countBands(
  prompts: PromptSummary[],
): Record<PromptQualityScoreBand, number> {
  return prompts.reduce(
    (counts, prompt) => {
      counts[prompt.quality_score_band] += 1;
      return counts;
    },
    {
      excellent: 0,
      good: 0,
      needs_work: 0,
      weak: 0,
    } satisfies Record<PromptQualityScoreBand, number>,
  );
}

function countGaps(prompts: PromptSummary[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const prompt of prompts) {
    for (const gap of prompt.quality_gaps) {
      counts.set(gap, (counts.get(gap) ?? 0) + 1);
    }
  }

  return counts;
}

function toArchivePromptScoreSummary(
  prompt: PromptSummary,
): ArchivePromptScoreSummary {
  return {
    id: prompt.id,
    tool: prompt.tool,
    project: projectLabel(prompt.cwd),
    received_at: prompt.received_at,
    quality_score: prompt.quality_score,
    quality_score_band: prompt.quality_score_band,
    quality_gaps: prompt.quality_gaps,
    tags: prompt.tags,
    is_sensitive: prompt.is_sensitive,
  };
}

function projectLabel(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "unknown";
  }

  return (
    basename(trimmed) || trimmed.split("/").filter(Boolean).at(-1) || trimmed
  );
}

function clampPositiveInt(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return fallback;
  }

  return Math.min(value, max);
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
