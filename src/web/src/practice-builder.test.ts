import { describe, expect, it } from "vitest";

import {
  appendPracticeQuickFix,
  applyPracticeQuickFixes,
  createPracticeQuickFixes,
} from "./practice-builder.js";
import type { PracticePromptAnalysis } from "./practice-history.js";

describe("practice quick-fix builder", () => {
  it("creates one-click section snippets for missing prompt habits", () => {
    const fixes = createPracticeQuickFixes(
      analysisFixture({
        checklist: [
          {
            key: "goal_clarity",
            label: "Goal clarity",
            status: "weak",
          },
          {
            key: "verification_criteria",
            label: "Verification criteria",
            status: "missing",
          },
          {
            key: "output_format",
            label: "Output format",
            status: "good",
          },
        ],
      }),
    );

    expect(fixes).toEqual([
      {
        key: "goal_clarity",
        label: "Goal clarity",
        actionLabel: "Add Goal",
        snippet: "Goal: state the exact target and expected behavior.",
      },
      {
        key: "verification_criteria",
        label: "Verification criteria",
        actionLabel: "Add Verification",
        snippet: "Verification: name commands or acceptance checks.",
      },
    ]);
  });

  it("appends a section without storing or leaking prompt body material", () => {
    const [fix] = createPracticeQuickFixes(
      analysisFixture({
        summary:
          "Fix /Users/example/private-project with token sk-proj-1234567890abcdef.",
        checklist: [
          {
            key: "background_context",
            label: "Background context",
            status: "missing",
            reason:
              "Missing context from /Users/example/private-project and sk-proj-1234567890abcdef.",
          },
        ],
      }),
    );

    const nextDraft = appendPracticeQuickFix("Fix the bug.", fix);

    expect(nextDraft).toBe(
      "Fix the bug.\nContext: include relevant files, current state, and constraints.",
    );
    expect(JSON.stringify(fix)).not.toContain("/Users/example");
    expect(JSON.stringify(fix)).not.toContain("sk-proj");
  });

  it("does not duplicate an existing section heading", () => {
    const [fix] = createPracticeQuickFixes(
      analysisFixture({
        checklist: [
          {
            key: "scope_limits",
            label: "Scope limits",
            status: "weak",
          },
        ],
      }),
    );

    expect(appendPracticeQuickFix("Goal: fix it\nScope: only UI", fix)).toBe(
      "Goal: fix it\nScope: only UI",
    );
  });

  it("builds a projected draft by applying every missing section once", () => {
    const fixes = createPracticeQuickFixes(
      analysisFixture({
        summary:
          "Fix /Users/example/private-project with token sk-proj-1234567890abcdef.",
        checklist: [
          {
            key: "goal_clarity",
            label: "Goal clarity",
            status: "missing",
          },
          {
            key: "scope_limits",
            label: "Scope limits",
            status: "weak",
          },
          {
            key: "verification_criteria",
            label: "Verification criteria",
            status: "missing",
          },
        ],
      }),
    );

    const projectedDraft = applyPracticeQuickFixes("Context: existing", fixes);

    expect(projectedDraft).toContain(
      "Goal: state the exact target and expected behavior.",
    );
    expect(projectedDraft).toContain(
      "Scope: list allowed changes and explicit non-goals.",
    );
    expect(projectedDraft).toContain(
      "Verification: name commands or acceptance checks.",
    );
    expect(projectedDraft.match(/^Context:/gm)).toHaveLength(1);
    expect(projectedDraft).not.toContain("/Users/example");
    expect(projectedDraft).not.toContain("sk-proj");
  });
});

function analysisFixture({
  checklist,
  summary = "Practice draft summary.",
}: {
  checklist: PracticePromptAnalysis["checklist"];
  summary?: string;
}): PracticePromptAnalysis {
  return {
    analyzer: "local-rules-v1",
    summary,
    checklist,
    quality_score: {
      value: 50,
      max: 100,
      band: "needs_work",
    },
  };
}
