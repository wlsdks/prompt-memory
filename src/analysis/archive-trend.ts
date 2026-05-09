import type { PromptReadStoragePort } from "../storage/ports.js";

export type ArchiveTrendDirection = "up" | "flat" | "down";

export type ArchiveTrend = {
  direction: ArchiveTrendDirection;
  current_average: number;
  previous_average: number;
  current_count: number;
  previous_count: number;
};

const TREND_WINDOW_DAYS = 7;
const MIN_CURRENT_PROMPTS = 3;
const MIN_PREVIOUS_PROMPTS = 3;
const FLAT_THRESHOLD = 5;
const TREND_LIST_LIMIT = 200;

export type ArchiveTrendInput = {
  storage: Pick<PromptReadStoragePort, "listPrompts">;
  now?: Date;
};

export function computeArchiveTrend({
  storage,
  now = new Date(),
}: ArchiveTrendInput): ArchiveTrend | undefined {
  const currentFrom = isoDaysBefore(now, TREND_WINDOW_DAYS);
  const previousFrom = isoDaysBefore(now, TREND_WINDOW_DAYS * 2);

  const current = storage.listPrompts({
    receivedFrom: currentFrom,
    limit: TREND_LIST_LIMIT,
  }).items;

  if (current.length < MIN_CURRENT_PROMPTS) {
    return undefined;
  }

  const previous = storage
    .listPrompts({
      receivedFrom: previousFrom,
      receivedTo: currentFrom,
      limit: TREND_LIST_LIMIT,
    })
    .items.filter((prompt) => prompt.received_at < currentFrom);

  if (previous.length < MIN_PREVIOUS_PROMPTS) {
    return undefined;
  }

  const currentAverage = average(
    current.map((prompt) => prompt.quality_score ?? 0),
  );
  const previousAverage = average(
    previous.map((prompt) => prompt.quality_score ?? 0),
  );

  return {
    direction: directionFor(currentAverage - previousAverage),
    current_average: currentAverage,
    previous_average: previousAverage,
    current_count: current.length,
    previous_count: previous.length,
  };
}

export function directionGlyph(direction: ArchiveTrendDirection): string {
  switch (direction) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "flat":
    default:
      return "→";
  }
}

function directionFor(delta: number): ArchiveTrendDirection {
  if (delta >= FLAT_THRESHOLD) {
    return "up";
  }
  if (delta <= -FLAT_THRESHOLD) {
    return "down";
  }
  return "flat";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function isoDaysBefore(now: Date, days: number): string {
  const ms = now.getTime() - days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
