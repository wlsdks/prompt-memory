import { describe, expect, it } from "vitest";

import type { PromptReadStoragePort, PromptSummary } from "../storage/ports.js";
import { computeArchiveTrend, directionGlyph } from "./archive-trend.js";

const NOW = new Date("2026-05-09T08:00:00.000Z");

describe("computeArchiveTrend", () => {
  it("returns 'up' when the last 7 days average is at least 5 points higher than the previous 7 days", () => {
    const storage = trendStorage([
      ...prompts(5, daysBefore(NOW, 10), 50),
      ...prompts(5, daysBefore(NOW, 3), 80),
    ]);

    const trend = computeArchiveTrend({ storage, now: NOW });

    expect(trend).toBeDefined();
    expect(trend?.direction).toBe("up");
    expect(trend?.current_average).toBeGreaterThan(
      trend?.previous_average ?? 0,
    );
  });

  it("returns 'down' when current average is at least 5 points lower than previous", () => {
    const storage = trendStorage([
      ...prompts(5, daysBefore(NOW, 10), 80),
      ...prompts(5, daysBefore(NOW, 3), 50),
    ]);

    const trend = computeArchiveTrend({ storage, now: NOW });

    expect(trend?.direction).toBe("down");
  });

  it("returns 'flat' when the difference is within ±5 points", () => {
    const storage = trendStorage([
      ...prompts(5, daysBefore(NOW, 10), 60),
      ...prompts(5, daysBefore(NOW, 3), 62),
    ]);

    const trend = computeArchiveTrend({ storage, now: NOW });

    expect(trend?.direction).toBe("flat");
  });

  it("returns undefined when the current 7 days have fewer than 3 prompts", () => {
    const storage = trendStorage([
      ...prompts(5, daysBefore(NOW, 10), 60),
      ...prompts(2, daysBefore(NOW, 3), 80),
    ]);

    const trend = computeArchiveTrend({ storage, now: NOW });

    expect(trend).toBeUndefined();
  });

  it("returns undefined when the previous 7 days have fewer than 3 prompts", () => {
    const storage = trendStorage([
      ...prompts(2, daysBefore(NOW, 10), 60),
      ...prompts(5, daysBefore(NOW, 3), 80),
    ]);

    const trend = computeArchiveTrend({ storage, now: NOW });

    expect(trend).toBeUndefined();
  });

  it("returns undefined when the archive is empty", () => {
    const storage = trendStorage([]);

    const trend = computeArchiveTrend({ storage, now: NOW });

    expect(trend).toBeUndefined();
  });
});

describe("directionGlyph", () => {
  it("maps directions to single-char glyphs", () => {
    expect(directionGlyph("up")).toBe("↑");
    expect(directionGlyph("flat")).toBe("→");
    expect(directionGlyph("down")).toBe("↓");
  });
});

function trendStorage(items: PromptSummary[]): PromptReadStoragePort {
  return {
    listPrompts(options = {}) {
      const filtered = items.filter((item) => {
        if (options.receivedFrom && item.received_at < options.receivedFrom) {
          return false;
        }
        if (options.receivedTo && item.received_at > options.receivedTo) {
          return false;
        }
        return true;
      });
      const limit = options.limit ?? filtered.length;
      return { items: filtered.slice(0, limit) };
    },
    searchPrompts() {
      return { items: [] };
    },
    findSimilarPrompts() {
      return [];
    },
    getPrompt() {
      return undefined;
    },
    deletePrompt() {
      return { deleted: false };
    },
    getQualityDashboard() {
      throw new Error("not used");
    },
    recordPromptUsage() {
      return {
        recorded: false,
        usefulness: { copied_count: 0, bookmarked: false },
      };
    },
    setPromptBookmark() {
      return {
        updated: false,
        usefulness: { copied_count: 0, bookmarked: false },
      };
    },
    createPromptImprovementDraft() {
      return undefined;
    },
    countImprovementDraftsByPromptIds() {
      return new Map();
    },
  };
}

function prompts(
  count: number,
  receivedAt: string,
  qualityScore: number,
): PromptSummary[] {
  return Array.from({ length: count }, (_, index) =>
    promptSummary({
      id: `prmt_${receivedAt}_${index}`,
      received_at: receivedAt,
      quality_score: qualityScore,
    }),
  );
}

function promptSummary(overrides: Partial<PromptSummary>): PromptSummary {
  return {
    id: "prmt_default",
    tool: "claude-code",
    source_event: "UserPromptSubmit",
    session_id: "session",
    cwd: "/Users/example/project",
    created_at: "2026-05-02T10:00:00.000Z",
    received_at: "2026-05-02T10:00:00.000Z",
    snippet: "secret prompt body",
    prompt_length: 20,
    is_sensitive: false,
    excluded_from_analysis: false,
    redaction_policy: "mask",
    adapter_version: "test",
    index_status: "indexed",
    tags: [],
    quality_gaps: [],
    quality_score: 100,
    quality_score_band: "excellent",
    usefulness: {
      copied_count: 0,
      bookmarked: false,
    },
    duplicate_count: 0,
    ...overrides,
  };
}

function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
