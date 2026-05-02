import type {
  PromptAnalysisPreview,
  PromptQualityChecklistItem,
  PromptQualityCriterion,
  PromptQualityStatus,
  PromptTag,
} from "../shared/schema.js";

export const LOCAL_RULES_ANALYZER = "local-rules-v1";

export type AnalyzePromptInput = {
  prompt: string;
  createdAt: string;
};

export function analyzePrompt(
  input: AnalyzePromptInput,
): PromptAnalysisPreview {
  const text = input.prompt.trim();
  const signals = {
    hasContext: hasContext(text),
    hasSpecificTarget: hasSpecificTarget(text),
    hasOutputFormat: hasOutputFormat(text),
    hasVerification: hasVerification(text),
    hasConstraints: hasConstraints(text),
  };
  const signalCount = Object.values(signals).filter(Boolean).length;
  const checklist = buildChecklist(text, signals);
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (text.length < 30 || (!signals.hasContext && !signals.hasSpecificTarget)) {
    warnings.push("The target or background context is missing.");
    suggestions.push(
      "Add the target file, command, error message, and expected behavior.",
    );
  }

  if (!signals.hasOutputFormat) {
    warnings.push("The desired output format is unclear.");
    suggestions.push(
      "Add an output format: specify the response structure and required fields.",
    );
  }

  if (!signals.hasVerification) {
    warnings.push("Completion criteria or verification steps are missing.");
    suggestions.push(
      "Add verification criteria: list the tests to run and the expected result.",
    );
  }

  if (!signals.hasConstraints || isBroadRequest(text)) {
    warnings.push(
      "The work scope or constraints could be interpreted too broadly.",
    );
    suggestions.push(
      "State what may be changed and what should stay untouched.",
    );
  }

  if (containsRedactedPlaceholder(text)) {
    warnings.push(
      "Sensitive content was masked, so analysis may be less precise.",
    );
  }

  return {
    summary: summarize(text, signalCount),
    warnings: unique(warnings).slice(0, 5),
    suggestions: unique(suggestions).slice(0, 4),
    checklist,
    tags: extractTags(text),
    analyzer: LOCAL_RULES_ANALYZER,
    created_at: input.createdAt,
  };
}

type PromptSignals = {
  hasContext: boolean;
  hasSpecificTarget: boolean;
  hasOutputFormat: boolean;
  hasVerification: boolean;
  hasConstraints: boolean;
};

function buildChecklist(
  text: string,
  signals: PromptSignals,
): PromptQualityChecklistItem[] {
  return [
    checklistItem(
      "goal_clarity",
      "Goal clarity",
      statusForGoal(text, signals),
      {
        good: "The task and target are clear.",
        weak: "The intent is visible, but the target or expected behavior could be clearer.",
        missing: "The goal is too vague to know what should change.",
      },
      "Add a goal: describe the target and expected behavior in one sentence.",
    ),
    checklistItem(
      "background_context",
      "Background context",
      signals.hasContext
        ? "good"
        : signals.hasSpecificTarget
          ? "weak"
          : "missing",
      {
        good: "The prompt includes current state or problem background.",
        weak: "The target is present, but the reason for the work is thin.",
        missing: "Current state, error details, or background are missing.",
      },
      "Add context: include current state, relevant logs, and why the change is needed.",
    ),
    checklistItem(
      "scope_limits",
      "Scope limits",
      signals.hasConstraints
        ? "good"
        : isBroadRequest(text)
          ? "missing"
          : "weak",
      {
        good: "The allowed scope or constraints are visible.",
        weak: "The task seems narrow, but the editable area is not explicit.",
        missing: "A broad request has no scope boundary.",
      },
      "Add scope: name files or areas that may be changed and areas to exclude.",
    ),
    checklistItem(
      "output_format",
      "Output format",
      signals.hasOutputFormat ? "good" : "missing",
      {
        good: "The desired response format is included.",
        weak: "The response format is only partially implied.",
        missing: "It is unclear what shape the result should take.",
      },
      "Add an output format: summary, bullets, table, JSON, or another required structure.",
    ),
    checklistItem(
      "verification_criteria",
      "Verification criteria",
      signals.hasVerification ? "good" : "missing",
      {
        good: "The prompt includes tests or checks.",
        weak: "A verification direction exists, but success criteria are vague.",
        missing: "There is no verification criterion for deciding done.",
      },
      "Add verification criteria: list the tests to run and the expected result.",
    ),
  ];
}

function checklistItem(
  key: PromptQualityCriterion,
  label: string,
  status: PromptQualityStatus,
  reasons: Record<PromptQualityStatus, string>,
  suggestion: string,
): PromptQualityChecklistItem {
  return {
    key,
    label,
    status,
    reason: reasons[status],
    ...(status === "good" ? {} : { suggestion }),
  };
}

function statusForGoal(
  text: string,
  signals: PromptSignals,
): PromptQualityStatus {
  if (signals.hasSpecificTarget && text.length >= 30) {
    return "good";
  }

  if (signals.hasSpecificTarget || text.length >= 30) {
    return "weak";
  }

  return "missing";
}

function extractTags(text: string): PromptTag[] {
  const normalized = text.toLowerCase();
  const tags: PromptTag[] = [];
  const rules: Array<[PromptTag, RegExp]> = [
    ["bugfix", /bug|fix|error|exception/iu],
    ["refactor", /refactor|cleanup|structure/iu],
    ["docs", /docs?|readme|markdown|guide/iu],
    ["test", /test|vitest|playwright|verify|coverage/iu],
    ["ui", /ui|ux|react|tsx|css|screen|button|layout|browser/iu],
    ["backend", /api|server|route|fastify|cli|storage|queue|worker|backend/iu],
    [
      "security",
      /csrf|xss|auth|token|secret|redaction|cross-site|permission/iu,
    ],
    ["db", /sqlite|database|sql|migration|fts|index|db/iu],
    ["release", /release|pack|publish|version|npm/iu],
    ["ops", /doctor|health|status|monitor|diagnostic/iu],
  ];

  for (const [tag, pattern] of rules) {
    if (pattern.test(normalized)) {
      tags.push(tag);
    }
  }

  return unique(tags);
}

function summarize(text: string, signalCount: number): string {
  if (text.length < 30) {
    return "This is a short request; the intent is visible, but execution criteria are thin.";
  }

  if (signalCount >= 4) {
    return "The target and verification criteria are relatively clear.";
  }

  if (signalCount >= 2) {
    return "The goal is visible, but context, constraints, or completion criteria could be clearer.";
  }

  return "The request has intent, but the target and success criteria are open to broad interpretation.";
}

function hasContext(text: string): boolean {
  return /because|current|existing|error|problem|background|context|when|while|log|cause/i.test(
    text,
  );
}

function hasSpecificTarget(text: string): boolean {
  return /[\w./-]+\.(ts|tsx|js|jsx|json|md|yml|yaml|toml|sql|css)\b|pnpm|npm|node|vitest|playwright|api|ui|cli|server|storage|database|sqlite|file|screen|test|command/i.test(
    text,
  );
}

function hasOutputFormat(text: string): boolean {
  return /markdown|json|table|list|bullet|summary|format|return|response|output/i.test(
    text,
  );
}

function hasVerification(text: string): boolean {
  return /test|tests|vitest|playwright|verify|check|pass|run|success|acceptance|build|lint/i.test(
    text,
  );
}

function hasConstraints(text: string): boolean {
  return /only|avoid|without|do not|must|must not|concise|exclude|scope|constraint|required|forbid|minimal|unchanged/i.test(
    text,
  );
}

function isBroadRequest(text: string): boolean {
  return /fix|improve|optimize|refactor|make better|clean up/i.test(text);
}

function containsRedactedPlaceholder(text: string): boolean {
  return /\[REDACTED:[^\]]+\]/i.test(text);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
