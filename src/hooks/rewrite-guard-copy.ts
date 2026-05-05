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
    askHeader: "[prompt-memory coach]",
    askIntro: (score: number, band: string, axesLabel: string) =>
      `The user's prompt scored ${score}/100 (${band}). Missing axes: ${axesLabel}.`,
    askInstruction:
      "BEFORE answering the user's request, call the AskUserQuestion tool with the questions below to gather the missing details. Wait for the user's answers, then answer the original prompt using their verbatim answers as scope.",
    askInstructionCodex:
      "BEFORE answering the user's request, call the prompt-memory `ask_clarifying_questions` MCP tool with the original prompt to gather the missing details (the tool will use elicitation/create or the native dialog fallback). Wait for the user's answers, then answer the original prompt using their verbatim answers as scope.",
    askQuestionsHeader: "Questions to ask via AskUserQuestion:",
    askFooter:
      "Do not answer the prompt directly without first asking these clarifying questions.",
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
    askHeader: "[prompt-memory coach]",
    askIntro: (score: number, band: string, axesLabel: string) =>
      `사용자 프롬프트의 로컬 점수가 ${score}/100 (${band})이고 누락된 축: ${axesLabel}.`,
    askInstruction:
      "원 요청에 답하기 전에, 반드시 AskUserQuestion 툴을 아래 질문들로 호출해 사용자의 답을 받으세요. 답을 받은 뒤에 그 답을 작업 범위로 사용해 원 프롬프트에 응답하세요.",
    askInstructionCodex:
      "원 요청에 답하기 전에, 반드시 prompt-memory의 `ask_clarifying_questions` MCP 툴을 원 프롬프트와 함께 호출해 사용자의 답을 받으세요 (툴이 elicitation/create 또는 네이티브 대화상자 fallback으로 처리). 답을 받은 뒤에 그 답을 작업 범위로 사용해 원 프롬프트에 응답하세요.",
    askQuestionsHeader: "AskUserQuestion으로 물어볼 질문:",
    askFooter:
      "이 명확화 질문들을 먼저 묻지 않고 원 요청에 직접 답하지 마세요.",
  },
} as const;
