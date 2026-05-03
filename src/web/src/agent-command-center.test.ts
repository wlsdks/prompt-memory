import { describe, expect, it } from "vitest";

import {
  createAgentCommandSnapshot,
  type AgentCommandSnapshot,
} from "./agent-command-center.js";
import type { ArchiveScoreReport, QualityDashboard } from "./api.js";

describe("createAgentCommandSnapshot", () => {
  it("builds agent-native commands without prompt bodies or local paths", () => {
    const snapshot = createAgentCommandSnapshot({
      archiveScore: createArchiveScoreReport(),
      dashboard: createQualityDashboard(),
    });

    expect(snapshot.score).toBe("63");
    expect(snapshot.scoredPrompts).toBe("8/10");
    expect(snapshot.nextAction).toBe("Review Goal clarity");
    expect(command(snapshot, "coach")).toBe("/prompt-memory:coach");
    expect(command(snapshot, "mcp-coach")).toBe(
      "prompt-memory:coach_prompt include_latest_score=true include_archive=true",
    );
    expect(command(snapshot, "mcp-score-latest")).toBe(
      "prompt-memory:score_prompt latest=true",
    );
    expect(command(snapshot, "buddy")).toBe("prompt-memory buddy");
    expect(JSON.stringify(snapshot)).not.toContain("/Users/example");
    expect(JSON.stringify(snapshot)).not.toContain("sk-proj");
  });

  it("falls back to a first capture action when no score data exists", () => {
    const snapshot = createAgentCommandSnapshot({});

    expect(snapshot.score).toBe("-");
    expect(snapshot.scoredPrompts).toBe("0/0");
    expect(snapshot.nextAction).toBe("Capture one real prompt");
  });
});

function command(snapshot: AgentCommandSnapshot, id: string): string {
  return snapshot.commands.find((item) => item.id === id)?.command ?? "";
}

function createArchiveScoreReport(): ArchiveScoreReport {
  return {
    archive_score: {
      average: 63,
      band: "needs_work",
      max: 100,
      scored_prompts: 8,
      total_prompts: 10,
    },
    distribution: {
      excellent: 0,
      good: 2,
      needs_work: 5,
      weak: 3,
    },
    filters: {
      max_prompts: 100,
    },
    generated_at: "2026-05-04T00:00:00.000Z",
    has_more: false,
    low_score_prompts: [
      {
        id: "prompt_1",
        is_sensitive: false,
        project: "example",
        quality_gaps: ["goal_clarity"],
        quality_score: 23,
        quality_score_band: "weak",
        received_at: "2026-05-04T00:00:00.000Z",
        tags: [],
        tool: "claude-code",
      },
    ],
    next_prompt_template: "Goal:\nContext:\nScope:\nVerification:\nOutput:",
    practice_plan: [],
    privacy: {
      external_calls: false,
      local_only: true,
      returns_prompt_bodies: false,
      returns_raw_paths: false,
    },
    top_gaps: [
      {
        count: 4,
        label: "Goal clarity",
        rate: 0.4,
      },
    ],
  };
}

function createQualityDashboard(): QualityDashboard {
  return {
    distribution: {
      by_project: [],
      by_tool: [],
    },
    duplicate_prompt_groups: [],
    instruction_suggestions: [],
    missing_items: [],
    patterns: [],
    project_profiles: [],
    quality_score: {
      average: 58,
      band: "needs_work",
      max: 100,
      scored_prompts: 7,
    },
    recent: {
      last_7_days: 3,
      last_30_days: 10,
    },
    sensitive_prompts: 0,
    sensitive_ratio: 0,
    total_prompts: 10,
    trend: {
      daily: [],
    },
    useful_prompts: [],
  };
}
