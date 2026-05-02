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
    expect(result.summary).toContain("relatively clear");
    expect(result.warnings).not.toContain(
      "Completion criteria or verification steps are missing.",
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
      prompt: "Make this better",
      createdAt: "2026-05-01T10:00:00.000Z",
    });

    expect(result.summary).toContain("short request");
    expect(result.quality_score).toMatchObject({
      value: 10,
      max: 100,
      band: "weak",
    });
    expect(result.warnings).toContain(
      "The target or background context is missing.",
    );
    expect(result.warnings).toContain(
      "Completion criteria or verification steps are missing.",
    );
    expect(result.suggestions).toContain(
      "Add the target file, command, error message, and expected behavior.",
    );
    expect(result.suggestions).toContain(
      "Add verification criteria: list the tests to run and the expected result.",
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
      "Sensitive content was masked, so analysis may be less precise.",
    );
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
          status: "missing",
          earned: 0,
        }),
      ]),
    );
  });
});
