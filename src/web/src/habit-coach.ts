import type {
  ArchiveScoreReport,
  PromptQualityGap,
  QualityDashboard,
} from "./api.js";

export type PromptHabitCoach = {
  score: {
    value: number;
    max: 100;
    band: ArchiveScoreReport["archive_score"]["band"];
    scoredPrompts: number;
  };
  status: {
    label: "Strong habits" | "Improving" | "Needs practice" | "No data yet";
    tone: "good" | "steady" | "attention" | "empty";
  };
  trend: {
    delta: number;
    label: "Improving" | "Flat" | "Sliding" | "Not enough data";
    currentAverage: number;
    previousAverage: number;
  };
  biggestWeakness?: {
    key?: PromptQualityGap;
    label: string;
    count: number;
    rate: number;
  };
  nextFixes: HabitFix[];
  reviewQueue: Array<{
    id: string;
    tool: string;
    project: string;
    received_at: string;
    quality_score: number;
    quality_score_band: ArchiveScoreReport["archive_score"]["band"];
    reasons: string[];
  }>;
  patternSummary: {
    title: string;
    detail: string;
  };
};

export type HabitFix = {
  key?: PromptQualityGap;
  label: string;
  command: string;
  reason: string;
  count: number;
  rate: number;
};

export type HabitNextRequestBriefPreview = {
  goal: string;
  weakness: string;
  firstFix: string;
  reviewTarget: string;
  sections: string[];
};

const GAP_FIXES: Record<
  PromptQualityGap,
  {
    command: string;
    fallbackLabel: string;
  }
> = {
  goal_clarity: {
    command: "Name the exact goal before asking for changes.",
    fallbackLabel: "Goal clarity",
  },
  background_context: {
    command: "Add the relevant context, files, and constraints.",
    fallbackLabel: "Background context",
  },
  scope_limits: {
    command: "State the allowed scope and what should not change.",
    fallbackLabel: "Scope limits",
  },
  output_format: {
    command: "Specify the expected output format.",
    fallbackLabel: "Output format",
  },
  verification_criteria: {
    command: "Include the verification command or acceptance check.",
    fallbackLabel: "Verification criteria",
  },
};

export function createPromptHabitCoach(
  dashboard: QualityDashboard,
  archiveScore?: ArchiveScoreReport,
): PromptHabitCoach {
  const score = {
    value:
      archiveScore?.archive_score.average ?? dashboard.quality_score.average,
    max: archiveScore?.archive_score.max ?? dashboard.quality_score.max,
    band: archiveScore?.archive_score.band ?? dashboard.quality_score.band,
    scoredPrompts:
      archiveScore?.archive_score.scored_prompts ??
      dashboard.quality_score.scored_prompts,
  };
  const trend = calculateScoreTrend(dashboard.trend.daily);
  const biggestWeakness = findBiggestWeakness(dashboard);
  const nextFixes = findNextFixes(dashboard);

  return {
    score,
    status: statusFor(score.value, score.scoredPrompts, trend.delta),
    trend,
    biggestWeakness,
    nextFixes,
    reviewQueue:
      archiveScore?.low_score_prompts
        .filter(isReviewablePrompt)
        .slice(0, 6)
        .map((prompt) => ({
          id: prompt.id,
          tool: prompt.tool,
          project: prompt.project,
          received_at: prompt.received_at,
          quality_score: prompt.quality_score,
          quality_score_band: prompt.quality_score_band,
          reasons: prompt.quality_gaps.slice(0, 3),
        })) ?? [],
    patternSummary: buildPatternSummary(dashboard, biggestWeakness),
  };
}

export function createHabitNextRequestBrief(coach: PromptHabitCoach): string {
  const fixes =
    coach.nextFixes.length > 0
      ? coach.nextFixes
          .map((fix, index) => `${index + 1}. ${fix.label}: ${fix.command}`)
          .join("\n")
      : "1. Use Goal, Context, Scope, Verification, and Output sections.";
  const weakness = coach.biggestWeakness
    ? `${coach.biggestWeakness.label} appears in ${coach.biggestWeakness.count} captured prompts.`
    : "No repeated weakness has enough samples yet.";
  const reviewTarget = coach.reviewQueue[0]
    ? `Review a recent low-score ${coach.reviewQueue[0].tool} prompt from ${coach.reviewQueue[0].project}.`
    : "No low-score review target is ready yet.";

  return [
    "Goal:",
    "Improve my next Claude Code/Codex request using my prompt-coach habit signals.",
    "",
    "Context:",
    `- Current habit score: ${coach.score.value}/${coach.score.max} (${coach.score.band}).`,
    `- Biggest weakness: ${weakness}`,
    `- Review target: ${reviewTarget}`,
    "",
    "Fix these habits:",
    fixes,
    "",
    "Scope:",
    "- Rewrite the request only. Do not run tools or change files until I approve the rewritten prompt.",
    "",
    "Verification:",
    "- Include the exact test command, acceptance check, or manual validation I should ask the coding agent to run.",
    "",
    "Output:",
    "- Return one approval-ready prompt draft plus a short list of what changed.",
  ].join("\n");
}

export function createHabitNextRequestBriefPreview(
  coach: PromptHabitCoach,
): HabitNextRequestBriefPreview {
  const firstFix = coach.nextFixes[0];
  const reviewTarget = coach.reviewQueue[0]
    ? `${coach.reviewQueue[0].tool} / ${coach.reviewQueue[0].project}`
    : "No low-score review target";

  return {
    goal: "Improve my next Claude Code/Codex request",
    weakness: coach.biggestWeakness?.label ?? "No repeated weakness yet",
    firstFix:
      firstFix?.command ??
      "Use Goal, Context, Scope, Verification, and Output sections.",
    reviewTarget,
    sections: [
      "Goal",
      "Context",
      "Fix these habits",
      "Scope",
      "Verification",
      "Output",
    ],
  };
}

function calculateScoreTrend(
  daily: QualityDashboard["trend"]["daily"],
): PromptHabitCoach["trend"] {
  const daysWithScores = daily.filter((day) => day.prompt_count > 0);
  if (daysWithScores.length < 2) {
    return {
      delta: 0,
      label: "Not enough data",
      currentAverage: 0,
      previousAverage: 0,
    };
  }

  const splitAt = Math.max(1, Math.floor(daysWithScores.length / 2));
  const previous = daysWithScores.slice(0, splitAt);
  const current = daysWithScores.slice(splitAt);
  const previousAverage = average(
    previous.map((day) => day.average_quality_score),
  );
  const currentAverage = average(
    current.map((day) => day.average_quality_score),
  );
  const delta = Math.round(currentAverage - previousAverage);

  return {
    delta,
    label: delta >= 5 ? "Improving" : delta <= -5 ? "Sliding" : "Flat",
    currentAverage,
    previousAverage,
  };
}

function findBiggestWeakness(
  dashboard: QualityDashboard,
): PromptHabitCoach["biggestWeakness"] {
  const item = [...dashboard.missing_items].sort(
    (a, b) =>
      b.rate - a.rate ||
      b.missing + b.weak - (a.missing + a.weak) ||
      a.label.localeCompare(b.label),
  )[0];

  if (!item) {
    return undefined;
  }

  return {
    key: toQualityGap(item.key),
    label: item.label,
    count: item.missing + item.weak,
    rate: item.rate,
  };
}

function findNextFixes(dashboard: QualityDashboard): HabitFix[] {
  return [...dashboard.missing_items]
    .sort(
      (a, b) =>
        b.rate - a.rate ||
        b.missing + b.weak - (a.missing + a.weak) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 3)
    .map((item) => {
      const key = toQualityGap(item.key);
      const guidance = key ? GAP_FIXES[key] : undefined;

      return {
        key,
        label: item.label || guidance?.fallbackLabel || item.key,
        command:
          guidance?.command ??
          "Make the missing expectation explicit next time.",
        reason: `${item.missing + item.weak} prompts need this habit.`,
        count: item.missing + item.weak,
        rate: item.rate,
      };
    });
}

function buildPatternSummary(
  dashboard: QualityDashboard,
  biggestWeakness: PromptHabitCoach["biggestWeakness"],
): PromptHabitCoach["patternSummary"] {
  const pattern = dashboard.patterns[0];
  if (pattern) {
    return {
      title: "Most repeated pattern",
      detail: pattern.message,
    };
  }

  if (biggestWeakness) {
    return {
      title: "Most repeated pattern",
      detail: `${biggestWeakness.label} is the most common missing habit.`,
    };
  }

  return {
    title: "Most repeated pattern",
    detail: "No repeated weak prompting pattern has enough samples yet.",
  };
}

function statusFor(
  score: number,
  scoredPrompts: number,
  delta: number,
): PromptHabitCoach["status"] {
  if (scoredPrompts === 0) {
    return {
      label: "No data yet",
      tone: "empty",
    };
  }

  if (score >= 80) {
    return {
      label: "Strong habits",
      tone: "good",
    };
  }

  if (delta >= 5) {
    return {
      label: "Improving",
      tone: "steady",
    };
  }

  return {
    label: "Needs practice",
    tone: "attention",
  };
}

function isReviewablePrompt(
  prompt: ArchiveScoreReport["low_score_prompts"][number],
): boolean {
  return (
    prompt.quality_score < 70 ||
    prompt.quality_score_band === "needs_work" ||
    prompt.quality_score_band === "weak"
  );
}

function toQualityGap(value: string): PromptQualityGap | undefined {
  return value in GAP_FIXES ? (value as PromptQualityGap) : undefined;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}
