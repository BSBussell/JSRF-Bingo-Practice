import { formatDuration } from "../hooks/useTimer.js";

export function CompletionPanel({ completionSummary, onDismiss }) {
  if (!completionSummary) {
    return null;
  }

  return (
    <section className="panel completion-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Session Complete</p>
          <h2>Congratulations.</h2>
        </div>
      </div>

      <div className="completion-summary-grid">
        <article className="completion-stat">
          <span>Total Time</span>
          <strong>{formatDuration(completionSummary.totalDurationMs)}</strong>
        </article>
        <article className="completion-stat">
          <span>Objectives</span>
          <strong>{completionSummary.objectiveCount}</strong>
        </article>
      </div>

      <div className="action-row">
        <button className="secondary-button" type="button" onClick={onDismiss}>
          Close Summary
        </button>
      </div>
    </section>
  );
}
