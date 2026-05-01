import { describe, expect, it } from "vitest";

import { analyzePrompt } from "./analyze.js";

describe("analyzePrompt", () => {
  it("summarizes strong prompts without using external services", () => {
    const result = analyzePrompt({
      prompt:
        "Update src/server/create-server.ts to reject cross-site requests. Add Vitest coverage and run pnpm test. Return a concise Markdown summary.",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.analyzer).toBe("local-rules-v1");
    expect(result.summary).toContain("구체적인");
    expect(result.warnings).not.toContain(
      "완료 기준이나 검증 방법이 없습니다.",
    );
    expect(result.suggestions).toEqual([]);
  });

  it("flags vague prompts and suggests concrete improvements", () => {
    const result = analyzePrompt({
      prompt: "이거 좀 좋게 고쳐줘",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.summary).toContain("짧은 요청");
    expect(result.warnings).toContain("작업 대상이나 배경 맥락이 부족합니다.");
    expect(result.warnings).toContain("완료 기준이나 검증 방법이 없습니다.");
    expect(result.suggestions).toContain(
      "대상 파일, 명령, 에러 메시지, 현재 기대 동작을 함께 적어보세요.",
    );
  });

  it("does not echo redacted secret placeholders in analysis output", () => {
    const result = analyzePrompt({
      prompt: "Use [REDACTED:api_key] to debug this failing request",
      createdAt: "2026-05-01T10:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(result.warnings).toContain(
      "민감정보가 마스킹되어 분석 정확도가 제한될 수 있습니다.",
    );
    expect(serialized).not.toContain("[REDACTED:api_key]");
  });
});
