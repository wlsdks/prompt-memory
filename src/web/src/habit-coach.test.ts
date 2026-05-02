import { describe, expect, it } from "vitest";

import type { ArchiveScoreReport, QualityDashboard } from "./api.js";
import { createPromptHabitCoach } from "./habit-coach.js";

describe("createPromptHabitCoach", () => {
  it("summarizes habit status, repeated weakness, next fixes, and review queue", () => {
    const coach = createPromptHabitCoach(
      dashboardFixture(),
      archiveScoreFixture(),
    );

    expect(coach.score).toMatchObject({
      value: 58,
      scoredPrompts: 3,
      band: "needs_work",
    });
    expect(coach.status).toMatchObject({
      label: "Improving",
      tone: "steady",
    });
    expect(coach.trend).toMatchObject({
      delta: 20,
      label: "Improving",
    });
    expect(coach.biggestWeakness).toMatchObject({
      key: "verification_criteria",
      label: "Verification criteria",
      count: 3,
    });
    expect(coach.nextFixes[0]).toMatchObject({
      command: "Include the verification command or acceptance check.",
      rate: 0.75,
    });
    expect(coach.reviewQueue).toEqual([
      expect.objectContaining({
        id: "prmt_low",
        project: "private-project",
        reasons: ["Verification criteria", "Scope limits"],
      }),
    ]);
    expect(JSON.stringify(coach)).not.toContain("secret prompt body");
    expect(JSON.stringify(coach)).not.toContain("/Users/example");
  });

  it("keeps high scoring prompts out of the low score review queue", () => {
    const archiveScore = archiveScoreFixture();
    archiveScore.low_score_prompts.unshift({
      id: "prmt_strong",
      tool: "codex",
      project: "private-project",
      received_at: "2026-05-02T10:05:00.000Z",
      quality_score: 92,
      quality_score_band: "excellent",
      quality_gaps: ["Output format"],
      tags: ["frontend"],
      is_sensitive: false,
    });

    const coach = createPromptHabitCoach(dashboardFixture(), archiveScore);

    expect(coach.reviewQueue.map((prompt) => prompt.id)).toEqual(["prmt_low"]);
  });

  it("shows an empty status when there are no scored prompts", () => {
    const dashboard = dashboardFixture({
      total_prompts: 0,
      quality_score: {
        average: 0,
        max: 100,
        band: "weak",
        scored_prompts: 0,
      },
      missing_items: [],
      trend: { daily: [] },
    });

    const coach = createPromptHabitCoach(dashboard);

    expect(coach.status).toEqual({
      label: "No data yet",
      tone: "empty",
    });
    expect(coach.patternSummary.detail).toContain("No repeated");
  });
});

function dashboardFixture(
  overrides: Partial<QualityDashboard> = {},
): QualityDashboard {
  return {
    total_prompts: 3,
    sensitive_prompts: 0,
    sensitive_ratio: 0,
    recent: {
      last_7_days: 3,
      last_30_days: 3,
    },
    trend: {
      daily: [
        day("2026-04-26", 40),
        day("2026-04-27", 50),
        day("2026-05-01", 65),
        day("2026-05-02", 65),
      ],
    },
    quality_score: {
      average: 58,
      max: 100,
      band: "needs_work",
      scored_prompts: 3,
    },
    distribution: {
      by_tool: [],
      by_project: [],
    },
    missing_items: [
      {
        key: "verification_criteria",
        label: "Verification criteria",
        missing: 2,
        weak: 1,
        total: 4,
        rate: 0.75,
      },
      {
        key: "scope_limits",
        label: "Scope limits",
        missing: 1,
        weak: 1,
        total: 4,
        rate: 0.5,
      },
    ],
    patterns: [],
    instruction_suggestions: [],
    useful_prompts: [],
    duplicate_prompt_groups: [],
    project_profiles: [],
    ...overrides,
  };
}

function archiveScoreFixture(): ArchiveScoreReport {
  return {
    generated_at: "2026-05-02T10:00:00.000Z",
    archive_score: {
      average: 58,
      max: 100,
      band: "needs_work",
      scored_prompts: 3,
      total_prompts: 3,
    },
    distribution: {
      excellent: 0,
      good: 1,
      needs_work: 1,
      weak: 1,
    },
    top_gaps: [
      {
        label: "Verification criteria",
        count: 3,
        rate: 0.75,
      },
    ],
    practice_plan: [
      {
        priority: 1,
        label: "Verification criteria",
        prompt_rule: "Include the test command, check, or acceptance criteria.",
        reason: "3 measured prompts missed this habit.",
        count: 3,
        rate: 0.75,
      },
    ],
    next_prompt_template:
      "Verification: name commands or acceptance checks.\nGoal:\nContext:\nScope:\nOutput:",
    low_score_prompts: [
      {
        id: "prmt_low",
        tool: "claude-code",
        project: "private-project",
        received_at: "2026-05-02T10:00:00.000Z",
        quality_score: 20,
        quality_score_band: "weak",
        quality_gaps: ["Verification criteria", "Scope limits"],
        tags: ["backend"],
        is_sensitive: false,
      },
    ],
    filters: {
      max_prompts: 200,
    },
    has_more: false,
    privacy: {
      local_only: true,
      external_calls: false,
      returns_prompt_bodies: false,
      returns_raw_paths: false,
    },
  };
}

function day(date: string, average_quality_score: number) {
  return {
    date,
    prompt_count: 1,
    quality_gap_count: 1,
    quality_gap_rate: 1,
    average_quality_score,
    sensitive_count: 0,
  };
}
