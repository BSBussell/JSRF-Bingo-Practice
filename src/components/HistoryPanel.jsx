import { getAreaLabel } from "../data/areaMeta.js";
import { formatDuration } from "../hooks/useTimer.js";
import { formatObjectiveTypeLabel } from "../lib/objectiveTypes.js";

function formatResult(result) {
  return result[0].toUpperCase() + result.slice(1);
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
                  <strong>{entry.label}</strong>
                  <p>
                    {getAreaLabel(entry.area)} / {formatObjectiveTypeLabel(entry.type)}
                  </p>
                </div>
                <div className="history-actions">
                  <div className="history-meta">
                    <span className={`result-chip result-${entry.result}`}>
                      {formatResult(entry.result)}
                    </span>
                    <span>
                      Square {typeof entry.challengeDurationMs === "number" ? formatDuration(entry.challengeDurationMs) : "n/a"}
                    </span>
                    <span>
                      Total {typeof entry.totalDurationMs === "number" ? formatDuration(entry.totalDurationMs) : "n/a"}
                    </span>
                  </div>
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
