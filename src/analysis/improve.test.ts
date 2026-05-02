import { describe, expect, it } from "vitest";

import { improvePrompt } from "./improve.js";

describe("improvePrompt", () => {
  it("turns vague prompts into an approval-ready structured prompt", () => {
    const result = improvePrompt({
      prompt: "이거 좀 고쳐줘",
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("목표");
    expect(result.improved_prompt).toContain("범위");
    expect(result.improved_prompt).toContain("검증");
    expect(result.improved_prompt).toContain("출력");
    expect(result.mode).toBe("copy");
    expect(result.requires_user_approval).toBe(true);
    expect(result.changed_sections).toEqual(
      expect.arrayContaining([
        "goal_clarity",
        "background_context",
        "scope_limits",
        "output_format",
        "verification_criteria",
      ]),
    );
    expect(result.summary).toContain("재입력");
  });

  it("preserves concrete user intent without inventing files or commands", () => {
    const result = improvePrompt({
      prompt:
        "src/server/routes/prompts.ts에서 delete API 오류를 고쳐줘. pnpm test 실행하고 요약해줘.",
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("src/server/routes/prompts.ts");
    expect(result.improved_prompt).toContain("delete API");
    expect(result.improved_prompt).toContain("pnpm test");
    expect(result.improved_prompt).not.toContain("src/storage/sqlite.ts");
    expect(result.changed_sections).not.toContain("goal_clarity");
  });

  it("does not reintroduce raw secret values from redacted prompts", () => {
    const result = improvePrompt({
      prompt: "Debug this request with [REDACTED:api_key]",
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("sk-proj");
    expect(serialized).not.toContain("[REDACTED:api_key]");
    expect(result.safety_notes).toContain(
      "민감정보 placeholder는 개선안에 포함하지 않았습니다.",
    );
  });
});
