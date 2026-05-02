import type { PromptQualityCriterion } from "../shared/schema.js";
import { redactPrompt } from "../redaction/redact.js";
import { analyzePrompt } from "./analyze.js";

export type ImprovePromptInput = {
  prompt: string;
  createdAt: string;
};

export type PromptImprovement = {
  mode: "copy";
  requires_user_approval: true;
  summary: string;
  improved_prompt: string;
  changed_sections: PromptQualityCriterion[];
  safety_notes: string[];
  created_at: string;
  analyzer: "local-rules-v1";
};

const SECTION_LABELS: Record<PromptQualityCriterion, string> = {
  goal_clarity: "Goal",
  background_context: "Context",
  scope_limits: "Scope",
  output_format: "Output",
  verification_criteria: "Verification",
};

export function improvePrompt(input: ImprovePromptInput): PromptImprovement {
  const redaction = redactPrompt(input.prompt, "mask");
  const sanitizedPrompt = sanitizePrompt(redaction.stored_text);
  const analysis = analyzePrompt({
    prompt: sanitizedPrompt,
    createdAt: input.createdAt,
  });
  const changedSections = analysis.checklist
    .filter((item) => item.status !== "good")
    .map((item) => item.key);
  const sections = buildSections(sanitizedPrompt, changedSections);

  return {
    mode: "copy",
    requires_user_approval: true,
    summary:
      changedSections.length === 0
        ? "Reformatted the original intent into a clearer request that is easier to reuse."
        : "Filled the missing sections so the user can approve, copy, and resubmit the request manually.",
    improved_prompt: [
      "Please work from the following request.",
      "",
      ...sections.flatMap(([label, body]) => [`## ${label}`, body, ""]),
    ]
      .join("\n")
      .trim(),
    changed_sections: changedSections,
    safety_notes: buildSafetyNotes(input.prompt, redaction.is_sensitive),
    created_at: input.createdAt,
    analyzer: "local-rules-v1",
  };
}

function buildSections(
  prompt: string,
  changedSections: PromptQualityCriterion[],
): Array<[string, string]> {
  const changed = new Set(changedSections);

  return [
    [
      SECTION_LABELS.goal_clarity,
      changed.has("goal_clarity")
        ? "Confirm the original intent, then state the exact target and expected behavior."
        : prompt,
    ],
    [
      SECTION_LABELS.background_context,
      changed.has("background_context")
        ? "Review the current state and the problem background using the code and test results."
        : "Preserve the background and constraints from the original request.",
    ],
    [
      SECTION_LABELS.scope_limits,
      changed.has("scope_limits")
        ? "Change only the minimum area needed for the request and avoid unrelated refactors or behavior changes."
        : "Keep the scope and constraints stated in the original request.",
    ],
    [
      SECTION_LABELS.verification_criteria,
      changed.has("verification_criteria")
        ? "Run the narrowest relevant tests first, then lint/build checks if needed."
        : "Use the verification commands and expected results from the original request.",
    ],
    [
      SECTION_LABELS.output_format,
      changed.has("output_format")
        ? "Return a concise Markdown summary with changes, verification results, and remaining risks."
        : "Keep the output format requested in the original prompt.",
    ],
    ["Original prompt", prompt],
  ];
}

function sanitizePrompt(prompt: string): string {
  const withoutRedacted = prompt
    .replace(/\[REDACTED:[^\]]+\]/gi, "sensitive content")
    .trim();

  return withoutRedacted.length > 0
    ? withoutRedacted
    : "Review the request content.";
}

function buildSafetyNotes(prompt: string, isSensitive: boolean): string[] {
  const notes = [
    "This draft is not auto-submitted; the user must copy and resubmit it manually.",
  ];

  if (isSensitive) {
    notes.push("Sensitive content was represented only after mask redaction.");
  }

  if (/\[REDACTED:[^\]]+\]/i.test(prompt)) {
    notes.push(
      "Sensitive placeholders were not copied into the improvement draft.",
    );
  }

  return notes;
}
