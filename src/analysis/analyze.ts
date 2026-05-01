import type { PromptAnalysisPreview } from "../shared/schema.js";

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
    suggestions.push("응답 형식, 포함할 항목, 제외할 항목을 명시해보세요.");
  }

  if (!signals.hasVerification) {
    warnings.push("완료 기준이나 검증 방법이 없습니다.");
    suggestions.push(
      "실행할 테스트, 확인할 화면, 성공 조건을 함께 적어보세요.",
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
    analyzer: LOCAL_RULES_ANALYZER,
    created_at: input.createdAt,
  };
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
