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
    warnings.push("작업 대상이나 배경 맥락이 부족합니다.");
    suggestions.push(
      "대상 파일, 명령, 에러 메시지, 현재 기대 동작을 함께 적어보세요.",
    );
  }

  if (!signals.hasOutputFormat) {
    warnings.push("원하는 출력 형식이 명확하지 않습니다.");
    suggestions.push(
      "출력 형식을 추가하세요: 원하는 응답 구조와 포함할 항목을 적어주세요.",
    );
  }

  if (!signals.hasVerification) {
    warnings.push("완료 기준이나 검증 방법이 없습니다.");
    suggestions.push(
      "검증 기준을 추가하세요: 실행할 테스트와 기대 결과를 적어주세요.",
    );
  }

  if (!signals.hasConstraints || isBroadRequest(text)) {
    warnings.push("작업 범위나 제약조건이 넓게 해석될 수 있습니다.");
    suggestions.push(
      "변경해도 되는 범위와 건드리지 말아야 할 범위를 적어보세요.",
    );
  }

  if (containsRedactedPlaceholder(text)) {
    warnings.push("민감정보가 마스킹되어 분석 정확도가 제한될 수 있습니다.");
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
      "목표 명확성",
      statusForGoal(text, signals),
      {
        good: "수행할 작업과 대상이 드러납니다.",
        weak: "의도는 보이지만 대상이나 기대 동작이 더 구체적일 수 있습니다.",
        missing: "무엇을 바꿀지 판단할 목표가 부족합니다.",
      },
      "목표를 추가하세요: 바꿀 대상과 기대 동작을 한 문장으로 적어주세요.",
    ),
    checklistItem(
      "background_context",
      "배경 맥락",
      signals.hasContext
        ? "good"
        : signals.hasSpecificTarget
          ? "weak"
          : "missing",
      {
        good: "현재 상황이나 문제 배경이 포함되어 있습니다.",
        weak: "대상은 있으나 왜 필요한 작업인지 맥락이 적습니다.",
        missing: "현재 상태, 에러, 배경 설명이 부족합니다.",
      },
      "맥락을 추가하세요: 현재 상태, 관련 로그, 왜 필요한 변경인지 적어주세요.",
    ),
    checklistItem(
      "scope_limits",
      "범위 제한",
      signals.hasConstraints
        ? "good"
        : isBroadRequest(text)
          ? "missing"
          : "weak",
      {
        good: "변경 범위나 제약 조건이 드러납니다.",
        weak: "작업은 좁아 보이지만 건드릴 범위가 명확하지 않습니다.",
        missing: "넓게 해석될 수 있는 요청에 범위 제한이 없습니다.",
      },
      "범위를 추가하세요: 수정해도 되는 파일과 제외할 영역을 적어주세요.",
    ),
    checklistItem(
      "output_format",
      "출력 형식",
      signals.hasOutputFormat ? "good" : "missing",
      {
        good: "원하는 응답 형식이 포함되어 있습니다.",
        weak: "응답 형식이 일부만 드러납니다.",
        missing: "결과를 어떤 형태로 받을지 알기 어렵습니다.",
      },
      "출력 형식을 추가하세요: 요약, 목록, 표, JSON 등 원하는 구조를 적어주세요.",
    ),
    checklistItem(
      "verification_criteria",
      "검증 기준",
      signals.hasVerification ? "good" : "missing",
      {
        good: "테스트나 확인 방법이 포함되어 있습니다.",
        weak: "검증 방향은 있으나 성공 조건이 모호합니다.",
        missing: "완료 여부를 판단할 검증 기준이 없습니다.",
      },
      "검증 기준을 추가하세요: 실행할 테스트와 기대 결과를 적어주세요.",
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
    ["bugfix", /bug|fix|error|exception|오류|에러|버그|고쳐|수정/iu],
    ["refactor", /refactor|cleanup|structure|리팩터|정리|구조/iu],
    ["docs", /docs?|readme|markdown|문서|가이드/iu],
    ["test", /test|vitest|playwright|검증|테스트|coverage/iu],
    ["ui", /ui|ux|react|tsx|css|화면|버튼|레이아웃|브라우저/iu],
    [
      "backend",
      /api|server|route|fastify|cli|storage|queue|worker|backend|서버|백엔드/iu,
    ],
    [
      "security",
      /csrf|xss|auth|token|secret|redaction|cross-site|보안|권한|인증/iu,
    ],
    ["db", /sqlite|database|sql|migration|fts|index|db|데이터베이스/iu],
    ["release", /release|pack|publish|version|npm|배포|릴리스/iu],
    ["ops", /doctor|health|status|monitor|운영|관리|진단/iu],
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
    return "짧은 요청이라 의도 확인에는 좋지만 실행 기준이 부족합니다.";
  }

  if (signalCount >= 4) {
    return "구체적인 대상과 검증 기준이 비교적 잘 드러난 요청입니다.";
  }

  if (signalCount >= 2) {
    return "목표는 보이지만 맥락, 제약, 완료 기준을 더 구체화할 수 있습니다.";
  }

  return "요청 의도는 있으나 작업 대상과 성공 기준이 넓게 해석될 수 있습니다.";
}

function hasContext(text: string): boolean {
  return /because|현재|기존|에러|오류|문제|배경|context|when|while|로그|원인/i.test(
    text,
  );
}

function hasSpecificTarget(text: string): boolean {
  return /[\w./-]+\.(ts|tsx|js|jsx|json|md|yml|yaml|toml|sql|css)\b|pnpm|npm|node|vitest|playwright|api|ui|cli|server|storage|database|sqlite|파일|화면|서버|테스트|명령/i.test(
    text,
  );
}

function hasOutputFormat(text: string): boolean {
  return /markdown|json|table|표|목록|불릿|bullet|summary|요약|형식|format|return|응답|출력/i.test(
    text,
  );
}

function hasVerification(text: string): boolean {
  return /test|tests|vitest|playwright|검증|확인|통과|실행|성공|완료 기준|acceptance|build|lint/i.test(
    text,
  );
}

function hasConstraints(text: string): boolean {
  return /only|avoid|without|do not|must|must not|concise|제외|하지|말고|범위|제약|필수|금지|최소|간결|그대로/i.test(
    text,
  );
}

function isBroadRequest(text: string): boolean {
  return /좋게|개선|고쳐|수정|fix|improve|optimize|refactor/i.test(text);
}

function containsRedactedPlaceholder(text: string): boolean {
  return /\[REDACTED:[^\]]+\]/i.test(text);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
