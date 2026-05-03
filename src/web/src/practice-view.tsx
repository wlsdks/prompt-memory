import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Copy,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { analyzePrompt } from "../../analysis/analyze.js";
import type { ArchiveScoreReport, PromptQualityScoreBand } from "./api.js";
import { PracticeHistoryChart } from "./charts.js";
import { copyTextToClipboard } from "./clipboard.js";
import {
  appendPracticeQuickFix,
  applyPracticeQuickFixes,
  createPracticeQuickFixes,
  type PracticeQuickFix,
} from "./practice-builder.js";
import {
  appendPracticeHistory,
  createPracticeHistoryItem,
  formatPracticeCopyCount,
  formatPracticeDelta,
  formatPracticeOutcome,
  markPracticeOutcome,
  readBrowserPracticeHistory,
  summarizePracticeHistory,
  writeBrowserPracticeHistory,
  type PracticeHistoryItem,
  type PracticeOutcome,
  type PracticePromptAnalysis,
} from "./practice-history.js";

const COPY_CONFIRMATION_MS = 2_500;
const MAX_SCORE_PERCENT = 100;
const DEFAULT_PRACTICE_DRAFT = [
  "Goal:",
  "Context:",
  "Scope:",
  "Verification:",
  "Output:",
].join("\n");

export function PracticeView({
  archiveScore,
  onMeasure,
}: {
  archiveScore?: ArchiveScoreReport;
  onMeasure(): void;
}) {
  const archiveTemplate =
    archiveScore?.next_prompt_template ?? DEFAULT_PRACTICE_DRAFT;
  const [draft, setDraft] = useState(archiveTemplate);
  const [draftCopied, setDraftCopied] = useState(false);
  const [fixedDraftCopied, setFixedDraftCopied] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistoryItem[]>(
    () => readBrowserPracticeHistory(),
  );

  useEffect(() => {
    if (!draft.trim() || draft === DEFAULT_PRACTICE_DRAFT) {
      setDraft(archiveTemplate);
    }
  }, [archiveTemplate, draft]);

  const analysis = useMemo(
    () =>
      analyzePrompt({
        prompt: draft,
        createdAt: new Date().toISOString(),
      }),
    [draft],
  );
  const score = analysis.quality_score;
  const missingItems = analysis.checklist.filter(
    (item) => item.status !== "good",
  );
  const quickFixes = useMemo(
    () => createPracticeQuickFixes(analysis),
    [analysis],
  );
  const projectedDraft = useMemo(
    () => applyPracticeQuickFixes(draft, quickFixes),
    [draft, quickFixes],
  );
  const projectedAnalysis = useMemo(
    () =>
      analyzePrompt({
        prompt: projectedDraft,
        createdAt: new Date().toISOString(),
      }),
    [projectedDraft],
  );
  const projectedScore = projectedAnalysis.quality_score;
  const projectedDelta = projectedScore.value - score.value;
  const practiceSummary = useMemo(
    () => summarizePracticeHistory(practiceHistory),
    [practiceHistory],
  );

  async function copyDraft(): Promise<void> {
    await copyAndRecordDraft(draft, analysis, setDraftCopied);
  }

  async function copyFixedDraft(): Promise<void> {
    await copyAndRecordDraft(
      projectedDraft,
      projectedAnalysis,
      setFixedDraftCopied,
    );
  }

  async function copyAndRecordDraft(
    text: string,
    nextAnalysis: PracticePromptAnalysis,
    setCopied: (copied: boolean) => void,
  ): Promise<void> {
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      return;
    }

    const historyItem = createPracticeHistoryItem({ analysis: nextAnalysis });
    setPracticeHistory((currentHistory) => {
      const nextHistory = appendPracticeHistory(currentHistory, historyItem);
      writeBrowserPracticeHistory(nextHistory);
      return nextHistory;
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPY_CONFIRMATION_MS);
  }

  function markLatestOutcome(outcome: PracticeOutcome): void {
    const latestId = practiceHistory[0]?.id;
    const nextHistory = markPracticeOutcome(practiceHistory, latestId, outcome);
    setPracticeHistory(nextHistory);
    writeBrowserPracticeHistory(nextHistory);
  }

  function applyQuickFix(fix: PracticeQuickFix): void {
    setDraft((currentDraft) => appendPracticeQuickFix(currentDraft, fix));
  }

  function applyAllQuickFixes(): void {
    setDraft((currentDraft) =>
      applyPracticeQuickFixes(currentDraft, quickFixes),
    );
  }

  return (
    <div className="practice-layout">
      <section className="practice-workspace panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Prompt practice workspace</p>
            <h2>Draft the next request</h2>
            <span>
              This draft is scored locally and is not saved until you send it to
              Claude Code or Codex.
            </span>
          </div>
          <div className="practice-actions">
            <button
              className="panel-link-button"
              onClick={onMeasure}
              type="button"
            >
              <RefreshCw size={14} /> Refresh plan
            </button>
            <button
              className="primary-button"
              onClick={() => void copyDraft()}
              type="button"
            >
              <Copy size={15} />{" "}
              {draftCopied ? "Copied draft" : "Copy practice draft"}
            </button>
          </div>
        </div>

        <label className="practice-editor">
          <span>Practice draft</span>
          <textarea
            aria-label="Practice draft"
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            value={draft}
          />
        </label>
      </section>

      <aside
        className="practice-score-panel panel"
        aria-label="Live local score"
      >
        <div className="practice-score-hero">
          <span className={`score-value ${score.band}`}>{score.value}</span>
          <div>
            <p className="eyebrow">Live local score</p>
            <h2>{qualityBandLabel(score.band)}</h2>
            <small>{score.max} max · local-rules-v1</small>
          </div>
        </div>
        <div className="archive-score-meter" aria-hidden="true">
          <span
            style={{
              width: `${Math.min((score.value / score.max) * MAX_SCORE_PERCENT, MAX_SCORE_PERCENT)}%`,
            }}
          />
        </div>

        <div className="practice-checklist">
          {analysis.checklist.map((item) => (
            <div className="practice-check-row" key={item.key}>
              <span className={`quality-dot ${item.status}`} />
              <div>
                <strong>{item.label}</strong>
                <small>{item.reason}</small>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="practice-fix-panel panel">
        <div className="practice-fix-header">
          <div>
            <p className="eyebrow">One-click builder</p>
            <h2>Fix before sending</h2>
          </div>
          <button
            className="panel-link-button"
            disabled={quickFixes.length === 0}
            onClick={applyAllQuickFixes}
            type="button"
          >
            <Plus size={14} />{" "}
            {quickFixes.length === 0
              ? "All habits covered"
              : "Add all missing sections"}
          </button>
        </div>
        {quickFixes.length === 0 ? (
          <p className="muted">This draft covers the core prompt habits.</p>
        ) : (
          <>
            <div className="practice-projection">
              <span className={`score-value ${projectedScore.band}`}>
                {projectedScore.value}
              </span>
              <div>
                <strong>Projected after fixes</strong>
                <small>
                  {projectedDelta > 0
                    ? `+${projectedDelta} points if all sections are added`
                    : "No score change from available fixes"}
                </small>
              </div>
              <button
                className="practice-copy-fixed"
                onClick={() => void copyFixedDraft()}
                type="button"
              >
                <Copy size={14} />{" "}
                {fixedDraftCopied ? "Copied fixed draft" : "Copy fixed draft"}
              </button>
            </div>
            <div className="practice-fix-list">
              {quickFixes.map((fix) => {
                const item = missingItems.find(
                  (checkItem) => checkItem.key === fix.key,
                );

                return (
                  <div className="practice-fix-row" key={fix.key}>
                    <div>
                      <strong>{fix.label}</strong>
                      <p>{item?.suggestion ?? item?.reason ?? fix.snippet}</p>
                    </div>
                    <button
                      className="practice-fix-add"
                      onClick={() => applyQuickFix(fix)}
                      type="button"
                    >
                      <Plus size={13} /> {fix.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="practice-history-panel panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Local growth signal</p>
            <h2>Practice history</h2>
          </div>
          <span>
            {practiceSummary.count > 0
              ? formatPracticeCopyCount(practiceSummary.count)
              : "No copied drafts yet"}
          </span>
        </div>
        <PracticeHistoryChart history={practiceHistory} />
        <div className="practice-history-stats">
          <MeasurementSignal
            detail="last copied practice draft"
            label="Latest"
            value={
              practiceSummary.latestScore === undefined
                ? "-"
                : `${practiceSummary.latestScore}`
            }
          />
          <MeasurementSignal
            detail="copied draft average"
            label="Average"
            value={
              practiceSummary.count === 0
                ? "-"
                : `${practiceSummary.averageScore}`
            }
          />
          <MeasurementSignal
            detail="vs previous copied draft"
            label="Delta"
            value={formatPracticeDelta(practiceSummary.delta)}
          />
        </div>
        <p className="muted">
          Practice history stores scores and missing labels only, not draft
          text.
        </p>
        <div
          className="practice-outcome-panel"
          aria-label="Practice outcome feedback"
        >
          <div>
            <p className="eyebrow">Outcome feedback</p>
            <h3>Did the copied draft work?</h3>
          </div>
          <div className="practice-outcome-actions">
            <PracticeOutcomeButton
              active={practiceHistory[0]?.outcome === "worked"}
              disabled={practiceHistory.length === 0}
              icon={<CheckCircle2 size={14} />}
              label="Worked"
              onClick={() => markLatestOutcome("worked")}
            />
            <PracticeOutcomeButton
              active={practiceHistory[0]?.outcome === "needs_context"}
              disabled={practiceHistory.length === 0}
              icon={<CircleAlert size={14} />}
              label="Needs context"
              onClick={() => markLatestOutcome("needs_context")}
            />
            <PracticeOutcomeButton
              active={practiceHistory[0]?.outcome === "blocked"}
              disabled={practiceHistory.length === 0}
              icon={<CircleX size={14} />}
              label="Blocked"
              onClick={() => markLatestOutcome("blocked")}
            />
          </div>
          {practiceHistory.length === 0 ? (
            <p className="muted">Copy a draft before marking outcome.</p>
          ) : (
            <div className="practice-outcome-summary">
              <span>
                <strong>{practiceSummary.workedCount}</strong>
                {"Worked"}
              </span>
              <span>
                <strong>{practiceSummary.needsContextCount}</strong>
                {"Needs context"}
              </span>
              <span>
                <strong>{practiceSummary.blockedCount}</strong>
                {"Blocked"}
              </span>
              <span>
                {"Latest outcome:"}
                <strong>
                  {practiceSummary.latestOutcome
                    ? formatPracticeOutcome(practiceSummary.latestOutcome)
                    : "No outcome yet"}
                </strong>
              </span>
            </div>
          )}
        </div>
        {practiceSummary.repeatedGap && (
          <p className="practice-history-gap">
            Repeated practice gap:{" "}
            <strong>{practiceSummary.repeatedGap}</strong>
          </p>
        )}
      </section>

      <section className="practice-plan-panel panel">
        <div className="panel-heading-row">
          <h2>Practice plan</h2>
          <span>
            {archiveScore
              ? `${archiveScore.practice_plan.length} habits from archive`
              : "No archive score yet"}
          </span>
        </div>
        {archiveScore?.practice_plan.length ? (
          <div className="archive-practice-list">
            {archiveScore.practice_plan.map((item) => (
              <div className="archive-practice-row" key={item.priority}>
                <span>{item.priority}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.prompt_rule}</p>
                  <small>{item.reason}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Evaluate the archive to load personalized practice habits.
          </p>
        )}
      </section>
    </div>
  );
}

function PracticeOutcomeButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick(): void;
}) {
  return (
    <button
      aria-pressed={active}
      className="practice-outcome-button"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function MeasurementSignal({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="measurement-signal">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function qualityBandLabel(band: PromptQualityScoreBand): string {
  if (band === "excellent") return "Excellent";
  if (band === "good") return "Good";
  if (band === "needs_work") return "Needs work";
  return "Weak";
}
