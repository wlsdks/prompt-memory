import { describe, expect, it } from "vitest";

import type { PromptReadStoragePort, PromptSummary } from "../storage/ports.js";
import { createArchiveScoreReport } from "./archive-score.js";

describe("createArchiveScoreReport", () => {
  it("summarizes prompt scores without returning prompt bodies or raw paths", () => {
    const storage = fakeStorage([
      prompt({
        id: "prmt_low",
        cwd: "/Users/example/private-project",
        received_at: "2026-05-02T10:00:00.000Z",
        quality_score: 10,
        quality_score_band: "weak",
        quality_gaps: ["Goal clarity", "Verification criteria"],
      }),
      prompt({
        id: "prmt_high",
        cwd: "/Users/example/private-project",
        received_at: "2026-05-02T10:01:00.000Z",
        quality_score: 100,
        quality_score_band: "excellent",
        quality_gaps: [],
      }),
      prompt({
        id: "prmt_mid",
        cwd: "/Users/example/other-project",
        received_at: "2026-05-02T10:02:00.000Z",
        quality_score: 65,
        quality_score_band: "good",
        quality_gaps: ["Scope limits"],
      }),
    ]);

    const report = createArchiveScoreReport(storage, {
      maxPrompts: 100,
      lowScoreLimit: 2,
    });
    const serialized = JSON.stringify(report);

    expect(report.archive_score).toMatchObject({
      average: 58,
      max: 100,
      band: "needs_work",
      scored_prompts: 3,
      total_prompts: 3,
    });
    expect(report.distribution).toEqual({
      excellent: 1,
      good: 1,
      needs_work: 0,
      weak: 1,
    });
    expect(report.top_gaps[0]).toMatchObject({
      label: "Goal clarity",
      count: 1,
    });
    expect(report.low_score_prompts.map((item) => item.id)).toEqual([
      "prmt_low",
      "prmt_mid",
    ]);
    expect(report.practice_plan[0]).toMatchObject({
      priority: 1,
      label: "Goal clarity",
      prompt_rule: "Name the exact goal and target behavior first.",
    });
    expect(report.next_prompt_template).toContain("Goal:");
    expect(report.next_prompt_template).toContain("Verification:");
    expect(serialized).not.toContain("/Users/example");
    expect(serialized).not.toContain("secret prompt body");
  });

  it("paginates through the archive up to maxPrompts", () => {
    const storage = fakeStorage(
      Array.from({ length: 125 }, (_, index) =>
        prompt({
          id: `prmt_${index.toString().padStart(3, "0")}`,
          quality_score: 100,
          quality_score_band: "excellent",
        }),
      ),
    );

    const report = createArchiveScoreReport(storage, { maxPrompts: 120 });

    expect(report.archive_score.scored_prompts).toBe(120);
    expect(report.has_more).toBe(true);
  });

  it("renders practice plan and prompt template in Korean when language is ko", () => {
    const storage = fakeStorage([
      prompt({
        id: "prmt_ko_low",
        cwd: "/Users/example/project",
        received_at: "2026-05-04T10:00:00.000Z",
        quality_score: 10,
        quality_score_band: "weak",
        quality_gaps: ["Goal clarity", "Verification criteria"],
      }),
    ]);

    const report = createArchiveScoreReport(storage, {
      maxPrompts: 100,
      lowScoreLimit: 5,
      language: "ko",
    });

    expect(report.practice_plan[0]).toMatchObject({
      priority: 1,
      label: "목표 명확성",
      prompt_rule: "정확한 목표와 기대 동작을 먼저 한 문장으로 적어주세요.",
    });
    expect(report.practice_plan[0]?.reason).toContain("측정된 프롬프트");
    expect(report.next_prompt_template).toContain("목표:");
    expect(report.next_prompt_template).toContain("검증:");
    expect(report.next_prompt_template).not.toContain("Goal:");
  });
});

function fakeStorage(items: PromptSummary[]): PromptReadStoragePort {
  return {
    listPrompts(options = {}) {
      const limit = options.limit ?? 20;
      const offset = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
      const page = items.slice(offset, offset + limit);
      const next = offset + page.length;
      return {
        items: page,
        nextCursor: next < items.length ? String(next) : undefined,
      };
    },
    searchPrompts() {
      return { items: [] };
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
  };
}

function prompt(overrides: Partial<PromptSummary>): PromptSummary {
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
