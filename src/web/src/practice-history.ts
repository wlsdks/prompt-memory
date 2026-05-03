import type { PromptQualityGap, PromptQualityScoreBand } from "./api.js";

export type PracticePromptAnalysis = {
  analyzer?: string;
  created_at?: string;
  summary?: string;
  tags?: string[];
  warnings?: string[];
  checklist: Array<{
    key: PromptQualityGap | string;
    label: string;
    status: "good" | "weak" | "missing";
    reason?: string;
    suggestion?: string;
  }>;
  quality_score: {
    value: number;
    max: 100;
    band: PromptQualityScoreBand;
    breakdown?: unknown[];
  };
};

export type PracticeHistoryItem = {
  id: string;
  created_at: string;
  score: {
    value: number;
    max: 100;
    band: PromptQualityScoreBand;
  };
  missing_keys: string[];
  missing_labels: string[];
  outcome?: PracticeOutcome;
  outcome_at?: string;
};

export type PracticeOutcome = "worked" | "needs_context" | "blocked";

export type PracticeHistorySummary = {
  count: number;
  averageScore: number;
  latestScore?: number;
  bestScore?: number;
  delta?: number;
  repeatedGap?: string;
  workedCount: number;
  needsContextCount: number;
  blockedCount: number;
  latestOutcome?: PracticeOutcome;
};

const HISTORY_LIMIT = 20;
const STORAGE_KEY = "prompt-memory.practice-history.v1";

type PracticeHistoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function createPracticeHistoryItem({
  analysis,
  now = new Date(),
}: {
  analysis: PracticePromptAnalysis;
  now?: Date;
}): PracticeHistoryItem {
  const createdAt = now.toISOString();
  const missingItems = analysis.checklist.filter(
    (item) => item.status !== "good",
  );

  return {
    id: `practice_${createdAt.replaceAll(/[^0-9]/g, "")}_${analysis.quality_score.value}`,
    created_at: createdAt,
    score: {
      value: analysis.quality_score.value,
      max: analysis.quality_score.max,
      band: analysis.quality_score.band,
    },
    missing_keys: missingItems.map((item) => item.key),
    missing_labels: missingItems.map((item) => item.label),
  };
}

export function appendPracticeHistory(
  history: PracticeHistoryItem[],
  item: PracticeHistoryItem,
  limit = HISTORY_LIMIT,
): PracticeHistoryItem[] {
  return [item, ...history].slice(0, limit);
}

export function summarizePracticeHistory(
  history: PracticeHistoryItem[],
): PracticeHistorySummary {
  if (history.length === 0) {
    return {
      count: 0,
      averageScore: 0,
      workedCount: 0,
      needsContextCount: 0,
      blockedCount: 0,
    };
  }

  const scores = history.map((item) => item.score.value);
  const latestScore = history[0]?.score.value;
  const previousScore = history[1]?.score.value;
  const outcomes = summarizeOutcomes(history);

  return {
    count: history.length,
    averageScore: Math.round(
      scores.reduce((total, score) => total + score, 0) / history.length,
    ),
    latestScore,
    bestScore: Math.max(...scores),
    delta:
      latestScore === undefined || previousScore === undefined
        ? undefined
        : latestScore - previousScore,
    repeatedGap: mostFrequentGap(history),
    workedCount: outcomes.workedCount,
    needsContextCount: outcomes.needsContextCount,
    blockedCount: outcomes.blockedCount,
    latestOutcome: history.find((item) => item.outcome)?.outcome,
  };
}

export function markPracticeOutcome(
  history: PracticeHistoryItem[],
  id: string | undefined,
  outcome: PracticeOutcome,
  now = new Date(),
): PracticeHistoryItem[] {
  if (!id) {
    return history;
  }

  return history.map((item) =>
    item.id === id
      ? {
          ...item,
          outcome,
          outcome_at: now.toISOString(),
        }
      : item,
  );
}

export function readPracticeHistory(
  storage: PracticeHistoryStorage,
): PracticeHistoryItem[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPracticeHistoryItem).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function writePracticeHistory(
  storage: PracticeHistoryStorage,
  history: PracticeHistoryItem[],
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
}

function isPracticeHistoryItem(value: unknown): value is PracticeHistoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as PracticeHistoryItem;
  return (
    typeof item.id === "string" &&
    typeof item.created_at === "string" &&
    typeof item.score?.value === "number" &&
    item.score.max === 100 &&
    typeof item.score.band === "string" &&
    Array.isArray(item.missing_keys) &&
    Array.isArray(item.missing_labels) &&
    isPracticeOutcomeMetadata(item)
  );
}

function isPracticeOutcomeMetadata(item: PracticeHistoryItem): boolean {
  if (item.outcome === undefined) {
    return item.outcome_at === undefined || typeof item.outcome_at === "string";
  }

  return (
    isPracticeOutcome(item.outcome) &&
    (item.outcome_at === undefined || typeof item.outcome_at === "string")
  );
}

function isPracticeOutcome(value: unknown): value is PracticeOutcome {
  return value === "worked" || value === "needs_context" || value === "blocked";
}

function summarizeOutcomes(history: PracticeHistoryItem[]) {
  return history.reduce(
    (summary, item) => {
      if (item.outcome === "worked") {
        summary.workedCount += 1;
      }
      if (item.outcome === "needs_context") {
        summary.needsContextCount += 1;
      }
      if (item.outcome === "blocked") {
        summary.blockedCount += 1;
      }

      return summary;
    },
    {
      workedCount: 0,
      needsContextCount: 0,
      blockedCount: 0,
    },
  );
}

function mostFrequentGap(history: PracticeHistoryItem[]): string | undefined {
  const counts = new Map<string, number>();
  for (const item of history) {
    for (const label of item.missing_labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
