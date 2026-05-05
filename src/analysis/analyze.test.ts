import { describe, expect, it } from "vitest";

import { analyzePrompt } from "./analyze.js";

describe("analyzePrompt", () => {
  it("summarizes strong prompts without using external services", () => {
    const result = analyzePrompt({
      prompt:
        "Because browser security checks are incomplete, update src/server/create-server.ts to reject cross-site requests. Add Vitest coverage and run pnpm test. Return a concise Markdown summary.",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.analyzer).toBe("local-rules-v1");
    expect(result.quality_score).toMatchObject({
      value: 100,
      max: 100,
      band: "excellent",
    });
    expect(result.quality_score.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "goal_clarity",
          weight: 25,
          earned: 25,
        }),
        expect.objectContaining({
          key: "verification_criteria",
          weight: 20,
          earned: 20,
        }),
      ]),
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
    expect(result.redaction_notice).toBeUndefined();
  });

  it("flags vague prompts via the checklist (not duplicate warnings/hints)", () => {
    const result = analyzePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.quality_score).toMatchObject({
      value: 10,
      max: 100,
      band: "weak",
    });
    expect(result.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "goal_clarity",
          status: "missing",
          suggestion: expect.stringContaining("Add a goal"),
        }),
        expect.objectContaining({
          key: "verification_criteria",
          status: "missing",
          suggestion: expect.stringContaining("Add verification criteria"),
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

    expect(result.redaction_notice).toContain("Sensitive content was masked");
    expect(serialized).not.toContain("[REDACTED:api_key]");
    expect(result.tags).not.toContain("security");
  });

  it("extracts conservative product tags from the prompt body", () => {
    const result = analyzePrompt({
      prompt:
        "Update the UI detail screen and add Playwright verification. Also update docs.",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.tags).toEqual(expect.arrayContaining(["ui", "test", "docs"]));
  });

  it("scores partial prompts between vague and complete prompts", () => {
    const result = analyzePrompt({
      prompt:
        "Review src/web/src/App.tsx export UI and return a Markdown summary.",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.quality_score.value).toBeGreaterThan(50);
    expect(result.quality_score.value).toBeLessThan(85);
    expect(result.quality_score.band).toBe("good");
    expect(result.quality_score.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "verification_criteria",
          earned: 0,
        }),
      ]),
    );
  });

  it("recognizes Korean prompt signals for context, output, and verification", () => {
    const result = analyzePrompt({
      prompt:
        "현재 doctor 명령에서 401 오류가 발생합니다. 다음 단계 안내를 요약 형식으로 보강하고 vitest 테스트로 검증하세요. src/cli/commands/doctor.ts만 수정하고 그 외 파일은 유지합니다.",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    const status = (key: string) =>
      result.checklist.find((item) => item.key === key)?.status;

    expect(status("background_context")).toBe("good");
    expect(status("output_format")).toBe("good");
    expect(status("verification_criteria")).toBe("good");
    expect(result.quality_score.band).toBe("excellent");
  });

  it("treats assert/expect keywords as missing verification without verification_v2", () => {
    const result = analyzePrompt({
      prompt:
        "Update src/format.ts and use describe and expect blocks for the spec covering each scenario.",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    const status = result.checklist.find(
      (item) => item.key === "verification_criteria",
    )?.status;
    expect(status).toBe("missing");
  });

  it("recognizes assert/expect/scenario keywords once verification_v2 is enabled", () => {
    const sharedPrompt =
      "Refactor src/format.ts so each scenario uses the assert and expect blocks consistently.";

    const baseline = analyzePrompt({
      prompt: sharedPrompt,
      createdAt: "2026-05-04T00:00:00.000Z",
    });
    const baselineStatus = baseline.checklist.find(
      (item) => item.key === "verification_criteria",
    )?.status;

    const experimental = analyzePrompt({
      prompt: sharedPrompt,
      createdAt: "2026-05-04T00:00:00.000Z",
      experimentalRules: ["verification_v2"],
    });
    const experimentalStatus = experimental.checklist.find(
      (item) => item.key === "verification_criteria",
    )?.status;

    expect(baselineStatus).toBe("missing");
    expect(experimentalStatus).toBe("good");
    expect(experimental.quality_score.value).toBeGreaterThan(
      baseline.quality_score.value,
    );
  });

  it("extracts product tags from Korean prompt bodies", () => {
    const result = analyzePrompt({
      prompt:
        "프롬프트 detail 화면에서 마스킹 회귀 테스트를 추가하고 문서를 업데이트해줘.",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    expect(result.tags).toEqual(
      expect.arrayContaining(["ui", "security", "test", "docs"]),
    );
  });
});
