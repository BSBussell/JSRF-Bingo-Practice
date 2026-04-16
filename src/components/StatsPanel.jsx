import { formatDuration } from "../hooks/useTimer.js";
import { getAreaLabel } from "../data/areaMeta.js";

function renderAreaRows(rows, emptyLabel) {
  if (rows.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <div className="stats-clean-table">
      {rows.map((row) => (
        <div key={row.key} className="stats-clean-row">
          <strong>{getAreaLabel(row.key)}</strong>
          <span>{row.completions} samples</span>
          <span>{row.averageMs !== null ? formatDuration(row.averageMs) : "No avg"}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsPanel({ stats }) {
  return (
    <section className="stats-layout">
      <article className="panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">Area Splits</p>
            <h2>AVG. Soul Square By Area</h2>
          </div>
        </div>
        {renderAreaRows(stats.squareByArea, "No completed soul square splits yet.")}
      </article>

      <article className="panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">Tape Splits</p>
            <h2>AVG. Tape Split by Area</h2>
          </div>
        </div>
        {renderAreaRows(stats.tapeByArea, "No tape splits recorded yet.")}
      </article>

      <article className="panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">Graffiti</p>
            <h2>AVG Graf Square Split</h2>
          </div>
        </div>

        {renderAreaRows(stats.graffitiByArea, "No completed graffiti square splits yet.")}
      </article>
    </section>
  );
}
