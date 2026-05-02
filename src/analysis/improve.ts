import type { PromptQualityCriterion } from "../shared/schema.js";
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
  goal_clarity: "목표",
  background_context: "맥락",
  scope_limits: "범위",
  output_format: "출력",
  verification_criteria: "검증",
};

export function improvePrompt(input: ImprovePromptInput): PromptImprovement {
  const sanitizedPrompt = sanitizePrompt(input.prompt);
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
        ? "원문 의도를 유지하면서 재입력하기 쉬운 실행 형식으로 정리했습니다."
        : "부족한 항목을 보강한 뒤 사용자가 승인해 복사하고 재입력할 수 있게 정리했습니다.",
    improved_prompt: [
      "다음 요청을 기준으로 작업해주세요.",
      "",
      ...sections.flatMap(([label, body]) => [`## ${label}`, body, ""]),
    ]
      .join("\n")
      .trim(),
    changed_sections: changedSections,
    safety_notes: buildSafetyNotes(input.prompt),
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
        ? "원문의 의도를 먼저 확인하고, 실제로 수정해야 할 대상과 기대 동작을 명확히 정리해주세요."
        : prompt,
    ],
    [
      SECTION_LABELS.background_context,
      changed.has("background_context")
        ? "현재 상태와 문제가 발생한 배경을 코드와 테스트 결과를 기준으로 확인한 뒤 진행해주세요."
        : "원문에 포함된 배경과 제약을 유지해주세요.",
    ],
    [
      SECTION_LABELS.scope_limits,
      changed.has("scope_limits")
        ? "요청 해결에 필요한 최소 범위만 수정하고, 관련 없는 리팩터링이나 동작 변경은 피해주세요."
        : "원문에 명시된 범위와 제약을 지켜주세요.",
    ],
    [
      SECTION_LABELS.verification_criteria,
      changed.has("verification_criteria")
        ? "가능한 가장 좁은 관련 테스트부터 실행하고, 필요하면 lint/build 같은 기본 검증까지 확인해주세요."
        : "원문에 명시된 검증 명령과 기대 결과를 기준으로 완료 여부를 판단해주세요.",
    ],
    [
      SECTION_LABELS.output_format,
      changed.has("output_format")
        ? "변경 내용, 검증 결과, 남은 리스크를 짧은 Markdown 요약으로 알려주세요."
        : "원문에서 요청한 출력 형식을 유지해주세요.",
    ],
    ["원문", prompt],
  ];
}

function sanitizePrompt(prompt: string): string {
  const withoutRedacted = prompt
    .replace(/\[REDACTED:[^\]]+\]/gi, "민감정보")
    .trim();

  return withoutRedacted.length > 0
    ? withoutRedacted
    : "요청 내용을 확인해주세요.";
}

function buildSafetyNotes(prompt: string): string[] {
  const notes = [
    "개선안은 자동 제출되지 않으며 사용자가 복사해 재입력해야 합니다.",
  ];

  if (/\[REDACTED:[^\]]+\]/i.test(prompt)) {
    notes.push("민감정보 placeholder는 개선안에 포함하지 않았습니다.");
  }

  return notes;
}
