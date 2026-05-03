import { Copy, FileText, ListChecks, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import type { PromptFilters } from "./api.js";
import { copyTextToClipboard } from "./clipboard.js";
import {
  createHabitNextRequestBrief,
  createHabitNextRequestBriefPreview,
  type PromptHabitCoach,
} from "./habit-coach.js";
import { formatDate, formatSignedNumber } from "./formatters.js";
import "./habit-coach-panel.css";

const BRIEF_COPY_CONFIRMATION_MS = 2_500;
const PERCENT_MAX = 100;

export function HabitCoachPanel({
  coach,
  onOpenFilteredList,
  onSelect,
}: {
  coach: PromptHabitCoach;
  onOpenFilteredList(filters: PromptFilters): void;
  onSelect(id: string): void;
}) {
  const [briefCopied, setBriefCopied] = useState(false);
  const weaknessRate = coach.biggestWeakness
    ? Math.round(coach.biggestWeakness.rate * PERCENT_MAX)
    : 0;
  const nextRequestBrief = useMemo(
    () => createHabitNextRequestBrief(coach),
    [coach],
  );
  const nextRequestPreview = useMemo(
    () => createHabitNextRequestBriefPreview(coach),
    [coach],
  );
  const scoreMeterWidth = toMeterWidth(coach.score.value, coach.score.max);

  async function copyNextRequestBrief(): Promise<void> {
    const copied = await copyTextToClipboard(nextRequestBrief);
    if (!copied) {
      return;
    }

    setBriefCopied(true);
    window.setTimeout(() => setBriefCopied(false), BRIEF_COPY_CONFIRMATION_MS);
  }

  return (
    <section className="habit-command-center" aria-label="Prompt habit coach">
      <div className="habit-command-header">
        <div className="habit-command-title">
          <p className="eyebrow">Prompt habit coach</p>
          <h2>Prompt habit command center</h2>
        </div>
        <span className={`habit-status ${coach.status.tone}`}>
          {coach.status.label}
        </span>
      </div>

      <div className="habit-command-grid">
        <div className="habit-score-module">
          <span className={`habit-score-number ${coach.score.band}`}>
            {coach.score.value}
          </span>
          <div className="habit-score-copy">
            <strong>Your Prompt Habit Score</strong>
            <span>{`${coach.score.scoredPrompts} prompts scored / ${coach.score.max}`}</span>
            <div className="habit-score-meter" aria-hidden="true">
              <span style={{ width: `${scoreMeterWidth}%` }} />
            </div>
          </div>
        </div>

        <div className="habit-command-cell">
          <div className="habit-cell-title">
            <TrendingUp size={15} />
            <strong>Progress trend</strong>
          </div>
          <p className="habit-signal">
            {coach.trend.label}
            {coach.trend.label !== "Not enough data" && (
              <span> {formatSignedNumber(coach.trend.delta)} points</span>
            )}
          </p>
          <small>{`recent ${coach.trend.currentAverage} / previous ${coach.trend.previousAverage}`}</small>
        </div>

        <div className="habit-command-cell weakness">
          <div className="habit-cell-title">
            <Target size={15} />
            <strong>Your biggest weakness</strong>
          </div>
          {coach.biggestWeakness ? (
            <>
              <p className="habit-signal">{coach.biggestWeakness.label}</p>
              <small>{`${coach.biggestWeakness.count} prompts / ${weaknessRate}%`}</small>
              <div className="habit-weakness-meter" aria-hidden="true">
                <span style={{ width: `${weaknessRate}%` }} />
              </div>
              <button
                className="habit-inline-action"
                onClick={() =>
                  onOpenFilteredList({
                    focus: "quality-gap",
                    qualityGap: coach.biggestWeakness?.key,
                  })
                }
                type="button"
              >
                View matching prompts
              </button>
            </>
          ) : (
            <p className="habit-signal">No repeated weakness yet.</p>
          )}
        </div>
      </div>

      <div className="habit-brief-bar" aria-label="Next request brief">
        <div className="habit-brief-heading">
          <div>
            <p className="eyebrow">Next request brief</p>
            <strong>Preview and copy an approval-ready coaching prompt</strong>
            <span>
              Uses score, repeated weakness, next fixes, and review target
              without prompt bodies or raw paths.
            </span>
          </div>
          <button
            className="primary-button"
            onClick={() => void copyNextRequestBrief()}
            type="button"
          >
            <Copy size={15} /> {briefCopied ? "Copied brief" : "Copy brief"}
          </button>
        </div>
        <div className="habit-brief-preview">
          <BriefPreviewItem label="Goal" value={nextRequestPreview.goal} />
          <BriefPreviewItem
            label="Weakness"
            value={nextRequestPreview.weakness}
          />
          <BriefPreviewItem
            label="First fix"
            value={nextRequestPreview.firstFix}
          />
          <BriefPreviewItem
            label="Review target"
            value={nextRequestPreview.reviewTarget}
          />
          <div className="habit-brief-preview-item sections">
            <span>Sections</span>
            <p>{nextRequestPreview.sections.join(" / ")}</p>
          </div>
        </div>
      </div>

      <div className="habit-command-main">
        <div className="habit-next-fixes">
          <div className="habit-cell-title">
            <ListChecks size={15} />
            <strong>Fix these next</strong>
          </div>
          {coach.nextFixes.length === 0 && (
            <p className="muted">No repeated habit fix is ready yet.</p>
          )}
          {coach.nextFixes.map((fix) => (
            <button
              className="habit-fix-row"
              key={fix.label}
              onClick={() =>
                onOpenFilteredList({
                  focus: "quality-gap",
                  qualityGap: fix.key,
                })
              }
              type="button"
            >
              <span>
                <strong>{fix.command}</strong>
                <small>{fix.reason}</small>
              </span>
              <em>{Math.round(fix.rate * PERCENT_MAX)}%</em>
            </button>
          ))}
        </div>

        <div className="habit-review-queue">
          <div className="habit-cell-title">
            <FileText size={15} />
            <strong>Bad prompt review queue</strong>
          </div>
          {coach.reviewQueue.length === 0 && (
            <p className="muted">No low score prompts need review yet.</p>
          )}
          {coach.reviewQueue.map((prompt) => (
            <button
              className="habit-review-row"
              key={prompt.id}
              onClick={() => onSelect(prompt.id)}
              type="button"
            >
              <span
                className={`badge score-badge ${prompt.quality_score_band}`}
              >
                {prompt.quality_score}
              </span>
              <span>
                <strong>{prompt.project}</strong>
                <small>
                  {prompt.tool} / {formatDate(prompt.received_at)}
                </small>
                <em>
                  {prompt.reasons.length > 0
                    ? prompt.reasons.join(", ")
                    : "Open and improve"}
                </em>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="habit-pattern-note">
        <strong>{coach.patternSummary.title}</strong>
        <span>{coach.patternSummary.detail}</span>
      </div>
    </section>
  );
}

function BriefPreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="habit-brief-preview-item">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function toMeterWidth(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }

  return Math.min((value / max) * PERCENT_MAX, PERCENT_MAX);
}
