export const HOOK_COPY = {
  en: {
    contextHeader: "prompt-memory rewrite guidance",
    contextHint:
      "Use this improved request as the working brief when it is clearer than the submitted prompt.",
    scoreLine: (score: number, band: string) =>
      `Original local score: ${score}/100 (${band})`,
    blockedReason: (score: number, band: string, minScore: number) =>
      `prompt-memory blocked this prompt before submission because its local score was ${score}/100 (${band}), below the configured threshold ${minScore}.`,
    clipboardHit:
      "An improved prompt was copied to your clipboard. Paste it and press Enter to resubmit.",
    clipboardMiss:
      "Copy the improved prompt below, paste it, and press Enter to resubmit.",
    improvedHeader: "Improved prompt:",
    safetyHeader: "Safety notes:",
  },
  ko: {
    contextHeader: "prompt-memory 개선안 가이드",
    contextHint:
      "원래 프롬프트보다 명확한 경우 아래 개선안을 작업 brief로 사용해주세요.",
    scoreLine: (score: number, band: string) =>
      `원래 로컬 점수: ${score}/100 (${band})`,
    blockedReason: (score: number, band: string, minScore: number) =>
      `prompt-memory가 이 프롬프트를 제출 전 차단했습니다. 로컬 점수 ${score}/100 (${band})가 설정된 기준 ${minScore} 미만입니다.`,
    clipboardHit:
      "개선된 프롬프트를 클립보드에 복사했습니다. 붙여넣고 Enter로 재제출해주세요.",
    clipboardMiss:
      "아래 개선된 프롬프트를 직접 복사해 붙여넣고 Enter로 재제출해주세요.",
    improvedHeader: "개선된 프롬프트:",
    safetyHeader: "주의사항:",
  },
} as const;
