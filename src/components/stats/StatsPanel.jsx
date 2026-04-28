import { useEffect, useMemo, useRef, useState } from "react";

import { areaMeta, getAreaLabel } from "../../data/areaMeta.js";
import { districtToneClassName } from "../../lib/districtDisplay.js";
import { formatObjectiveTypeLabel } from "../../lib/objectiveTypes.js";
import { getRouteRevealModeLabel } from "../../lib/session/routeRevealMode.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../../lib/session/sessionTypes.js";
import { buildAnalyticsViewModel } from "../../lib/stats/analytics.js";
import {
  formatDuration,
  formatDurationDelta,
  formatOptionalDuration,
  formatTimestamp
} from "../../lib/timeFormat.js";

const HISTORY_RUNS_PAGE_SIZE = 5;
const SEED_PB_SORT_OPTIONS = [
  {
    value: "recent",
    label: "Most recent"
  },
  {
    value: "lowest-pb",
    label: "Lowest PB"
  },
  {
    value: "most-attempts",
    label: "Most attempts"
  },
  {
    value: "biggest-gain",
    label: "Biggest gain"
  }
];
const HISTORY_SORT_OPTIONS = [
  {
    value: "recent",
    label: "Most recent"
  },
  {
    value: "fastest",
    label: "Fastest total"
  },
  {
    value: "most-clears",
    label: "Most clears"
  },
  {
    value: "longest",
    label: "Longest total"
  }
];

function seedTypeLabel(sessionType) {
  return sessionType === ROUTE_SESSION_TYPE ? "Route" : "Drill";
}

function seedRowsForType(analytics, sessionType) {
  return sessionType === ROUTE_SESSION_TYPE ? analytics.routeSeeds : analytics.practiceSeeds;
}

function sortedSeedRows(rows, sortMode) {
  const fallbackTime = (row) =>
    typeof row.latestEndedAt === "number" && Number.isFinite(row.latestEndedAt)
      ? row.latestEndedAt
      : 0;
  const fallbackPb = (row) =>
    typeof row.pbDurationMs === "number" && Number.isFinite(row.pbDurationMs)
      ? row.pbDurationMs
      : Number.POSITIVE_INFINITY;
  const fallbackGain = (row) =>
    typeof row.firstToBestDeltaMs === "number" && Number.isFinite(row.firstToBestDeltaMs)
      ? row.firstToBestDeltaMs
      : Number.NEGATIVE_INFINITY;

  return rows.slice().sort((left, right) => {
    if (sortMode === "lowest-pb") {
      return fallbackPb(left) - fallbackPb(right) || fallbackTime(right) - fallbackTime(left);
    }

    if (sortMode === "most-attempts") {
      return right.attempts - left.attempts || fallbackTime(right) - fallbackTime(left);
    }

    if (sortMode === "biggest-gain") {
      return fallbackGain(right) - fallbackGain(left) || fallbackTime(right) - fallbackTime(left);
    }

    return fallbackTime(right) - fallbackTime(left);
  });
}

function sortedRuns(runs, sortMode) {
  const fallbackTime = (run) =>
    typeof run.endedAt === "number" && Number.isFinite(run.endedAt) ? run.endedAt : 0;
  const durationForFastest = (run) =>
    typeof run.totalDurationMs === "number" && Number.isFinite(run.totalDurationMs)
      ? run.totalDurationMs
      : Number.POSITIVE_INFINITY;
  const durationForLongest = (run) =>
    typeof run.totalDurationMs === "number" && Number.isFinite(run.totalDurationMs)
      ? run.totalDurationMs
      : 0;
  const fallbackClears = (run) =>
    typeof run.completedCount === "number" && Number.isFinite(run.completedCount)
      ? run.completedCount
      : 0;

  return runs.slice().sort((left, right) => {
    if (sortMode === "fastest") {
      return durationForFastest(left) - durationForFastest(right) || fallbackTime(right) - fallbackTime(left);
    }

    if (sortMode === "most-clears") {
      return fallbackClears(right) - fallbackClears(left) || fallbackTime(right) - fallbackTime(left);
    }

    if (sortMode === "longest") {
      return durationForLongest(right) - durationForLongest(left) || fallbackTime(right) - fallbackTime(left);
    }

    return fallbackTime(right) - fallbackTime(left);
  });
}

function renderAreaRows(rows, emptyLabel, options = {}) {
  const showBest = options.showBest !== false;

  if (rows.length === 0) {
    return <div className="analytics-empty-state">{emptyLabel}</div>;
  }

  return (
    <div className={`stats-clean-table ${showBest ? "has-best" : "no-best"}`}>
      <div className="stats-area-header">
        <span>Area</span>
        <span>Samples</span>
        <span>Avg</span>
        {showBest ? <span>Best</span> : null}
      </div>
      {rows.map((row) => (
        <div key={row.key} className="stats-clean-row stats-area-row">
          <strong className={`analytics-area-name ${districtToneClassName(areaMeta[row.key]?.district)}`}>
            {getAreaLabel(row.key)}
          </strong>
          <span className="stats-area-metric" data-label="Samples">
            <strong>{row.completions}</strong>
          </span>
          <span className="stats-area-metric" data-label="Avg">
            <strong>{formatOptionalDuration(row.averageMs)}</strong>
          </span>
          {showBest ? (
            <span className="stats-area-metric" data-label="Best">
              <strong>{formatOptionalDuration(row.bestMs)}</strong>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SeedActions({
  exportSeed,
  sessionType,
  onCopySeed,
  onRunSeed
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const hasSeed = typeof exportSeed === "string" && exportSeed.length > 0;

  async function handleCopySeed() {
    if (!hasSeed || typeof onCopySeed !== "function") {
      setCopyStatus("Copy unavailable.");
      return;
    }

    const wasCopied = await onCopySeed(exportSeed);
    setCopyStatus(wasCopied ? "Copied." : "Copy failed.");
  }

  function handleRunSeed() {
    if (!hasSeed || typeof onRunSeed !== "function") {
      return;
    }

    onRunSeed(exportSeed, sessionType);
  }

  return (
    <div className="analytics-seed-actions">
      <button
        className="primary-button"
        type="button"
        onClick={handleRunSeed}
        disabled={!hasSeed}
      >
        Run It Back
      </button>
      <button
        className="secondary-button"
        type="button"
        onClick={handleCopySeed}
        disabled={!hasSeed}
      >
        Copy Seed
      </button>
      {copyStatus ? <span>{copyStatus}</span> : null}
    </div>
  );
}

function SeedReference({ row }) {
  return (
    <span className="analytics-seed-reference">
      {row.seedPrefix ? <span>{row.seedPrefix}</span> : null}
      <code>{row.seedPreview}</code>
    </span>
  );
}

function SeedRenameControl({ row, onRenameSeed }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(row.customName ?? "");

  function beginEditing() {
    setDraftName(row.customName ?? "");
    setIsEditing(true);
  }

  function saveName(event) {
    event.preventDefault();
    onRenameSeed?.(row.exportSeed, draftName);
    setIsEditing(false);
  }

  function clearName() {
    onRenameSeed?.(row.exportSeed, "");
    setDraftName("");
    setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <button
        className="ghost-button analytics-seed-rename-button"
        type="button"
        onClick={beginEditing}
      >
        {row.customName ? "Rename" : "Name Seed"}
      </button>
    );
  }

  return (
    <form className="analytics-seed-rename-form" onSubmit={saveName}>
      <input
        type="text"
        value={draftName}
        maxLength={60}
        placeholder={row.seedLabel}
        onChange={(event) => setDraftName(event.target.value)}
      />
      <button className="secondary-button" type="submit">Save</button>
      {row.customName ? (
        <button className="ghost-button" type="button" onClick={clearName}>Clear</button>
      ) : null}
      <button className="ghost-button" type="button" onClick={() => setIsEditing(false)}>
        Cancel
      </button>
    </form>
  );
}

function SeedRows({
  rows,
  emptyLabel,
  onCopySeed,
  onRunSeed,
  onRenameSeed
}) {
  if (rows.length === 0) {
    return <div className="analytics-empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="analytics-seed-list">
      {rows.map((row) => {
        const averageIsPb = row.attempts > 1 && row.averageDeltaMs === 0;

        return (
          <article className="analytics-seed-row" key={`${row.sessionType}-${row.exportSeed}`}>
            <div className="analytics-seed-main">
              <div className="analytics-seed-title">
                {row.customName ? <strong>{row.customName}</strong> : null}
                <SeedReference row={row} />
              </div>
              <SeedRenameControl row={row} onRenameSeed={onRenameSeed} />
            </div>
            <div className="analytics-seed-metrics">
              <span>
                <strong>{formatDuration(row.pbDurationMs)}</strong>
                PB
              </span>
              <span>
                <strong>{row.attempts}</strong>
                attempts
              </span>
              <span>
                <strong>{Number.isInteger(row.objectiveCount) ? row.objectiveCount : "n/a"}</strong>
                objectives
              </span>
              <span className={averageIsPb ? "analytics-positive" : ""}>
                <strong>{formatOptionalDuration(row.averageDurationMs)}</strong>
                avg
              </span>
              <span>
                <strong>
                  {typeof row.firstToBestDeltaMs === "number"
                    ? formatDurationDelta(-row.firstToBestDeltaMs)
                    : "n/a"}
                </strong>
                improvement
              </span>
            </div>
            {row.sessionType === ROUTE_SESSION_TYPE ? (
              <p className="analytics-row-note">
                {row.visibleCount ?? "?"} visible / {getRouteRevealModeLabel(row.routeRevealMode)}
              </p>
            ) : null}
            <SeedActions
              exportSeed={row.exportSeed}
              sessionType={row.sessionType}
              onCopySeed={onCopySeed}
              onRunSeed={onRunSeed}
            />
          </article>
        );
      })}
    </div>
  );
}

function SeedPbCard({
  title,
  rows,
  emptyLabel,
  onShowMore,
  onCopySeed,
  onRunSeed,
  onRenameSeed
}) {
  return (
    <article className="panel analytics-panel">
      <div className="panel-heading compact analytics-card-heading">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      <SeedRows
        rows={rows.slice(0, 1)}
        emptyLabel={emptyLabel}
        onCopySeed={onCopySeed}
        onRunSeed={onRunSeed}
        onRenameSeed={onRenameSeed}
      />
      {rows.length > 1 ? (
        <div className="analytics-card-footer">
          <p className="analytics-card-footnote">{rows.length} tracked seed PBs</p>
          <button className="secondary-button analytics-show-more-button" type="button" onClick={onShowMore}>
            Show More
          </button>
        </div>
      ) : null}
    </article>
  );
}

function SeedPbDetailPage({
  sessionType,
  rows,
  sortMode,
  onSortModeChange,
  onBack,
  onCopySeed,
  onRunSeed,
  onRenameSeed
}) {
  const sortedRows = sortedSeedRows(rows, sortMode);
  const typeLabel = seedTypeLabel(sessionType);

  return (
    <section className="stats-page analytics-detail-page">
      <div className="panel stats-hero-panel analytics-detail-hero">
        <div className="panel-heading compact analytics-detail-heading">
          <div>
            <h1>{typeLabel} Seed PBs</h1>
          </div>
          <button className="secondary-button" type="button" onClick={onBack}>
            Back
          </button>
        </div>
        <div className="analytics-detail-toolbar">
          <span>{rows.length} tracked seed PB{rows.length === 1 ? "" : "s"}</span>
          <label>
            <span>Sort</span>
            <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value)}>
              {SEED_PB_SORT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="analytics-section">
        <SeedRows
          rows={sortedRows}
          emptyLabel={`No completed ${typeLabel.toLowerCase()} seeds yet.`}
          onCopySeed={onCopySeed}
          onRunSeed={onRunSeed}
          onRenameSeed={onRenameSeed}
        />
      </section>
    </section>
  );
}

function runTypeLabel(run) {
  return run.sessionType === ROUTE_SESSION_TYPE ? "Route" : "Drill";
}

function runMeta(run) {
  if (run.sessionType === ROUTE_SESSION_TYPE) {
    return `${run.visibleCount ?? "?"} visible / ${getRouteRevealModeLabel(run.routeRevealMode)}`;
  }

  return `${run.completedCount} / ${run.objectiveCount ?? run.completedCount} squares`;
}

function RunEntryList({ run, onDeleteEntry }) {
  if (run.entries.length === 0) {
    return null;
  }

  return (
    <div className="analytics-run-entry-list">
      {run.entries.map((entry, index) => {
        const historyIndex = run.historyIndexes[index];
        const durationMs =
          entry.sessionType === ROUTE_SESSION_TYPE
            ? entry.totalDurationMs
            : entry.challengeDurationMs ?? entry.durationMs;

        return (
          <div className="analytics-run-entry" key={`${entry.sessionId}-${entry.endedAt}-${index}`}>
            <span>{entry.sessionType === ROUTE_SESSION_TYPE ? entry.label ?? "Route" : entry.label}</span>
            <span>{formatOptionalDuration(durationMs)}</span>
            <span>
              {entry.sessionType === ROUTE_SESSION_TYPE
                ? `${entry.squaresCleared ?? 0} clears`
                : formatObjectiveTypeLabel(entry.type)}
            </span>
            <button
              className="ghost-button danger-button analytics-entry-delete"
              type="button"
              onClick={() => onDeleteEntry?.(historyIndex)}
            >
              Delete Entry
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RunsList({
  runs,
  onDeleteRun,
  onDeleteEntry,
  onCopySeed,
  onRunSeed,
  focusedRunId = ""
}) {
  const [confirmingRunId, setConfirmingRunId] = useState(null);
  const [page, setPage] = useState(1);
  const appliedFocusedRunIdRef = useRef("");

  useEffect(() => {
    if (!focusedRunId) {
      appliedFocusedRunIdRef.current = "";
      return;
    }

    if (appliedFocusedRunIdRef.current === focusedRunId) {
      return;
    }

    const focusedIndex = runs.findIndex((run) => run.sessionId === focusedRunId);
    if (focusedIndex >= 0) {
      setPage(Math.floor(focusedIndex / HISTORY_RUNS_PAGE_SIZE) + 1);
    }
    appliedFocusedRunIdRef.current = focusedRunId;
  }, [focusedRunId, runs]);

  if (runs.length === 0) {
    return <p className="empty-state">No runs recorded yet.</p>;
  }

  const totalPages = Math.max(1, Math.ceil(runs.length / HISTORY_RUNS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * HISTORY_RUNS_PAGE_SIZE;
  const pageEnd = Math.min(runs.length, pageStart + HISTORY_RUNS_PAGE_SIZE);
  const visibleRuns = runs.slice(pageStart, pageEnd);
  const showPager = totalPages > 1;

  return (
    <>
      <div className="analytics-run-list">
        {visibleRuns.map((run) => {
          const isConfirming = confirmingRunId === run.sessionId;
          const isFocusedRun = Boolean(focusedRunId) && run.sessionId === focusedRunId;

          return (
            <article
              className={`analytics-run-card ${isFocusedRun ? "is-focused-history-run" : ""}`}
              key={run.sessionId}
            >
              <div className="analytics-run-copy">
                <span className="badge">{runTypeLabel(run)}</span>
                <h3>{run.title}</h3>
                <p>{runMeta(run)} / {formatTimestamp(run.endedAt)}</p>
              </div>
              <div className="analytics-run-metrics">
                <span>
                  <strong>{formatOptionalDuration(run.totalDurationMs)}</strong>
                  total
                </span>
                <span>
                  <strong>{run.completedCount}</strong>
                  clears
                </span>
                {run.sessionType === ROUTE_SESSION_TYPE ? (
                  <>
                    <span>
                      <strong>{formatOptionalDuration(run.averageGapMs)}</strong>
                      avg gap
                    </span>
                    <span>
                      <strong>{formatOptionalDuration(run.longestGapMs)}</strong>
                      longest gap
                    </span>
                  </>
                ) : (
                  <span>
                    <strong>{run.seedLabel}</strong>
                    seed
                  </span>
                )}
              </div>
              <div className="analytics-run-actions">
                <SeedActions
                  exportSeed={run.exportSeed}
                  sessionType={run.sessionType}
                  onCopySeed={onCopySeed}
                  onRunSeed={onRunSeed}
                />
                <button
                  className="ghost-button danger-button analytics-delete-run"
                  type="button"
                  onClick={() => {
                    if (isConfirming) {
                      onDeleteRun?.(run.sessionId);
                      setConfirmingRunId(null);
                      return;
                    }

                    setConfirmingRunId(run.sessionId);
                  }}
                >
                  {isConfirming ? "Confirm Delete" : "Delete Run"}
                </button>
              </div>
              <details className="analytics-run-details" open={isFocusedRun ? true : undefined}>
                <summary>Run entries</summary>
                <RunEntryList run={run} onDeleteEntry={onDeleteEntry} />
              </details>
            </article>
          );
        })}
      </div>
      {showPager ? (
        <div className="analytics-run-pager">
          <span>
            Showing {pageStart + 1}-{pageEnd} of {runs.length}
          </span>
          <div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage} / {totalPages}</span>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HistoryPreviewCard({
  runs,
  onShowMore,
  onDeleteRun,
  onDeleteEntry,
  onCopySeed,
  onRunSeed
}) {
  return (
    <article className="panel analytics-panel">
      <div className="panel-heading compact analytics-card-heading">
        <div>
          <h2>History Manager</h2>
        </div>
      </div>
      <RunsList
        runs={runs.slice(0, 1)}
        onDeleteRun={onDeleteRun}
        onDeleteEntry={onDeleteEntry}
        onCopySeed={onCopySeed}
        onRunSeed={onRunSeed}
      />
      {runs.length > 1 ? (
        <div className="analytics-card-footer">
          <p className="analytics-card-footnote">{runs.length} tracked runs</p>
          <button className="secondary-button analytics-show-more-button" type="button" onClick={onShowMore}>
            Show More
          </button>
        </div>
      ) : null}
    </article>
  );
}

function HistoryDetailPage({
  runs,
  sortMode,
  focusedRunId,
  onSortModeChange,
  onBack,
  onDeleteRun,
  onDeleteEntry,
  onCopySeed,
  onRunSeed
}) {
  const sortedHistoryRuns = sortedRuns(runs, sortMode);

  return (
    <section className="stats-page analytics-detail-page">
      <div className="panel stats-hero-panel analytics-detail-hero">
        <div className="panel-heading compact analytics-detail-heading">
          <div>
            <h1>History Manager</h1>
          </div>
          <button className="secondary-button" type="button" onClick={onBack}>
            Back
          </button>
        </div>
        <div className="analytics-detail-toolbar">
          <span>{runs.length} tracked run{runs.length === 1 ? "" : "s"}</span>
          <label>
            <span>Sort</span>
            <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value)}>
              {HISTORY_SORT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="analytics-section">
        <RunsList
          key={sortMode}
          runs={sortedHistoryRuns}
          focusedRunId={focusedRunId}
          onDeleteRun={onDeleteRun}
          onDeleteEntry={onDeleteEntry}
          onCopySeed={onCopySeed}
          onRunSeed={onRunSeed}
        />
      </section>
    </section>
  );
}

export function StatsPanel({
  stats,
  history,
  seedNamesByExportSeed,
  averageWindow = "all",
  focusedHistoryRunId = "",
  onDeleteEntry,
  onDeleteRun,
  onCopySeed,
  onRunSeed,
  onRenameSeed,
  onFocusedHistoryRunHandled
}) {
  const analytics = useMemo(
    () =>
      buildAnalyticsViewModel(history, {
        seedNamesByExportSeed,
        averageWindow: Number.isInteger(averageWindow) ? averageWindow : null
      }),
    [history, seedNamesByExportSeed, averageWindow]
  );
  const [seedDetailType, setSeedDetailType] = useState(null);
  const [seedPbSortMode, setSeedPbSortMode] = useState("recent");
  const [historyDetailVisible, setHistoryDetailVisible] = useState(false);
  const [historySortMode, setHistorySortMode] = useState("recent");
  const [focusedRunId, setFocusedRunId] = useState("");
  const seedDetailRows = useMemo(
    () => (seedDetailType ? seedRowsForType(analytics, seedDetailType) : []),
    [analytics, seedDetailType]
  );

  useEffect(() => {
    if (!focusedHistoryRunId) {
      return;
    }

    setFocusedRunId(focusedHistoryRunId);
    setSeedDetailType(null);
    setHistorySortMode("recent");
    setHistoryDetailVisible(true);
    onFocusedHistoryRunHandled?.();
  }, [focusedHistoryRunId, onFocusedHistoryRunHandled]);

  if (seedDetailType) {
    return (
      <SeedPbDetailPage
        sessionType={seedDetailType}
        rows={seedDetailRows}
        sortMode={seedPbSortMode}
        onSortModeChange={setSeedPbSortMode}
        onBack={() => setSeedDetailType(null)}
        onCopySeed={onCopySeed}
        onRunSeed={onRunSeed}
        onRenameSeed={onRenameSeed}
      />
    );
  }

  if (historyDetailVisible) {
    return (
      <HistoryDetailPage
        runs={analytics.runs}
        sortMode={historySortMode}
        focusedRunId={focusedRunId}
        onSortModeChange={setHistorySortMode}
        onBack={() => {
          setHistoryDetailVisible(false);
          setFocusedRunId("");
        }}
        onDeleteRun={onDeleteRun}
        onDeleteEntry={onDeleteEntry}
        onCopySeed={onCopySeed}
        onRunSeed={onRunSeed}
      />
    );
  }

  return (
    <section className="stats-page stats-dashboard-page">
      <div className="panel stats-hero-panel">
        <div className="panel-heading compact">
          <div>
            <h1>Run Analytics</h1>
          </div>
        </div>
        <div className="analytics-overview-grid">
          <article>
            <strong>{analytics.overview.drillRuns}</strong>
            <span>Drill runs</span>
          </article>
          <article>
            <strong>{analytics.overview.routeRuns}</strong>
            <span>Route runs</span>
          </article>
          <article>
            <strong>{analytics.overview.squaresMarked}</strong>
            <span>Squares marked</span>
          </article>
        </div>
      </div>

      <section className="analytics-section">
        <div className="panel-heading compact">
          <div>
            <h2>Seed PBs</h2>
          </div>
        </div>
        <div className="analytics-two-column">
          <SeedPbCard
            title="Drill PBs"
            rows={analytics.practiceSeeds}
            emptyLabel="No completed drill seeds yet."
            onShowMore={() => setSeedDetailType(PRACTICE_SESSION_TYPE)}
            onCopySeed={onCopySeed}
            onRunSeed={onRunSeed}
            onRenameSeed={onRenameSeed}
          />
          <SeedPbCard
            title="Route PBs"
            rows={analytics.routeSeeds}
            emptyLabel="No completed route seeds yet."
            onShowMore={() => setSeedDetailType(ROUTE_SESSION_TYPE)}
            onCopySeed={onCopySeed}
            onRunSeed={onRunSeed}
            onRenameSeed={onRenameSeed}
          />
        </div>
      </section>

      <section className="analytics-section">
        <HistoryPreviewCard
          runs={analytics.runs}
          onShowMore={() => {
            setFocusedRunId("");
            setHistoryDetailVisible(true);
          }}
          onDeleteRun={onDeleteRun}
          onDeleteEntry={onDeleteEntry}
          onCopySeed={onCopySeed}
          onRunSeed={onRunSeed}
        />
      </section>

      <section className="analytics-section analytics-area-section">
        <div className="panel-heading compact">
          <div>
            <h2>Area Tables</h2>
          </div>
        </div>
        <div className="analytics-three-column">
          <article className="panel analytics-panel analytics-area-panel">
            <div className="panel-heading compact">
              <div>
                <h2>Soul Squares</h2>
              </div>
            </div>
            {renderAreaRows(stats.squareByArea, "No completed soul square splits yet.", {
              showBest: false
            })}
          </article>
          <article className="panel analytics-panel analytics-area-panel">
            <div className="panel-heading compact">
              <div>
                <h2>Tape</h2>
              </div>
            </div>
            {renderAreaRows(stats.tapeByArea, "No tape splits recorded yet.")}
          </article>
          <article className="panel analytics-panel analytics-area-panel">
            <div className="panel-heading compact">
              <div>
                <h2>Graffiti</h2>
              </div>
            </div>
            {renderAreaRows(stats.graffitiByArea, "No completed graffiti square splits yet.")}
          </article>
        </div>
      </section>
    </section>
  );
}
