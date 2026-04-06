import { formatDuration } from "../hooks/useTimer.js";
import { getAreaLabel } from "../data/areaMeta.js";
import { formatObjectiveTypeLabel } from "../lib/objectiveTypes.js";

function formatResult(result) {
  return result[0].toUpperCase() + result.slice(1);
}

export function HistoryPanel({ history }) {
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
          {recentHistory.map((entry) => (
            <article key={`${entry.sessionId}-${entry.endedAt}`} className="history-item">
              <div>
                <strong>{entry.label}</strong>
                <p>
                  {getAreaLabel(entry.area)} · {formatObjectiveTypeLabel(entry.type)}
                </p>
              </div>
              <div className="history-meta">
                <span className={`result-chip result-${entry.result}`}>
                  {formatResult(entry.result)}
                </span>
                <span>
                  Square {entry.challengeDurationMs ? formatDuration(entry.challengeDurationMs) : "n/a"}
                </span>
                <span>
                  Total {entry.totalDurationMs ? formatDuration(entry.totalDurationMs) : "n/a"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
