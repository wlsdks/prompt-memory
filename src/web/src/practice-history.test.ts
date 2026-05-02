import { describe, expect, it } from "vitest";

import {
  appendPracticeHistory,
  createPracticeHistoryItem,
  readPracticeHistory,
  summarizePracticeHistory,
  type PracticePromptAnalysis,
  writePracticeHistory,
} from "./practice-history.js";

describe("practice history", () => {
  it("records score metadata without storing prompt draft text", () => {
    const item = createPracticeHistoryItem({
      analysis: analysisFixture(),
      now: new Date("2026-05-03T01:00:00.000Z"),
    });

    expect(item).toMatchObject({
      created_at: "2026-05-03T01:00:00.000Z",
      score: {
        value: 82,
        max: 100,
        band: "good",
      },
      missing_labels: ["Verification criteria"],
    });
    expect(JSON.stringify(item)).not.toContain("Fix the private project");
    expect(JSON.stringify(item)).not.toContain("/Users/example");
    expect(JSON.stringify(item)).not.toContain("sk-proj");
  });

  it("keeps newest score history first and summarizes trend", () => {
    const history = appendPracticeHistory(
      [
        createPracticeHistoryItem({
          analysis: analysisFixture({ score: 60, label: "Output format" }),
          now: new Date("2026-05-03T00:59:00.000Z"),
        }),
      ],
      createPracticeHistoryItem({
        analysis: analysisFixture({
          score: 88,
          label: "Verification criteria",
        }),
        now: new Date("2026-05-03T01:00:00.000Z"),
      }),
    );

    expect(history.map((item) => item.score.value)).toEqual([88, 60]);
    expect(summarizePracticeHistory(history)).toMatchObject({
      count: 2,
      averageScore: 74,
      latestScore: 88,
      bestScore: 88,
      delta: 28,
      repeatedGap: "Verification criteria",
    });
  });

  it("serializes only bounded metadata to browser storage", () => {
    const storage = createMemoryStorage();
    const history = [
      createPracticeHistoryItem({
        analysis: analysisFixture({ score: 91 }),
        now: new Date("2026-05-03T01:02:00.000Z"),
      }),
    ];

    writePracticeHistory(storage, history);

    expect(readPracticeHistory(storage)).toEqual(history);
    expect(storage.value).not.toContain("Fix the private project");
    expect(storage.value).not.toContain("/Users/example");
    expect(storage.value).not.toContain("sk-proj");
  });
});

function analysisFixture({
  label = "Verification criteria",
  score = 82,
}: {
  label?: string;
  score?: number;
} = {}): PracticePromptAnalysis {
  return {
    analyzer: "local-rules-v1",
    summary: "Fix the private project at /Users/example with sk-proj token.",
    tags: [],
    warnings: [],
    checklist: [
      {
        key: "goal_clarity",
        label: "Goal clarity",
        status: "good",
        reason: "The task is clear.",
      },
      {
        key: label.toLowerCase().replaceAll(" ", "_"),
        label,
        status: "missing",
        reason: "Missing.",
        suggestion: "Add this section.",
      },
    ],
    quality_score: {
      value: score,
      max: 100,
      band: score >= 80 ? "good" : "needs_work",
      breakdown: [],
    },
  };
}

function createMemoryStorage() {
  return {
    value: "",
    getItem() {
      return this.value || null;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
}
