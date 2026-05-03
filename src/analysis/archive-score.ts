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
  practice_plan: ArchivePracticePlanItem[];
  next_prompt_template: string;
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

export type ArchivePracticePlanItem = {
  priority: number;
  label: string;
  prompt_rule: string;
  reason: string;
  count: number;
  rate: number;
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
const DEFAULT_PROMPT_TEMPLATE = [
  "Goal:",
  "Context:",
  "Scope:",
  "Verification:",
  "Output:",
].join("\n");

const GAP_RULES: Record<
  string,
  {
    label: string;
    promptRule: string;
    templateLine: string;
  }
> = {
  "goal clarity": {
    label: "Goal clarity",
    promptRule: "Name the exact goal and target behavior first.",
    templateLine: "Goal: state the exact target and expected behavior.",
  },
  "background context": {
    label: "Background context",
    promptRule: "Add the relevant files, current state, and constraints.",
    templateLine:
      "Context: include relevant files, current state, and constraints.",
  },
  "scope limits": {
    label: "Scope limits",
    promptRule: "State what may change and what must stay untouched.",
    templateLine: "Scope: list allowed changes and explicit non-goals.",
  },
  "output format": {
    label: "Output format",
    promptRule: "Specify the response format before the agent starts work.",
    templateLine: "Output: define the exact format you want back.",
  },
  "verification criteria": {
    label: "Verification criteria",
    promptRule: "Include the test command, check, or acceptance criteria.",
    templateLine: "Verification: name commands or acceptance checks.",
  },
};

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
  const topGaps = [...gapCounts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      rate: prompts.length > 0 ? roundRatio(count / prompts.length) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);

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
    top_gaps: topGaps,
    practice_plan: buildPracticePlan(topGaps),
    next_prompt_template: buildNextPromptTemplate(topGaps),
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

function buildPracticePlan(
  gaps: ArchiveScoreReport["top_gaps"],
): ArchivePracticePlanItem[] {
  return gaps.slice(0, 3).map((gap, index) => {
    const rule = ruleFor(gap.label);

    return {
      priority: index + 1,
      label: rule.label,
      prompt_rule: rule.promptRule,
      reason: `${gap.count} measured prompt${gap.count === 1 ? "" : "s"} missed this habit.`,
      count: gap.count,
      rate: gap.rate,
    };
  });
}

function buildNextPromptTemplate(gaps: ArchiveScoreReport["top_gaps"]): string {
  if (gaps.length === 0) {
    return DEFAULT_PROMPT_TEMPLATE;
  }

  const selected = gaps.slice(0, 3).map((gap) => ruleFor(gap.label));
  const lines = [
    ...selected.map((rule) => rule.templateLine),
    ...DEFAULT_PROMPT_TEMPLATE.split("\n").filter(
      (line) =>
        !selected.some((rule) =>
          rule.templateLine.toLowerCase().startsWith(line.toLowerCase()),
        ),
    ),
  ];

  return lines.join("\n");
}

function ruleFor(label: string): {
  label: string;
  promptRule: string;
  templateLine: string;
} {
  const normalized = label.trim().toLowerCase();
  return (
    GAP_RULES[normalized] ?? {
      label,
      promptRule: `Make "${label}" explicit before asking for implementation.`,
      templateLine: `${label}: make this expectation explicit.`,
    }
  );
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
