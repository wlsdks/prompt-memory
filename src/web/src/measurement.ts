import type { ArchiveScoreReport, QualityDashboard } from "./api.js";

export type ArchiveMeasurementTone = "good" | "attention" | "empty";

export type ArchiveMeasurement = {
  generatedAt?: string;
  measuredAt?: string;
  sampleSize: number;
  totalPrompts: number;
  score: {
    value: number;
    max: number;
    band: ArchiveScoreReport["archive_score"]["band"];
  };
  status: {
    label: string;
    detail: string;
    tone: ArchiveMeasurementTone;
  };
  reviewBacklog: {
    count: number;
    rate: number;
    label: string;
  };
  biggestGap?: {
    label: string;
    count: number;
    rate: number;
  };
  privacy: {
    ok: boolean;
    label: string;
    detail: string;
  };
  coverage: {
    label: string;
    detail: string;
    hasMore: boolean;
  };
  nextAction: {
    label: string;
    detail: string;
    target: "capture" | "review" | "gap" | "maintain";
  };
};

export function createArchiveMeasurement({
  archiveScore,
  dashboard,
  measuredAt,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard: QualityDashboard;
  measuredAt?: string;
}): ArchiveMeasurement {
  const sampleSize =
    archiveScore?.archive_score.scored_prompts ??
    dashboard.quality_score.scored_prompts;
  const totalPrompts =
    archiveScore?.archive_score.total_prompts ?? dashboard.total_prompts;
  const score = archiveScore?.archive_score ?? dashboard.quality_score;
  const reviewablePrompts =
    archiveScore?.low_score_prompts.filter(isReviewableArchivePrompt) ?? [];
  const reviewRate =
    sampleSize > 0 ? roundRate(reviewablePrompts.length / sampleSize) : 0;
  const biggestGap =
    archiveScore?.top_gaps[0] ??
    dashboard.missing_items
      .map((item) => ({
        label: item.label,
        count: item.missing + item.weak,
        rate: item.rate,
      }))
      .sort((a, b) => b.rate - a.rate)[0];
  const privacyOk = archiveScore
    ? archiveScore.privacy.local_only &&
      !archiveScore.privacy.external_calls &&
      !archiveScore.privacy.returns_prompt_bodies &&
      !archiveScore.privacy.returns_raw_paths
    : true;

  return {
    generatedAt: archiveScore?.generated_at,
    measuredAt,
    sampleSize,
    totalPrompts,
    score: {
      value: score.average,
      max: score.max,
      band: score.band,
    },
    status: measurementStatus({
      privacyOk,
      reviewRate,
      sampleSize,
      score: score.average,
    }),
    reviewBacklog: {
      count: reviewablePrompts.length,
      rate: reviewRate,
      label:
        reviewablePrompts.length === 0
          ? "No review backlog"
          : `${reviewablePrompts.length} prompts need review`,
    },
    biggestGap,
    privacy: {
      ok: privacyOk,
      label: privacyOk ? "Local-only" : "Privacy check needed",
      detail: privacyOk
        ? "No external calls, prompt bodies, or raw paths in this report."
        : "Review measurement output before sharing it.",
    },
    coverage: {
      label: `${sampleSize} scored / ${totalPrompts} stored`,
      detail: archiveScore?.has_more
        ? "Recent sample measured; more prompts are available."
        : "Current archive sample is fully covered.",
      hasMore: archiveScore?.has_more ?? false,
    },
    nextAction: nextMeasurementAction({
      biggestGap,
      reviewCount: reviewablePrompts.length,
      sampleSize,
      score: score.average,
    }),
  };
}

function measurementStatus({
  privacyOk,
  reviewRate,
  sampleSize,
  score,
}: {
  privacyOk: boolean;
  reviewRate: number;
  sampleSize: number;
  score: number;
}): ArchiveMeasurement["status"] {
  if (sampleSize === 0) {
    return {
      label: "No data yet",
      detail: "Capture a few Claude Code or Codex prompts before measuring.",
      tone: "empty",
    };
  }

  if (!privacyOk || score < 70 || reviewRate >= 0.25) {
    return {
      label: "Needs work",
      detail: "Review the backlog and fix the most repeated quality gap next.",
      tone: "attention",
    };
  }

  return {
    label: "Healthy",
    detail: "The archive is scoring well; keep capturing and reusing prompts.",
    tone: "good",
  };
}

function nextMeasurementAction({
  biggestGap,
  reviewCount,
  sampleSize,
  score,
}: {
  biggestGap?: ArchiveMeasurement["biggestGap"];
  reviewCount: number;
  sampleSize: number;
  score: number;
}): ArchiveMeasurement["nextAction"] {
  if (sampleSize === 0) {
    return {
      label: "Capture prompts first",
      detail: "Run prompt-coach setup, then send a few real coding requests.",
      target: "capture",
    };
  }

  if (reviewCount > 0) {
    return {
      label: `Review ${reviewCount} low-score prompt${reviewCount === 1 ? "" : "s"}`,
      detail:
        "Open the review queue and rewrite one weak prompt into a reusable request.",
      target: "review",
    };
  }

  if (score < 80 && biggestGap) {
    return {
      label: `Fix ${biggestGap.label}`,
      detail:
        "Add this missing section to the next Claude Code or Codex request.",
      target: "gap",
    };
  }

  return {
    label: "Keep measuring weekly",
    detail: "The archive is healthy; watch for new gaps as projects change.",
    target: "maintain",
  };
}

function isReviewableArchivePrompt(
  prompt: ArchiveScoreReport["low_score_prompts"][number],
): boolean {
  return (
    prompt.quality_score < 70 ||
    prompt.quality_score_band === "needs_work" ||
    prompt.quality_score_band === "weak"
  );
}

function roundRate(value: number): number {
  return Math.round(value * 100) / 100;
}
