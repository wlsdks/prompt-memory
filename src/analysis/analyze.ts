import type {
  PromptAnalysisPreview,
  PromptQualityChecklistItem,
  PromptQualityCriterion,
  PromptQualityScore,
  PromptQualityScoreBand,
  PromptQualityStatus,
  PromptTag,
} from "../shared/schema.js";

export const LOCAL_RULES_ANALYZER = "local-rules-v1";

export const EXPERIMENTAL_RULE_IDS = ["verification_v2"] as const;
export type ExperimentalRuleId = (typeof EXPERIMENTAL_RULE_IDS)[number];

export function isExperimentalRuleId(
  value: string,
): value is ExperimentalRuleId {
  return (EXPERIMENTAL_RULE_IDS as readonly string[]).includes(value);
}

export type AnalyzePromptInput = {
  prompt: string;
  createdAt: string;
  experimentalRules?: readonly ExperimentalRuleId[];
};

const QUALITY_SCORE_MAX = 100;
const QUALITY_SCORE_WEIGHTS = {
  goal_clarity: 25,
  background_context: 20,
  scope_limits: 20,
  output_format: 15,
  verification_criteria: 20,
} satisfies Record<PromptQualityCriterion, number>;

export function analyzePrompt(
  input: AnalyzePromptInput,
): PromptAnalysisPreview {
  const text = input.prompt.trim();
  const experimental = input.experimentalRules ?? [];
  const signals = {
    hasContext: hasContext(text),
    hasSpecificTarget: hasSpecificTarget(text),
    hasOutputFormat: hasOutputFormat(text),
    hasVerification: hasVerification(text, experimental),
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
    quality_score: calculatePromptQualityScore(checklist),
    analyzer: LOCAL_RULES_ANALYZER,
    created_at: input.createdAt,
  };
}

export function calculatePromptQualityScore(
  checklist: PromptQualityChecklistItem[],
): PromptQualityScore {
  const breakdown = checklist.map((item) => {
    const weight = QUALITY_SCORE_WEIGHTS[item.key];
    return {
      key: item.key,
      label: item.label,
      status: item.status,
      weight,
      earned: Math.round(weight * statusMultiplier(item.status)),
    };
  });
  const value = Math.min(
    QUALITY_SCORE_MAX,
    Math.max(
      0,
      breakdown.reduce((total, item) => total + item.earned, 0),
    ),
  );

  return {
    value,
    max: QUALITY_SCORE_MAX,
    band: qualityScoreBand(value),
    breakdown,
  };
}

export function qualityScoreBand(value: number): PromptQualityScoreBand {
  if (value >= 85) return "excellent";
  if (value >= 60) return "good";
  if (value >= 40) return "needs_work";
  return "weak";
}

function statusMultiplier(status: PromptQualityStatus): number {
  if (status === "good") return 1;
  if (status === "weak") return 0.5;
  return 0;
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
    ["bugfix", /bug|fix|error|exception|버그|수정|에러|오류/iu],
    ["refactor", /refactor|cleanup|structure|리팩터|리팩토링|정리|구조/iu],
    ["docs", /docs?|readme|markdown|guide|문서|리드미|가이드|마크다운/iu],
    ["test", /test|vitest|playwright|verify|coverage|테스트|검증/iu],
    [
      "ui",
      /ui|ux|react|tsx|css|screen|button|layout|browser|화면|버튼|레이아웃|브라우저/iu,
    ],
    [
      "backend",
      /api|server|route|fastify|cli|storage|queue|worker|backend|서버|라우트|스토리지|큐|워커/iu,
    ],
    [
      "security",
      /csrf|xss|auth|token|secret|redaction|cross-site|permission|권한|인증|토큰|비밀|마스킹/iu,
    ],
    [
      "db",
      /sqlite|database|sql|migration|fts|index|db|데이터베이스|마이그레이션|인덱스/iu,
    ],
    ["release", /release|pack|publish|version|npm|배포|릴리스|퍼블리시/iu],
    ["ops", /doctor|health|status|monitor|diagnostic|헬스|상태|진단/iu],
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
  return /because|current|existing|error|problem|background|context|when|while|log|cause|현재|기존|에러|오류|문제|배경|컨텍스트|원인|이유|상황/i.test(
    text,
  );
}

function hasSpecificTarget(text: string): boolean {
  return /[\w./-]+\.(ts|tsx|js|jsx|json|md|yml|yaml|toml|sql|css)\b|pnpm|npm|node|vitest|playwright|api|ui|cli|server|storage|database|sqlite|file|screen|test|command|파일|화면|명령|함수|모듈|컴포넌트|라우트|서버|스토리지/i.test(
    text,
  );
}

function hasOutputFormat(text: string): boolean {
  return /markdown|json|table|list|bullet|summary|format|return|response|output|마크다운|표|목록|리스트|요약|형식|응답|출력|구조/i.test(
    text,
  );
}

function hasVerification(
  text: string,
  experimental: readonly ExperimentalRuleId[],
): boolean {
  if (
    /test|tests|vitest|playwright|verify|check|pass|run|success|acceptance|build|lint|테스트|검증|확인|통과|성공|빌드|점검/i.test(
      text,
    )
  ) {
    return true;
  }
  if (experimental.includes("verification_v2")) {
    return /\bassert\b|\bexpect\b|\bspec\b|\bbehavior\b|\bscenario\b|given\s+when\s+then|toBe\b|toEqual\b|toMatch\b|시나리오|행위|행동/i.test(
      text,
    );
  }
  return false;
}

function hasConstraints(text: string): boolean {
  return /only|avoid|without|do not|must|must not|concise|exclude|scope|constraint|required|forbid|minimal|unchanged|유지|제외|범위|필수|변경하지|건드리지|남기고|변경 없이/i.test(
    text,
  );
}

function isBroadRequest(text: string): boolean {
  return /fix|improve|optimize|refactor|make better|clean up|수정|개선|리팩터|리팩토링|정리|최적화/i.test(
    text,
  );
}

function containsRedactedPlaceholder(text: string): boolean {
  return /\[REDACTED:[^\]]+\]/i.test(text);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
