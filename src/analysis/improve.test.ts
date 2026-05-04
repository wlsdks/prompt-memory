import { describe, expect, it } from "vitest";

import { improvePrompt } from "./improve.js";

describe("improvePrompt", () => {
  it("turns vague prompts into an approval-ready structured prompt", () => {
    const result = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("Goal");
    expect(result.improved_prompt).toContain("Scope");
    expect(result.improved_prompt).toContain("Verification");
    expect(result.improved_prompt).toContain("Output");
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
    expect(result.summary).toContain("resubmit");
  });

  it("preserves concrete user intent without inventing files or commands", () => {
    const result = improvePrompt({
      prompt:
        "Fix the delete API bug in src/server/routes/prompts.ts. Run pnpm test and return a summary.",
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
      "Sensitive placeholders were not copied into the improvement draft.",
    );
  });

  it("masks raw secrets before building the improved prompt", () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const result = improvePrompt({
      prompt: `Debug this request with ${rawSecret}`,
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(rawSecret);
    expect(result.improved_prompt).toContain("sensitive content");
    expect(result.safety_notes).toContain(
      "Sensitive content was represented only after mask redaction.",
    );
  });

  it("auto-detects Korean prompts and produces a Korean draft when language is unset", () => {
    const result = improvePrompt({
      prompt: "더 잘 만들어주세요",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("## 목표");
    expect(result.improved_prompt).toContain("## 검증");
    expect(result.improved_prompt).toContain("## 출력");
  });

  it("keeps the English draft for prompts with only a few Korean tokens", () => {
    const result = improvePrompt({
      prompt:
        "Fix the delete API bug in src/server/routes/prompts.ts. Run pnpm test and return a summary. (메모: 한국어 한 줄)",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("## Goal");
    expect(result.improved_prompt).not.toContain("## 목표");
  });

  it("respects an explicit language override over auto-detection", () => {
    const result = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-04T00:00:00.000Z",
      language: "ko",
    });

    expect(result.improved_prompt).toContain("## 목표");
    expect(result.improved_prompt).not.toContain("## Goal");
  });
});
