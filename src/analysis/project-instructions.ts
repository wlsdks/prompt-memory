import { createHash } from "node:crypto";

import type { PromptQualityScoreBand } from "../shared/schema.js";
import type {
  ProjectInstructionChecklistItem,
  ProjectInstructionFileSnapshot,
  ProjectInstructionReview,
} from "../storage/ports.js";

export const PROJECT_INSTRUCTION_FILENAMES = [
  "AGENTS.md",
  "CLAUDE.md",
  "agents.md",
  "claude.md",
] as const;

export type ProjectInstructionSourceFile = {
  file_name: string;
  content: string;
  bytes: number;
  modified_at: string;
  truncated: boolean;
};

const CRITERIA: Array<{
  key: ProjectInstructionChecklistItem["key"];
  label: string;
  weight: number;
  good: RegExp[];
  weak: RegExp[];
  missingSuggestion: string;
  weakSuggestion: string;
}> = [
  {
    key: "project_context",
    label: "Project context",
    weight: 20,
    good: [
      /project|product|purpose|goal|stack|architecture|local-first|developer tool/i,
      /프로젝트|제품|목표|스택|아키텍처|로컬|개발자 도구/i,
    ],
    weak: [/overview|summary|context|개요|요약|맥락/i],
    missingSuggestion:
      "Add a short project summary, stack, and the product identity agents must preserve.",
    weakSuggestion:
      "Make the project context more concrete: product goal, stack, and key boundaries.",
  },
  {
    key: "agent_workflow",
    label: "Agent workflow",
    weight: 20,
    good: [
      /plan|todo|task|commit|push|branch|do not revert|worktree/i,
      /계획|작업|커밋|푸시|브랜치|되돌리지|작업트리/i,
    ],
    weak: [/workflow|process|rule|규칙|방식/i],
    missingSuggestion:
      "Document how agents should plan, edit, commit, and avoid reverting user changes.",
    weakSuggestion:
      "Clarify the expected agent workflow: planning, task tracking, commit cadence, and git safety.",
  },
  {
    key: "verification",
    label: "Verification",
    weight: 20,
    good: [
      /pnpm (test|lint|build)|npm (test|run)|vitest|playwright|e2e|smoke/i,
      /테스트|검증|빌드|브라우저|스모크/i,
    ],
    weak: [/test|check|verify|qa/i],
    missingSuggestion:
      "List the exact verification commands agents must run after code or UI changes.",
    weakSuggestion:
      "Replace broad verification wording with concrete commands and when to run each one.",
  },
  {
    key: "privacy_safety",
    label: "Privacy and safety",
    weight: 20,
    good: [
      /secret|token|privacy|redact|sensitive|stdout|stderr|prompt body|raw path/i,
      /비밀|토큰|개인정보|민감|마스킹|원문|절대경로|노출/i,
    ],
    weak: [/safe|security|보안|안전/i],
    missingSuggestion:
      "Add rules for secrets, prompt bodies, raw paths, logs, and local-only storage boundaries.",
    weakSuggestion:
      "Make privacy rules operational: what must never be logged, returned, or committed.",
  },
  {
    key: "collaboration_output",
    label: "Collaboration and output",
    weight: 20,
    good: [
      /response|summary|final|language|Korean|English|Markdown|explain|report/i,
      /응답|한국어|영어|요약|보고|설명|최종|문서/i,
    ],
    weak: [/communicat|collaborat|협업|말투/i],
    missingSuggestion:
      "Specify response language, reporting shape, and what evidence agents should include.",
    weakSuggestion:
      "Clarify how agents should report work, verification evidence, and remaining risks.",
  },
];

export function analyzeProjectInstructionFiles(
  files: ProjectInstructionSourceFile[],
  generatedAt: string,
): ProjectInstructionReview {
  const combined = files.map((file) => file.content).join("\n\n");
  const checklist = CRITERIA.map((criterion) => {
    const good = criterion.good.some((pattern) => pattern.test(combined));
    const weak = criterion.weak.some((pattern) => pattern.test(combined));
    const status = good ? "good" : weak ? "weak" : "missing";
    return {
      key: criterion.key,
      label: criterion.label,
      status,
      weight: criterion.weight,
      earned: status === "good" ? criterion.weight : status === "weak" ? 10 : 0,
      suggestion:
        status === "good"
          ? undefined
          : status === "weak"
            ? criterion.weakSuggestion
            : criterion.missingSuggestion,
    } satisfies ProjectInstructionChecklistItem;
  });
  const value = checklist.reduce((sum, item) => sum + item.earned, 0);
  const suggestions = checklist
    .filter((item) => item.status !== "good")
    .map((item) => item.suggestion)
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
  const fileSnapshots = files.map(toFileSnapshot);

  return {
    generated_at: generatedAt,
    analyzer: "local-project-instructions-v1",
    score: {
      value,
      max: 100,
      band: instructionScoreBand(value),
    },
    files: fileSnapshots,
    files_found: fileSnapshots.length,
    checklist,
    suggestions:
      fileSnapshots.length === 0
        ? [
            "Add AGENTS.md or CLAUDE.md at the project root so coding agents can follow project-specific rules.",
          ]
        : suggestions,
    privacy: {
      local_only: true,
      external_calls: false,
      stores_file_bodies: false,
      returns_file_bodies: false,
      returns_raw_paths: false,
    },
  };
}

function toFileSnapshot(
  file: ProjectInstructionSourceFile,
): ProjectInstructionFileSnapshot {
  return {
    file_name: file.file_name,
    bytes: file.bytes,
    modified_at: file.modified_at,
    content_hash: createHash("sha256")
      .update(file.content)
      .digest("hex")
      .slice(0, 16),
    truncated: file.truncated,
  };
}

function instructionScoreBand(value: number): PromptQualityScoreBand {
  if (value >= 85) {
    return "excellent";
  }
  if (value >= 70) {
    return "good";
  }
  if (value >= 45) {
    return "needs_work";
  }
  return "weak";
}
