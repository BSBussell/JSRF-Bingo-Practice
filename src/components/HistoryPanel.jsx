import { getAreaLabel } from "../data/areaMeta.js";
import { formatDuration } from "../hooks/useTimer.js";
import { formatObjectiveTypeLabel } from "../lib/objectiveTypes.js";

function formatResult(result) {
  return result[0].toUpperCase() + result.slice(1);
}

function renderHistoryMeta(entry) {
  if (entry.sessionType === "route") {
    return (
      <>
        <span className={`result-chip result-${entry.result}`}>
          {formatResult(entry.result)}
        </span>
        <span>{entry.visibleCount} visible</span>
        <span>{entry.squaresCleared ?? 0} / {entry.objectiveCount ?? 0} cleared</span>
        <span>
          Route {typeof entry.totalDurationMs === "number" ? formatDuration(entry.totalDurationMs) : "n/a"}
        </span>
      </>
    );
  }

  return (
    <>
      <span className={`result-chip result-${entry.result}`}>
        {formatResult(entry.result)}
      </span>
      <span>
        Square {typeof entry.challengeDurationMs === "number" ? formatDuration(entry.challengeDurationMs) : "n/a"}
      </span>
      <span>
        Total {typeof entry.totalDurationMs === "number" ? formatDuration(entry.totalDurationMs) : "n/a"}
      </span>
    </>
  );
}

export function HistoryPanel({ history, onDeleteEntry }) {
  const recentHistory = history.slice(-8).reverse();

  return (
    <section className="panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Recent History</p>
          <h2>Last drills</h2>
        </div>
      </div>

      {recentHistory.length === 0 ? (
        <p className="empty-state">No drill results yet.</p>
      ) : (
        <div className="history-list">
          {recentHistory.map((entry, index) => {
            const historyIndex = history.length - 1 - index;

            return (
              <article key={`${entry.sessionId}-${entry.endedAt}`} className="history-item">
                <div className="history-copy">
                  <strong>{entry.sessionType === "route" ? entry.label ?? "Route Run" : entry.label}</strong>
                  <p>
                    {entry.sessionType === "route"
                      ? `Route mode / ${entry.objectiveCount ?? 0} squares`
                      : `${getAreaLabel(entry.area)} / ${formatObjectiveTypeLabel(entry.type)}`}
                  </p>
                </div>
                <div className="history-actions">
                  <div className="history-meta">{renderHistoryMeta(entry)}</div>
                  <button
                    className="ghost-button danger-button history-delete-button"
                    type="button"
                    onClick={() => onDeleteEntry?.(historyIndex)}
                    aria-label={`Delete ${entry.label} from history`}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
