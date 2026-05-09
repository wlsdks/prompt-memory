import { describe, expect, it } from "vitest";

import {
  appendPracticeHistory,
  createPracticeHistoryItem,
  markPracticeOutcome,
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

  it("marks copied draft outcomes without storing prompt content", () => {
    const first = createPracticeHistoryItem({
      analysis: analysisFixture({ score: 91 }),
      now: new Date("2026-05-03T01:03:00.000Z"),
    });
    const second = createPracticeHistoryItem({
      analysis: analysisFixture({ score: 72, label: "Scope boundaries" }),
      now: new Date("2026-05-03T01:04:00.000Z"),
    });

    const history = markPracticeOutcome(
      [second, first],
      first.id,
      "worked",
      new Date("2026-05-03T01:05:00.000Z"),
    );

    expect(history[0]?.outcome).toBeUndefined();
    expect(history[1]).toMatchObject({
      id: first.id,
      outcome: "worked",
      outcome_at: "2026-05-03T01:05:00.000Z",
    });
    expect(JSON.stringify(history)).not.toContain("Fix the private project");
    expect(JSON.stringify(history)).not.toContain("/Users/example");
    expect(JSON.stringify(history)).not.toContain("sk-proj");
  });

  it("summarizes copied draft outcomes", () => {
    const first = createPracticeHistoryItem({
      analysis: analysisFixture({ score: 80 }),
      now: new Date("2026-05-03T01:03:00.000Z"),
    });
    const second = createPracticeHistoryItem({
      analysis: analysisFixture({ score: 75 }),
      now: new Date("2026-05-03T01:04:00.000Z"),
    });
    const third = createPracticeHistoryItem({
      analysis: analysisFixture({ score: 68 }),
      now: new Date("2026-05-03T01:05:00.000Z"),
    });

    const history = markPracticeOutcome(
      markPracticeOutcome(
        markPracticeOutcome([third, second, first], third.id, "blocked"),
        second.id,
        "needs_context",
      ),
      first.id,
      "worked",
    );

    expect(summarizePracticeHistory(history)).toMatchObject({
      workedCount: 1,
      needsContextCount: 1,
      blockedCount: 1,
      latestOutcome: "blocked",
    });
  });

  it("reads legacy history and rejects invalid outcome values", () => {
    const storage = createMemoryStorage();
    const valid = createPracticeHistoryItem({
      analysis: analysisFixture({ score: 90 }),
      now: new Date("2026-05-03T01:06:00.000Z"),
    });
    storage.setItem(
      "prompt-coach.practice-history.v1",
      JSON.stringify([
        valid,
        { ...valid, id: "bad-outcome", outcome: "auto_approved" },
        { ...valid, id: "with-outcome", outcome: "needs_context" },
      ]),
    );

    expect(readPracticeHistory(storage).map((item) => item.id)).toEqual([
      valid.id,
      "with-outcome",
    ]);
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
