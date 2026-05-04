import { describe, expect, it } from "vitest";

import {
  createMcpReadiness,
  MCP_FLOW_STEPS,
  MCP_TOOL_CATALOG,
} from "./mcp-catalog.js";
import type { QualityDashboard, SettingsResponse } from "./api.js";

function dashboardFixture(
  overrides: Partial<QualityDashboard> = {},
): QualityDashboard {
  return {
    distribution: { by_project: [], by_tool: [] },
    duplicate_prompt_groups: [],
    instruction_suggestions: [],
    missing_items: [],
    patterns: [],
    project_profiles: [],
    quality_score: {
      average: 0,
      band: "weak",
      max: 100,
      scored_prompts: 0,
    },
    recent: { last_7_days: 0, last_30_days: 0 },
    sensitive_prompts: 0,
    sensitive_ratio: 0,
    total_prompts: 0,
    trend: { daily: [] },
    useful_prompts: [],
    ...overrides,
  };
}

describe("mcp catalog", () => {
  it("keeps tool catalog privacy-safe", () => {
    expect(MCP_TOOL_CATALOG).toHaveLength(10);
    expect(MCP_TOOL_CATALOG.map((tool) => tool.name)).toEqual([
      "get_prompt_memory_status",
      "coach_prompt",
      "score_prompt",
      "improve_prompt",
      "prepare_agent_rewrite",
      "record_agent_rewrite",
      "score_prompt_archive",
      "review_project_instructions",
      "prepare_agent_judge_batch",
      "record_agent_judgments",
    ]);
    expect(MCP_TOOL_CATALOG.every((tool) => tool.privacy.length > 0)).toBe(
      true,
    );
  });

  it("keeps the recommended flow coach-first after readiness", () => {
    expect(MCP_FLOW_STEPS.map((step) => step.tool)).toEqual([
      "get_prompt_memory_status",
      "coach_prompt",
      "score_prompt",
      "improve_prompt",
      "score_prompt_archive",
      "review_project_instructions",
    ]);
  });

  it("starts with status when no archive data is loaded", () => {
    const readiness = createMcpReadiness({});

    expect(readiness.tone).toBe("muted");
    expect(readiness.firstCall).toBe("get_prompt_memory_status");
  });

  it("promotes one-call coaching after prompts are captured", () => {
    const settings: SettingsResponse = {
      data_dir: "/tmp/prompt-memory",
      excluded_project_roots: [],
      redaction_mode: "mask",
      server: { host: "127.0.0.1", port: 17373 },
    };
    const readiness = createMcpReadiness({
      dashboard: dashboardFixture({
        quality_score: {
          average: 70,
          band: "good",
          max: 100,
          scored_prompts: 5,
        },
        total_prompts: 6,
      }),
      health: { ok: true, version: "0.1.0" },
      settings,
    });

    expect(readiness.status).toBe("Ready for archive review");
    expect(readiness.tone).toBe("ready");
    expect(readiness.firstCall).toBe("coach_prompt");
  });
});
