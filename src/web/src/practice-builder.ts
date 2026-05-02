import type { PromptQualityGap } from "./api.js";
import type { PracticePromptAnalysis } from "./practice-history.js";

export type PracticeQuickFix = {
  key: string;
  label: string;
  actionLabel: string;
  snippet: string;
};

const SECTION_FIXES: Record<
  PromptQualityGap,
  {
    actionLabel: string;
    label: string;
    section: string;
    snippet: string;
  }
> = {
  goal_clarity: {
    actionLabel: "Add Goal",
    label: "Goal clarity",
    section: "Goal",
    snippet: "Goal: state the exact target and expected behavior.",
  },
  background_context: {
    actionLabel: "Add Context",
    label: "Background context",
    section: "Context",
    snippet: "Context: include relevant files, current state, and constraints.",
  },
  scope_limits: {
    actionLabel: "Add Scope",
    label: "Scope limits",
    section: "Scope",
    snippet: "Scope: list allowed changes and explicit non-goals.",
  },
  output_format: {
    actionLabel: "Add Output",
    label: "Output format",
    section: "Output",
    snippet: "Output: define the exact format you want back.",
  },
  verification_criteria: {
    actionLabel: "Add Verification",
    label: "Verification criteria",
    section: "Verification",
    snippet: "Verification: name commands or acceptance checks.",
  },
};

export function createPracticeQuickFixes(
  analysis: PracticePromptAnalysis,
): PracticeQuickFix[] {
  return analysis.checklist
    .filter((item) => item.status !== "good")
    .map((item) => {
      const knownFix = isPromptQualityGap(item.key)
        ? SECTION_FIXES[item.key]
        : undefined;

      if (knownFix) {
        return {
          key: item.key,
          label: knownFix.label,
          actionLabel: knownFix.actionLabel,
          snippet: knownFix.snippet,
        };
      }

      return {
        key: String(item.key),
        label: "Improve prompt",
        actionLabel: "Add note",
        snippet: "Note: add the missing detail before sending.",
      };
    });
}

export function appendPracticeQuickFix(
  draft: string,
  fix: PracticeQuickFix,
): string {
  if (hasSection(draft, fix)) {
    return draft;
  }

  const trimmedDraft = draft.trimEnd();
  if (!trimmedDraft) {
    return fix.snippet;
  }

  return `${trimmedDraft}\n${fix.snippet}`;
}

function hasSection(draft: string, fix: PracticeQuickFix): boolean {
  const section = sectionForFix(fix);
  if (!section) {
    return draft.includes(fix.snippet);
  }

  return new RegExp(`(^|\\n)\\s*${escapeRegExp(section)}\\s*:`, "i").test(
    draft,
  );
}

function sectionForFix(fix: PracticeQuickFix): string | undefined {
  return Object.values(SECTION_FIXES).find(
    (knownFix) => knownFix.actionLabel === fix.actionLabel,
  )?.section;
}

function isPromptQualityGap(value: string): value is PromptQualityGap {
  return value in SECTION_FIXES;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
