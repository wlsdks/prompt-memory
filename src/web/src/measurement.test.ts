import { describe, expect, it } from "vitest";

import type { ArchiveScoreReport, QualityDashboard } from "./api.js";
import { createArchiveMeasurement } from "./measurement.js";

describe("createArchiveMeasurement", () => {
  it("turns archive score data into a next-action measurement without raw prompt data", () => {
    const measurement = createArchiveMeasurement({
      archiveScore: archiveScoreFixture(),
      dashboard: dashboardFixture(),
      measuredAt: "2026-05-02T10:05:00.000Z",
    });

    expect(measurement.status).toMatchObject({
      label: "Needs work",
      tone: "attention",
    });
    expect(measurement.reviewBacklog).toMatchObject({
      count: 1,
      rate: 0.33,
    });
    expect(measurement.biggestGap).toMatchObject({
      label: "Verification criteria",
      rate: 0.75,
    });
    expect(measurement.nextAction).toMatchObject({
      label: "Review 1 low-score prompt",
      target: "review",
    });
    expect(measurement.privacy).toMatchObject({
      ok: true,
      label: "Local-only",
    });
    expect(JSON.stringify(measurement)).not.toContain("/Users/example");
    expect(JSON.stringify(measurement)).not.toContain("secret prompt body");
  });

  it("shows a capture-first measurement when no prompt has been scored", () => {
    const measurement = createArchiveMeasurement({
      dashboard: dashboardFixture({
        total_prompts: 0,
        quality_score: {
          average: 0,
          max: 100,
          band: "weak",
          scored_prompts: 0,
        },
      }),
    });

    expect(measurement.status).toEqual({
      label: "No data yet",
      detail: "Capture a few Claude Code or Codex prompts before measuring.",
      tone: "empty",
    });
    expect(measurement.nextAction).toEqual({
      label: "Capture prompts first",
      detail: "Run prompt-memory setup, then send a few real coding requests.",
      target: "capture",
    });
  });
});

function dashboardFixture(
  overrides: Partial<QualityDashboard> = {},
): QualityDashboard {
  return {
    total_prompts: 3,
    sensitive_prompts: 1,
    sensitive_ratio: 1 / 3,
    recent: {
      last_7_days: 3,
      last_30_days: 3,
    },
    trend: { daily: [] },
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
