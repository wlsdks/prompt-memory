import type { PromptQualityCriterion } from "../shared/schema.js";
import { redactPrompt } from "../redaction/redact.js";
import { analyzePrompt } from "./analyze.js";

export type ImprovePromptInput = {
  prompt: string;
  createdAt: string;
  language?: "en" | "ko";
  source?: "direct" | "stored";
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

const SECTION_LABELS: Record<
  "en" | "ko",
  Record<PromptQualityCriterion, string>
> = {
  en: {
    goal_clarity: "Goal",
    background_context: "Context",
    scope_limits: "Scope",
    output_format: "Output",
    verification_criteria: "Verification",
  },
  ko: {
    goal_clarity: "목표",
    background_context: "맥락",
    scope_limits: "범위",
    output_format: "출력",
    verification_criteria: "검증",
  },
};

export function improvePrompt(input: ImprovePromptInput): PromptImprovement {
  const redaction = redactPrompt(input.prompt, "mask");
  const sanitizedPrompt = sanitizePrompt(redaction.stored_text);
  const analysis = analyzePrompt({
    prompt: sanitizedPrompt,
    createdAt: input.createdAt,
  });
  const language = input.language ?? "en";
  const source = input.source ?? "direct";
  const changedSections = analysis.checklist
    .filter((item) => item.status !== "good")
    .map((item) => item.key);
  const sections =
    source === "stored"
      ? buildStoredSections(sanitizedPrompt, changedSections, language)
      : buildSections(sanitizedPrompt, changedSections, language);

  return {
    mode: "copy",
    requires_user_approval: true,
    summary: summaryFor(language, changedSections.length === 0),
    improved_prompt: [
      introFor(language),
      "",
      ...sections.flatMap(([label, body]) => [`## ${label}`, body, ""]),
    ]
      .join("\n")
      .trim(),
    changed_sections: changedSections,
    safety_notes: buildSafetyNotes(
      input.prompt,
      redaction.is_sensitive,
      language,
    ),
    created_at: input.createdAt,
    analyzer: "local-rules-v1",
  };
}

function buildStoredSections(
  prompt: string,
  changedSections: PromptQualityCriterion[],
  language: "en" | "ko",
): Array<[string, string]> {
  const changed = new Set(changedSections);
  const labels = SECTION_LABELS[language];
  const copy = language === "ko" ? KO_COPY : EN_COPY;
  const facts = extractPromptFacts(prompt);

  return [
    [
      labels.goal_clarity,
      changed.has("goal_clarity")
        ? copy.goal
        : storedGoalFor(facts.targets, language),
    ],
    [
      labels.background_context,
      changed.has("background_context")
        ? copy.context
        : storedContextFor(facts.targets, language),
    ],
    [
      labels.scope_limits,
      changed.has("scope_limits")
        ? copy.scope
        : storedScopeFor(facts.constraints, language),
    ],
    [
      labels.verification_criteria,
      changed.has("verification_criteria")
        ? copy.verification
        : storedVerificationFor(facts.commands, language),
    ],
    [
      labels.output_format,
      changed.has("output_format")
        ? copy.output
        : storedOutputFor(facts.outputFormat, language),
    ],
    [language === "ko" ? "원문" : "Original prompt", prompt],
  ];
}

function buildSections(
  prompt: string,
  changedSections: PromptQualityCriterion[],
  language: "en" | "ko",
): Array<[string, string]> {
  const changed = new Set(changedSections);
  const labels = SECTION_LABELS[language];
  const copy = language === "ko" ? KO_COPY : EN_COPY;

  return [
    [labels.goal_clarity, changed.has("goal_clarity") ? copy.goal : prompt],
    [
      labels.background_context,
      changed.has("background_context") ? copy.context : copy.keepContext,
    ],
    [
      labels.scope_limits,
      changed.has("scope_limits") ? copy.scope : copy.keepScope,
    ],
    [
      labels.verification_criteria,
      changed.has("verification_criteria")
        ? copy.verification
        : copy.keepVerification,
    ],
    [
      labels.output_format,
      changed.has("output_format") ? copy.output : copy.keepOutput,
    ],
    [language === "ko" ? "원문" : "Original prompt", prompt],
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

type PromptFacts = {
  targets: string[];
  commands: string[];
  constraints: string[];
  outputFormat?: string;
};

function extractPromptFacts(prompt: string): PromptFacts {
  return {
    targets: unique(
      prompt.match(
        /[\w./-]+\.(?:ts|tsx|js|jsx|json|md|yml|yaml|toml|sql|css)\b/giu,
      ) ?? [],
    ).slice(0, 4),
    commands: unique(
      prompt.match(
        /\b(?:pnpm|npm|node|npx|vitest|playwright|tsc|eslint)\s+[^.\n;]+/giu,
      ) ?? [],
    )
      .map((command) => command.trim())
      .slice(0, 3),
    constraints: prompt
      .split(/[.\n]/u)
      .map((part) => part.trim())
      .filter((part) =>
        /\b(?:only|avoid|without|do not|must|must not|scope|scoped|keep|exclude|minimal)\b/iu.test(
          part,
        ),
      )
      .slice(0, 2),
    outputFormat: outputFormatFor(prompt),
  };
}

function outputFormatFor(prompt: string): string | undefined {
  if (/markdown/iu.test(prompt)) return "Markdown summary";
  if (/json/iu.test(prompt)) return "JSON";
  if (/table/iu.test(prompt)) return "table";
  if (/bullet|list/iu.test(prompt)) return "bullet list";
  if (/summary/iu.test(prompt)) return "summary";
  return undefined;
}

function storedGoalFor(targets: string[], language: "en" | "ko"): string {
  if (targets.length === 0) {
    return language === "ko"
      ? "저장된 요청의 실제 대상을 기준으로 기대 동작을 명확히 정리해주세요."
      : "Use the stored request's target and restate the expected behavior clearly.";
  }

  const targetText = targets.join(", ");
  return language === "ko"
    ? `다음 대상을 중심으로 원래 의도를 해결해주세요: ${targetText}.`
    : `Work on the original request around these targets: ${targetText}.`;
}

function storedContextFor(targets: string[], language: "en" | "ko"): string {
  if (targets.length === 0) {
    return language === "ko"
      ? "저장된 요청의 배경과 문제 상황을 먼저 확인한 뒤 진행해주세요."
      : "Review the stored request's background and current problem before changing code.";
  }

  const targetText = targets.join(", ");
  return language === "ko"
    ? `저장된 요청의 배경을 확인하고 ${targetText} 주변의 현재 동작을 먼저 검토해주세요.`
    : `Review the stored request context and inspect the current behavior around ${targetText}.`;
}

function storedScopeFor(constraints: string[], language: "en" | "ko"): string {
  if (constraints.length === 0) {
    return language === "ko"
      ? "저장된 요청에서 암시된 범위를 넘지 말고 관련 없는 리팩터링은 피해주세요."
      : "Stay within the stored request's implied scope and avoid unrelated refactors.";
  }

  const constraintText = constraints.join("; ");
  return language === "ko"
    ? `저장된 요청의 범위 제약을 유지해주세요: ${constraintText}.`
    : `Keep the stored request's scope constraints: ${constraintText}.`;
}

function storedVerificationFor(
  commands: string[],
  language: "en" | "ko",
): string {
  if (commands.length === 0) {
    return language === "ko"
      ? "관련된 가장 좁은 테스트나 검증 명령을 실행하고 결과를 확인해주세요."
      : "Run the narrowest relevant test or verification command and confirm the result.";
  }

  const commandText = commands.join("; ");
  return language === "ko"
    ? `저장된 요청의 검증 명령을 우선 실행해주세요: ${commandText}.`
    : `Run the verification command from the stored request first: ${commandText}.`;
}

function storedOutputFor(
  outputFormat: string | undefined,
  language: "en" | "ko",
): string {
  if (!outputFormat) {
    return language === "ko"
      ? "변경 내용, 검증 결과, 남은 리스크를 짧게 요약해주세요."
      : "Return a concise summary with changes, verification results, and remaining risks.";
  }

  return language === "ko"
    ? `응답 형식은 저장된 요청의 의도를 따라 ${outputFormat}로 맞춰주세요.`
    : `Use the stored request's requested response format: ${outputFormat}.`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function summaryFor(language: "en" | "ko", noChanges: boolean): string {
  if (language === "ko") {
    return noChanges
      ? "원문 의도를 유지하면서 재입력하기 쉬운 실행 형식으로 정리했습니다."
      : "부족한 항목을 보강한 뒤 사용자가 승인해 복사하고 재입력할 수 있게 정리했습니다.";
  }

  return noChanges
    ? "Reformatted the original intent into a clearer request that is easier to reuse."
    : "Filled the missing sections so the user can approve, copy, and resubmit the request manually.";
}

function introFor(language: "en" | "ko"): string {
  return language === "ko"
    ? "다음 요청을 기준으로 작업해주세요."
    : "Please work from the following request.";
}

function buildSafetyNotes(
  prompt: string,
  isSensitive: boolean,
  language: "en" | "ko",
): string[] {
  const notes = [
    language === "ko"
      ? "개선안은 자동 제출되지 않으며 사용자가 복사해 재입력해야 합니다."
      : "This draft is not auto-submitted; the user must copy and resubmit it manually.",
  ];

  if (isSensitive) {
    notes.push(
      language === "ko"
        ? "민감정보는 mask redaction 후 개선안에 반영했습니다."
        : "Sensitive content was represented only after mask redaction.",
    );
  }

  if (/\[REDACTED:[^\]]+\]/i.test(prompt)) {
    notes.push(
      language === "ko"
        ? "민감정보 placeholder는 개선안에 포함하지 않았습니다."
        : "Sensitive placeholders were not copied into the improvement draft.",
    );
  }

  return notes;
}

const EN_COPY = {
  goal: "Confirm the original intent, then state the exact target and expected behavior.",
  context:
    "Review the current state and the problem background using the code and test results.",
  keepContext:
    "Preserve the background and constraints from the original request.",
  scope:
    "Change only the minimum area needed for the request and avoid unrelated refactors or behavior changes.",
  keepScope: "Keep the scope and constraints stated in the original request.",
  verification:
    "Run the narrowest relevant tests first, then lint/build checks if needed.",
  keepVerification:
    "Use the verification commands and expected results from the original request.",
  output:
    "Return a concise Markdown summary with changes, verification results, and remaining risks.",
  keepOutput: "Keep the output format requested in the original prompt.",
};

const KO_COPY = {
  goal: "원문의 의도를 먼저 확인하고, 실제로 수정해야 할 대상과 기대 동작을 명확히 정리해주세요.",
  context:
    "현재 상태와 문제가 발생한 배경을 코드와 테스트 결과를 기준으로 확인한 뒤 진행해주세요.",
  keepContext: "원문에 포함된 배경과 제약을 유지해주세요.",
  scope:
    "요청 해결에 필요한 최소 범위만 수정하고, 관련 없는 리팩터링이나 동작 변경은 피해주세요.",
  keepScope: "원문에 명시된 범위와 제약을 지켜주세요.",
  verification:
    "가능한 가장 좁은 관련 테스트부터 실행하고, 필요하면 lint/build 같은 기본 검증까지 확인해주세요.",
  keepVerification:
    "원문에 명시된 검증 명령과 기대 결과를 기준으로 완료 여부를 판단해주세요.",
  output:
    "변경 내용, 검증 결과, 남은 리스크를 짧은 Markdown 요약으로 알려주세요.",
  keepOutput: "원문에서 요청한 출력 형식을 유지해주세요.",
};
