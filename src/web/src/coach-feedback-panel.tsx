import type { CoachFeedbackSummary } from "./api.js";

export function CoachFeedbackPanel({
  summary,
}: {
  summary?: CoachFeedbackSummary;
}) {
  if (!summary) {
    return null;
  }

  if (summary.total === 0) {
    return (
      <section
        className="panel coach-feedback-panel"
        aria-label="Coach feedback"
      >
        <header>
          <h2>Coach feedback</h2>
        </header>
        <p className="coach-feedback-empty">
          No ratings yet. Open a prompt and use the Helpful / Not helpful /
          Wrong buttons next to a coach draft to start tracking which
          improvements worked.
        </p>
      </section>
    );
  }

  const ratio = Math.round(summary.helpful_ratio * 100);

  return (
    <section className="panel coach-feedback-panel" aria-label="Coach feedback">
      <header>
        <h2>Coach feedback</h2>
        <span className="coach-feedback-total">n = {summary.total}</span>
      </header>
      <div className="coach-feedback-grid">
        <div className="coach-feedback-metric">
          <span className="coach-feedback-metric-value">{ratio}%</span>
          <span className="coach-feedback-metric-label">Helpful</span>
        </div>
        <ul className="coach-feedback-breakdown">
          <li>
            <strong>{summary.helpful}</strong> Helpful
          </li>
          <li>
            <strong>{summary.not_helpful}</strong> Not helpful
          </li>
          <li>
            <strong>{summary.wrong}</strong> Wrong
          </li>
        </ul>
      </div>
    </section>
  );
}
