export const HOOK_COPY = {
  en: {
    contextHeader: "prompt-coach rewrite guidance",
    contextHint:
      "Use this improved request as the working brief when it is clearer than the submitted prompt.",
    scoreLine: (score: number, band: string) =>
      `Original local score: ${score}/100 (${band})`,
    blockedReason: (score: number, band: string, minScore: number) =>
      `prompt-coach blocked this prompt before submission because its local score was ${score}/100 (${band}), below the configured threshold ${minScore}.`,
    clipboardHit:
      "An improved prompt was copied to your clipboard. Paste it and press Enter to resubmit.",
    clipboardMiss:
      "Copy the improved prompt below, paste it, and press Enter to resubmit.",
    improvedHeader: "Improved prompt:",
    safetyHeader: "Safety notes:",
    askHeader: "[prompt-coach coach]",
    askIntro: (score: number, band: string, axesLabel: string) =>
      `The user's prompt scored ${score}/100 (${band}). Missing axes: ${axesLabel}.`,
    askInstruction:
      "BEFORE answering the user's request, ask the user the clarifying questions below and wait for the user's reply. Prefer calling the native AskUserQuestion tool with these questions when it is available. If AskUserQuestion is not available in this session, just ask the questions verbatim in your reply and stop — do not start any work or write any files until the user answers. Once you have the user's verbatim answers, answer the original prompt using them as scope.",
    askInstructionCodex:
      "BEFORE answering the user's request, ask the user the clarifying questions below and wait for the user's reply in chat. If the prompt-coach `ask_clarifying_questions` MCP tool is registered for this session, prefer calling it with the original prompt and `allow_native_dialog: true` (the tool will use elicitation/create or fall back to a native OS dialog). If that MCP tool is not available, just ask the questions verbatim in your reply and stop — do not start any work or write any files until the user answers. Once you have the user's verbatim answers, answer the original prompt using them as scope.",
    askQuestionsHeader: "Clarifying questions to relay to the user:",
    askFooter:
      "Do not answer the prompt directly without first asking these clarifying questions and waiting for the user's reply.",
  },
  ko: {
    contextHeader: "prompt-coach 개선안 가이드",
    contextHint:
      "원래 프롬프트보다 명확한 경우 아래 개선안을 작업 brief로 사용해주세요.",
    scoreLine: (score: number, band: string) =>
      `원래 로컬 점수: ${score}/100 (${band})`,
    blockedReason: (score: number, band: string, minScore: number) =>
      `prompt-coach가 이 프롬프트를 제출 전 차단했습니다. 로컬 점수 ${score}/100 (${band})가 설정된 기준 ${minScore} 미만입니다.`,
    clipboardHit:
      "개선된 프롬프트를 클립보드에 복사했습니다. 붙여넣고 Enter로 재제출해주세요.",
    clipboardMiss:
      "아래 개선된 프롬프트를 직접 복사해 붙여넣고 Enter로 재제출해주세요.",
    improvedHeader: "개선된 프롬프트:",
    safetyHeader: "주의사항:",
    askHeader: "[prompt-coach coach]",
    askIntro: (score: number, band: string, axesLabel: string) =>
      `사용자 프롬프트의 로컬 점수가 ${score}/100 (${band})이고 누락된 축: ${axesLabel}.`,
    askInstruction:
      "원 요청에 답하기 전에, 반드시 사용자에게 아래 명확화 질문을 묻고 답을 받으세요. 이번 세션에서 AskUserQuestion 툴이 사용 가능하면 그 툴을 우선 호출하세요. 사용 불가하면 응답에서 질문을 그대로 묻고 멈추세요 — 사용자가 답하기 전에는 어떤 작업/파일 수정도 하지 마세요. 사용자의 답을 받은 뒤에 그 답을 작업 범위로 사용해 원 프롬프트에 응답하세요.",
    askInstructionCodex:
      "원 요청에 답하기 전에, 반드시 사용자에게 아래 명확화 질문을 묻고 답을 채팅으로 받으세요. prompt-coach의 `ask_clarifying_questions` MCP 툴이 이번 세션에 등록되어 있으면 원 프롬프트와 함께 `allow_native_dialog: true`로 호출하는 것을 우선합니다 (툴이 elicitation/create 또는 네이티브 OS 대화상자 fallback으로 처리). MCP 툴이 사용 불가하면 응답에서 질문을 그대로 묻고 멈추세요 — 사용자가 답하기 전에는 어떤 작업/파일 수정도 하지 마세요. 사용자의 답을 받은 뒤에 그 답을 작업 범위로 사용해 원 프롬프트에 응답하세요.",
    askQuestionsHeader: "사용자에게 전달할 명확화 질문:",
    askFooter:
      "이 명확화 질문들을 먼저 묻고 사용자의 답을 받기 전에는 원 요청에 직접 답하지 마세요.",
  },
} as const;
