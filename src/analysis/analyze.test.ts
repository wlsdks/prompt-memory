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
    expect(result.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "verification_criteria",
          status: "good",
        }),
        expect.objectContaining({ key: "output_format", status: "good" }),
      ]),
    );
    expect(result.tags).toEqual(
      expect.arrayContaining(["backend", "security", "test"]),
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
    expect(result.suggestions).toContain(
      "검증 기준을 추가하세요: 실행할 테스트와 기대 결과를 적어주세요.",
    );
    expect(result.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "goal_clarity", status: "missing" }),
        expect.objectContaining({
          key: "verification_criteria",
          status: "missing",
        }),
      ]),
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
    expect(result.tags).not.toContain("security");
  });

  it("extracts conservative product tags from the prompt body", () => {
    const result = analyzePrompt({
      prompt:
        "UI detail 화면을 수정하고 Playwright 검증을 추가해줘. docs도 갱신해줘.",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.tags).toEqual(expect.arrayContaining(["ui", "test", "docs"]));
  });
});
