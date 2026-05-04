import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  GitCompare,
  Star,
  Tags,
  ThumbsDown,
  Trash2,
  XOctagon,
} from "lucide-react";
import { useState } from "react";

import {
  improvePrompt,
  type PromptImprovement,
} from "../../analysis/improve.js";
import {
  sendCoachFeedback,
  type CoachFeedbackRating,
  type PromptDetail,
  type PromptQualityGap,
  type PromptSummary,
} from "./api.js";
import { formatDate } from "./formatters.js";
import type { Language } from "./i18n.js";
import { SafeMarkdown } from "./markdown.js";
import { PromptAgentActionsPanel } from "./prompt-agent-actions.js";
import { isQualityGapKey, qualityGapLabel } from "./quality-options.js";
import "./prompt-detail-view.css";

export function PromptDetailView({
  copied,
  copiedImprovement,
  language,
  savedImprovement,
  onBack,
  onBookmark,
  onCopy,
  onCopyImprovement,
  onDelete,
  onNavigate,
  onOpenQualityGap,
  onSaveImprovement,
  prompt,
  queueNavigation,
}: {
  copied: boolean;
  copiedImprovement: boolean;
  language: Language;
  savedImprovement: boolean;
  onBack(): void;
  onBookmark(prompt: PromptDetail): void;
  onCopy(prompt: PromptDetail): void;
  onCopyImprovement(prompt: PromptDetail): void;
  onDelete(prompt: PromptDetail): void;
  onNavigate(id: string): void;
  onOpenQualityGap(gap: PromptQualityGap): void;
  onSaveImprovement(prompt: PromptDetail): void;
  prompt?: PromptDetail;
  queueNavigation: {
    current?: number;
    next?: PromptSummary;
    previous?: PromptSummary;
    total?: number;
  };
}) {
  if (!prompt) {
    return <div className="panel empty">Loading prompt details.</div>;
  }

  const improvement = improvePrompt({
    prompt: prompt.markdown,
    createdAt: prompt.received_at,
    language,
  });

  return (
    <div className="detail-layout">
      <aside className="metadata-panel">
        <dl>
          <dt>ID</dt>
          <dd>{prompt.id}</dd>
          <dt>Tool</dt>
          <dd>{prompt.tool}</dd>
          <dt>CWD</dt>
          <dd>{prompt.cwd}</dd>
          <dt>Received</dt>
          <dd>{formatDate(prompt.received_at)}</dd>
          <dt>Redaction</dt>
          <dd>{prompt.redaction_policy}</dd>
        </dl>
        <div
          className="metadata-stats"
          aria-label="Usefulness and duplicate signals"
        >
          <span>
            <Copy size={14} /> {prompt.usefulness.copied_count}
          </span>
          <span>
            <Star size={14} />{" "}
            {prompt.usefulness.bookmarked ? "saved" : "unsaved"}
          </span>
          <span>
            <GitCompare size={14} /> dup {prompt.duplicate_count || 0}
          </span>
        </div>
        <button className="danger full-width" onClick={() => onDelete(prompt)}>
          <Trash2 size={16} /> Delete
        </button>
      </aside>
      <article className="prompt-body">
        {prompt.analysis && (
          <AnalysisPreview
            analysis={prompt.analysis}
            onOpenQualityGap={onOpenQualityGap}
          />
        )}
        <PromptCoachPanel
          copied={copiedImprovement}
          improvement={improvement}
          onCopy={() => onCopyImprovement(prompt)}
          onSave={() => onSaveImprovement(prompt)}
          originalPrompt={prompt.markdown}
          promptId={prompt.id}
          saved={savedImprovement}
          savedDrafts={prompt.improvement_drafts}
        />
        <PromptAgentActionsPanel prompt={prompt} />
        <div className="prompt-actions">
          <button className="secondary-action" onClick={onBack}>
            <ArrowLeft size={16} /> Back to list
          </button>
          <div className="queue-actions" aria-label="Current queue navigation">
            <button
              aria-label="View previous prompt"
              disabled={!queueNavigation.previous}
              onClick={() =>
                queueNavigation.previous &&
                onNavigate(queueNavigation.previous.id)
              }
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span>
              {queueNavigation.current && queueNavigation.total
                ? `${queueNavigation.current} / ${queueNavigation.total}`
                : "No queue"}
            </span>
            <button
              aria-label="View next prompt"
              disabled={!queueNavigation.next}
              onClick={() =>
                queueNavigation.next && onNavigate(queueNavigation.next.id)
              }
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
          <div className="prompt-action-group">
            <button
              aria-pressed={prompt.usefulness.bookmarked}
              onClick={() => onBookmark(prompt)}
            >
              <Star size={16} />
              {prompt.usefulness.bookmarked ? "Saved" : "Save for later"}
            </button>
            <button onClick={() => onCopy(prompt)}>
              <Copy size={16} /> {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
        <SafeMarkdown markdown={prompt.markdown} />
      </article>
    </div>
  );
}

function PromptCoachPanel({
  copied,
  improvement,
  onCopy,
  onSave,
  originalPrompt,
  promptId,
  saved,
  savedDrafts,
}: {
  copied: boolean;
  improvement: PromptImprovement;
  onCopy(): void;
  onSave(): void;
  originalPrompt: string;
  promptId: string;
  saved: boolean;
  savedDrafts: PromptDetail["improvement_drafts"];
}) {
  const [feedback, setFeedback] = useState<
    CoachFeedbackRating | "error" | undefined
  >();
  const submitFeedback = (rating: CoachFeedbackRating): void => {
    setFeedback(rating);
    void sendCoachFeedback({ promptId, rating }).catch(() => {
      setFeedback("error");
    });
  };
  return (
    <section className="coach-panel" aria-label="Prompt improvement draft">
      <div className="analysis-header">
        <div>
          <p className="eyebrow">Prompt coach</p>
          <h2>Improvement draft for manual resubmission</h2>
        </div>
        <span className="badge">{improvement.mode}</span>
      </div>
      <p className="analysis-summary">{improvement.summary}</p>
      <div
        className="prompt-comparison"
        aria-label="Original prompt next to improved draft"
      >
        <div className="prompt-comparison-column">
          <h3 className="prompt-comparison-heading">Original</h3>
          <pre className="prompt-comparison-body">{originalPrompt}</pre>
        </div>
        <div className="prompt-comparison-column">
          <h3 className="prompt-comparison-heading">
            Improved draft
            {improvement.changed_sections.length > 0 && (
              <span
                className="prompt-comparison-changed"
                aria-label={`${improvement.changed_sections.length} section${improvement.changed_sections.length === 1 ? "" : "s"} changed`}
              >
                {improvement.changed_sections.length} changed
              </span>
            )}
          </h3>
          {improvement.changed_sections.length > 0 && (
            <ul
              className="prompt-comparison-changed-list"
              aria-label="Changed sections"
            >
              {improvement.changed_sections.map((key) => (
                <li key={key}>{qualityGapLabel(key)}</li>
              ))}
            </ul>
          )}
          <pre className="prompt-comparison-body improved">
            {improvement.improved_prompt}
          </pre>
        </div>
      </div>
      <div className="coach-footer">
        <div className="coach-notes">
          {improvement.safety_notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
        <button className="coach-copy-button" onClick={onCopy} type="button">
          <Copy size={16} /> {copied ? "Copied" : "Copy draft"}
        </button>
        <button className="coach-save-button" onClick={onSave} type="button">
          <FileText size={16} /> {saved ? "Saved" : "Save draft"}
        </button>
      </div>
      <div
        className="coach-feedback"
        role="group"
        aria-label="Was this draft useful?"
      >
        <span className="coach-feedback-label">Was this useful?</span>
        <button
          aria-pressed={feedback === "helpful"}
          className={`coach-feedback-button${feedback === "helpful" ? " active" : ""}`}
          onClick={() => submitFeedback("helpful")}
          type="button"
        >
          <CheckCircle2 size={14} /> Helpful
        </button>
        <button
          aria-pressed={feedback === "not_helpful"}
          className={`coach-feedback-button${feedback === "not_helpful" ? " active" : ""}`}
          onClick={() => submitFeedback("not_helpful")}
          type="button"
        >
          <ThumbsDown size={14} /> Not helpful
        </button>
        <button
          aria-pressed={feedback === "wrong"}
          className={`coach-feedback-button${feedback === "wrong" ? " active" : ""}`}
          onClick={() => submitFeedback("wrong")}
          type="button"
        >
          <XOctagon size={14} /> Wrong
        </button>
        {feedback === "error" && (
          <span className="coach-feedback-error">
            Failed to record feedback.
          </span>
        )}
      </div>
      {savedDrafts.length > 0 && (
        <div className="saved-drafts" aria-label="Saved drafts">
          <h3>Saved drafts</h3>
          {savedDrafts.slice(0, 3).map((draft) => (
            <article className="saved-draft-row" key={draft.id}>
              <div>
                <strong>{formatDate(draft.created_at)}</strong>
                <span>{draft.analyzer}</span>
              </div>
              <p>
                {draft.changed_sections.length > 0
                  ? draft.changed_sections
                      .map((section) => qualityGapLabel(section) ?? section)
                      .join(", ")
                  : "Original structure cleanup"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalysisPreview({
  analysis,
  onOpenQualityGap,
}: {
  analysis: NonNullable<PromptDetail["analysis"]>;
  onOpenQualityGap(gap: PromptQualityGap): void;
}) {
  return (
    <section className="analysis-panel" aria-label="Analysis preview">
      <div className="analysis-header">
        <div>
          <p className="eyebrow">Local analysis</p>
          <h2>Analysis preview</h2>
        </div>
        <div className="analysis-score-box">
          <span className={`score-value ${analysis.quality_score.band}`}>
            {analysis.quality_score.value}
          </span>
          <small>Prompt score</small>
          <span className="badge">{analysis.analyzer}</span>
        </div>
      </div>
      <p className="analysis-summary">{analysis.summary}</p>
      {analysis.checklist.length > 0 && (
        <div className="checklist-grid" aria-label="Analysis checklist">
          {analysis.checklist.map((item) => {
            const qualityGap = isQualityGapKey(item.key) ? item.key : undefined;
            const breakdown = analysis.quality_score.breakdown.find(
              (entry) => entry.key === item.key,
            );

            return (
              <div className="checklist-item" key={item.key}>
                <div className="checklist-title">
                  <span className={`quality-dot ${item.status}`} />
                  <strong>{item.label}</strong>
                  <span className="quality-status">{item.status}</span>
                  {breakdown && (
                    <span
                      className="quality-points"
                      aria-label={`${item.label} earned ${breakdown.earned} of ${breakdown.weight} points`}
                      title={`${breakdown.earned}/${breakdown.weight} points`}
                    >
                      {breakdown.earned}/{breakdown.weight}
                    </span>
                  )}
                </div>
                <p>{item.reason}</p>
                {item.suggestion && <code>{item.suggestion}</code>}
                {item.status !== "good" && qualityGap && (
                  <button
                    className="checklist-action"
                    onClick={() => onOpenQualityGap(qualityGap)}
                    type="button"
                  >
                    View matching prompts
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {analysis.tags.length > 0 && (
        <div className="tag-row" aria-label="Automatic tags">
          <Tags size={14} />
          {analysis.tags.map((tag) => (
            <span className="badge tag-badge" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      {analysis.warnings.length > 0 && (
        <div className="analysis-list">
          <h3>Warnings</h3>
          <ul>
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {analysis.suggestions.length > 0 && (
        <div className="analysis-list">
          <h3>Improvement hints</h3>
          <ul>
            {analysis.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
