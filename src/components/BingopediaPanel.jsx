import { useMemo, useState } from "react";

import { resolveLearningVideoManifest, tapeVideosByArea } from "../data/learnVideos.js";
import { formatDuration } from "../hooks/useTimer.js";
import { formatObjectiveTypeLabel } from "../lib/objectiveTypes.js";
import {
  BINGOPEDIA_FILTERS,
  buildBingopediaViewModel,
  filterBingopediaSquares,
  groupBingopediaSquaresByArea
} from "../lib/stats/bingopedia.js";
import { LearningVideoPanel } from "./LearningVideoPanel.jsx";

const NAESTRINUS_CATALOG_URL =
  "https://youtube.com/playlist?list=PLDHncjR554MyBVGa7Z9WUU-fIC5d_BFrT&si=KjUa_90Cn3AkoNIK";

const FILTER_OPTIONS = [
  {
    value: BINGOPEDIA_FILTERS.ALL,
    label: "All"
  },
  {
    value: BINGOPEDIA_FILTERS.GRAFFITI,
    label: "Graffiti"
  },
  {
    value: BINGOPEDIA_FILTERS.DEFAULT_SOULS,
    label: "Default Souls"
  },
  {
    value: BINGOPEDIA_FILTERS.TAPE_SOULS,
    label: "Tape Souls"
  },
  {
    value: BINGOPEDIA_FILTERS.UNLOCKS,
    label: "Unlocks"
  },
  {
    value: BINGOPEDIA_FILTERS.NEVER_PRACTICED,
    label: "Never Practiced"
  }
];

function formatStatDuration(value) {
  return typeof value === "number" && Number.isFinite(value) ? formatDuration(value) : "n/a";
}

function formatDate(timestamp) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function districtClassName(district) {
  if (district === "ShibuyaCho") return "is-shibuya";
  if (district === "Kogane") return "is-kogane";
  if (district === "Benten") return "is-benten";
  return "";
}

function formatBingopediaTypeLabel(row) {
  if (row.type === "default") return "Default Soul";
  if (row.type === "unlock") return "Unlock";
  if (row.type === "graffiti") return "Graffiti";
  if (row.needsTape) return "Tape Soul";
  return formatObjectiveTypeLabel(row.type);
}

function AreaIndex({
  districts,
  selectedArea,
  onSelectArea
}) {
  return (
    <div className="bingopedia-pane bingopedia-area-index">
      <div className="bingopedia-pane-heading">
        <p className="eyebrow">Location Navigation</p>
        <h2>Districts & Areas</h2>
        <p>Choose a location to load its squares.</p>
      </div>

      <div className="bingopedia-district-list">
        {districts.map((district) => (
          <section className="bingopedia-district-group" key={district.district}>
            <h3>{district.label}</h3>
            <div className="bingopedia-area-list">
              {district.areas.map((area) => (
                <button
                  key={area.area}
                  className={`bingopedia-area-button ${area.area === selectedArea ? "is-active" : ""} ${districtClassName(district.district)}`}
                  type="button"
                  onClick={() => onSelectArea(area.area)}
                >
                  <span>
                    <strong>{area.label}</strong>
                    <small>
                      {area.clearedCount}/{area.squareCount} cleared
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SearchAndFilters({
  search,
  activeFilter,
  onSearchChange,
  onFilterChange
}) {
  return (
    <div className="bingopedia-search-stack">
      <label className="field bingopedia-search-field">
        <span className="visually-hidden">Search squares</span>
        <input
          type="search"
          value={search}
          placeholder="Search every square, area, or type"
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <span className="field-hint">
          Search covers the full Bingopedia. Filters narrow the current results.
        </span>
      </label>
      <div className="bingopedia-filter-row" aria-label="Bingopedia filters">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`bingopedia-filter-chip ${activeFilter === option.value ? "is-active" : ""}`}
            type="button"
            onClick={() => onFilterChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SquareRow({
  row,
  showArea,
  selected,
  onSelect
}) {
  return (
    <button
      className={`bingopedia-square-row ${selected ? "is-active" : ""} ${districtClassName(row.district)}`}
      type="button"
      onClick={() => onSelect(row)}
    >
      <span className="bingopedia-square-main">
        <strong>{row.description}</strong>
        <span className="bingopedia-square-tags">
          {showArea ? <span>{row.areaLabel}</span> : null}
          <span>{formatBingopediaTypeLabel(row)}</span>
        </span>
      </span>
      <span className="bingopedia-square-metrics">
        <span>{formatStatDuration(row.pbMs)} PB</span>
        <span>{row.attempts} tries</span>
      </span>
    </button>
  );
}

function SquareList({
  selectedAreaSummary,
  searchActive,
  groupedRows,
  selectedSquareId,
  onSelectSquare
}) {
  const heading = searchActive
    ? "Matching Squares"
    : selectedAreaSummary
      ? `Squares in ${selectedAreaSummary.label}`
      : "Select a Location";
  const totalSquares = groupedRows.reduce((total, group) => total + group.squares.length, 0);

  return (
    <div className="bingopedia-pane bingopedia-square-list-pane">
      <div className="bingopedia-pane-heading">
        <p className="eyebrow">Objective Selection</p>
        <h2>{heading}</h2>
        <p>
          {searchActive ? "Global results" : "Selected location"} · {totalSquares} square{totalSquares === 1 ? "" : "s"}
        </p>
      </div>

      {totalSquares === 0 ? (
        <div className="analytics-empty-state">No matching squares.</div>
      ) : (
        <div className="bingopedia-square-groups">
          {groupedRows.map((group) => (
            <section className="bingopedia-square-group" key={group.area}>
              {searchActive ? (
                <h3>
                  {group.label}
                  <span>{group.districtLabel}</span>
                </h3>
              ) : null}
              <div className="bingopedia-square-list">
                {group.squares.map((row) => (
                  <SquareRow
                    key={row.id}
                    row={row}
                    showArea={searchActive}
                    selected={row.id === selectedSquareId}
                    onSelect={onSelectSquare}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value
}) {
  return (
    <span className="bingopedia-metric-card">
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function AreaSummary({ areaSummary }) {
  if (!areaSummary) {
    return (
      <div className="bingopedia-detail-empty">
        <p className="eyebrow">Inspector</p>
        <h2>Select a Location</h2>
        <p>Choose a district area to browse its squares.</p>
      </div>
    );
  }

  return (
    <div className="bingopedia-detail-empty">
      <p className="eyebrow">Inspector</p>
      <h2>{areaSummary.label}</h2>
      <div className="bingopedia-metric-grid">
        <MetricCard label="squares" value={areaSummary.squareCount} />
        <MetricCard label="cleared" value={areaSummary.clearedCount} />
        <MetricCard label="best PB" value={formatStatDuration(areaSummary.bestPbMs)} />
      </div>
      <p>Select a square from the objective list to open guide video, performance, and practice controls.</p>
    </div>
  );
}

function RecentAttempts({ attempts }) {
  if (!attempts.length) {
    return <div className="analytics-empty-state">No attempts recorded for this square.</div>;
  }

  return (
    <div className="bingopedia-attempt-list">
      {attempts.map((attempt, index) => (
        <div className="bingopedia-attempt-row" key={`${attempt.sessionId}-${attempt.endedAt}-${index}`}>
          <strong>{attempt.result === "complete" ? "Clear" : "Skip"}</strong>
          <span>{formatStatDuration(attempt.durationMs)}</span>
          <span>{formatDate(attempt.endedAt)}</span>
        </div>
      ))}
    </div>
  );
}

function SquareDetail({
  row,
  areaSummary,
  autoplay,
  muted,
  practiceStatus,
  onBack,
  onPractice
}) {
  const sources = useMemo(() => {
    if (!row) {
      return [];
    }

    const squareVideo = resolveLearningVideoManifest(row.objective);
    const tapeVideo = row.needsTape ? tapeVideosByArea[row.area] ?? null : null;

    return [
      squareVideo
        ? {
            key: "square",
            label: "Square Guide",
            manifest: squareVideo
          }
        : null,
      tapeVideo
        ? {
            key: "tape",
            label: "Tape Guide",
            manifest: tapeVideo
          }
        : null
    ].filter(Boolean);
  }, [row]);

  if (!row) {
    return <AreaSummary areaSummary={areaSummary} />;
  }

  return (
    <div className="bingopedia-square-detail">
      <button className="secondary-button bingopedia-mobile-back" type="button" onClick={onBack}>
        Back to Squares
      </button>

      <div className="bingopedia-detail-heading">
        <div>
          <p className="eyebrow">Selected Square Details</p>
          <h2>{row.description}</h2>
          <p className="bingopedia-detail-meta">
            <span>{row.areaLabel}</span>
            <span>{formatBingopediaTypeLabel(row)}</span>
          </p>
        </div>
      </div>

      <section className="bingopedia-detail-section">
        <h3>Guide Video</h3>
        <LearningVideoPanel
          sources={sources}
          autoplay={autoplay}
          muted={muted}
          emptyLabel="No mapped video for this square."
          className="bingopedia-video-panel"
        />
      </section>

      <section className="bingopedia-practice-callout">
        <div>
          <h3>Focused Practice</h3>
          <p>Start a one-square practice seed for this objective.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => onPractice(row.id)}>
          Start Practice
        </button>
      </section>

      {practiceStatus ? <p className="setup-warning">{practiceStatus}</p> : null}

      <section className="bingopedia-detail-section">
        <h3>Performance</h3>
        <div className="bingopedia-metric-grid">
          <MetricCard label="PB" value={formatStatDuration(row.pbMs)} />
          <MetricCard label="attempts" value={row.attempts} />
          <MetricCard label="clears" value={row.clears} />
          <MetricCard label="skips" value={row.skips} />
          <MetricCard label="average" value={formatStatDuration(row.averageMs)} />
          <MetricCard label="last clear" value={formatDate(row.lastClearAt)} />
          {row.needsTape ? <MetricCard label="tape PB" value={formatStatDuration(row.tapePbMs)} /> : null}
        </div>
      </section>

      <section className="bingopedia-recent-section">
        <h3>Recent Attempts</h3>
        <RecentAttempts attempts={row.recentAttempts} />
      </section>
    </div>
  );
}

export function BingopediaPanel({
  history,
  bestTimesByObjective,
  aggregateStats,
  settings,
  onPracticeObjective
}) {
  const viewModel = useMemo(
    () =>
      buildBingopediaViewModel({
        history,
        bestTimesByObjective,
        aggregateStats
      }),
    [history, bestTimesByObjective, aggregateStats]
  );
  const firstArea = viewModel.districts[0]?.areas[0]?.area ?? "";
  const [selectedArea, setSelectedArea] = useState(firstArea);
  const [selectedSquareId, setSelectedSquareId] = useState("");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(BINGOPEDIA_FILTERS.ALL);
  const [practiceStatus, setPracticeStatus] = useState("");
  const selectedAreaSummary = viewModel.areaSummaries[selectedArea] ?? null;
  const selectedSquare = viewModel.squares.find((row) => row.id === selectedSquareId) ?? null;
  const searchActive = search.trim().length > 0 || activeFilter !== BINGOPEDIA_FILTERS.ALL;
  const filteredRows = searchActive
    ? filterBingopediaSquares(viewModel.squares, {
        search,
        filter: activeFilter
      })
    : selectedAreaSummary?.squares ?? [];
  const groupedRows = searchActive
    ? groupBingopediaSquaresByArea(filteredRows)
    : selectedAreaSummary
      ? [
          {
            area: selectedAreaSummary.area,
            label: selectedAreaSummary.label,
            district: selectedSquare?.district ?? "",
            districtLabel: selectedSquare?.districtLabel ?? "",
            squares: filteredRows
          }
        ]
      : [];

  function selectArea(area) {
    setSelectedArea(area);
    setSelectedSquareId("");
    setDetailPanelOpen(false);
    setPracticeStatus("");
  }

  function selectSquare(row) {
    setSelectedArea(row.area);
    setSelectedSquareId(row.id);
    setDetailPanelOpen(true);
    setPracticeStatus("");
  }

  function practiceSquare(objectiveId) {
    const didStart = onPracticeObjective?.(objectiveId);
    setPracticeStatus(didStart ? "" : "Could not start practice for this square.");
  }

  return (
    <section className="panel bingopedia-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow bingopedia-catalog-eyebrow">
            <a href={NAESTRINUS_CATALOG_URL} target="_blank" rel="noreferrer">
              Video Library Compiled by Naestrinus and others!
            </a>
          </p>
          <h1>Bingopedia</h1>
        </div>
        <SearchAndFilters
          search={search}
          activeFilter={activeFilter}
          onSearchChange={setSearch}
          onFilterChange={setActiveFilter}
        />
      </div>

      <div className={`bingopedia-browser ${detailPanelOpen ? "is-detail-open" : ""}`}>
        <AreaIndex
          districts={viewModel.districts}
          selectedArea={selectedArea}
          onSelectArea={selectArea}
        />
        <SquareList
          selectedAreaSummary={selectedAreaSummary}
          searchActive={searchActive}
          groupedRows={groupedRows}
          selectedSquareId={selectedSquareId}
          onSelectSquare={selectSquare}
        />
        <div className={`bingopedia-pane bingopedia-detail-pane ${selectedSquare ? "is-selected" : ""}`}>
          <SquareDetail
            row={selectedSquare}
            areaSummary={selectedAreaSummary}
            autoplay={settings.learnVideoAutoplay}
            muted={settings.learnAudioMuted}
            practiceStatus={practiceStatus}
            onBack={() => setDetailPanelOpen(false)}
            onPractice={practiceSquare}
          />
        </div>
      </div>
    </section>
  );
}
