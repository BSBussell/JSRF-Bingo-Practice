import { useMemo, useRef, useState } from "react";

import { areaMeta } from "../../data/areaMeta.js";
import {
  PRIMARY_LEARNING_VIDEO_PLAYLIST_URL,
  buildBingopediaLearningVideoSources,
  buildBingopediaMiscTechRows,
  buildBingopediaTapeRow,
  getLearningVideoEmptyLabel
} from "../../data/learnVideos.js";
import {
  areaDistrictToneClassName,
  districtToneClassName
} from "../../lib/districtDisplay.js";
import { formatObjectiveTypeLabel } from "../../lib/objectiveTypes.js";
import {
  BINGOPEDIA_FILTERS,
  buildBingopediaViewModel,
  filterBingopediaSquares,
  groupBingopediaSquaresByArea
} from "../../lib/stats/bingopedia.js";
import { formatOptionalDuration, formatTimestamp } from "../../lib/timeFormat.js";
import { LearningVideoPanel } from "../learn/LearningVideoPanel.jsx";

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
    label: "Unpracticed"
  }
];

function shouldUseMobileBingopediaFlow() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 980px)").matches;
}

function shouldReduceMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatStatDuration(value) {
  return formatOptionalDuration(value);
}

function areaDistrictClassName(area) {
  return areaDistrictToneClassName(area);
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
  onSelectArea,
  paneRef
}) {
  return (
    <div className="bingopedia-pane bingopedia-area-index" ref={paneRef}>
      <div className="bingopedia-pane-heading">
        <p className="eyebrow">Districts</p>
        <h2>Levels</h2>
        <p>Choose a level to load its squares and tech.</p>
      </div>

      <div className="bingopedia-district-list">
        {districts.map((district) => (
          <section className="bingopedia-district-group" key={district.district}>
            <h3>{district.label}</h3>
            <div className="bingopedia-area-list">
              {district.areas.map((area) => (
                <button
                  key={area.area}
                  className={`bingopedia-area-button ${area.area === selectedArea ? "is-active" : ""} ${districtToneClassName(district.district)}`}
                  type="button"
                  onClick={() => onSelectArea(area.area)}
                >
                  <span>
                    <strong className="bingopedia-level-name">{area.label}</strong>
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
      className={`bingopedia-square-row ${selected ? "is-active" : ""} ${districtToneClassName(row.district)}`}
      type="button"
      onClick={() => onSelect(row)}
    >
      <span className="bingopedia-square-main">
        <strong>{row.description}</strong>
        <span className="bingopedia-square-tags">
          {showArea ? <span className={`bingopedia-level-label ${districtToneClassName(row.district)}`}>{row.areaLabel}</span> : null}
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

function MiscTechRow({
  row,
  selected,
  onSelect
}) {
  return (
    <button
      className={`bingopedia-square-row bingopedia-misc-tech-row ${selected ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelect(row)}
    >
      <span className="bingopedia-square-main">
        <strong>{row.title}</strong>
        <span className="bingopedia-square-tags">
          <span>{row.groupLabel}</span>
        </span>
      </span>
    </button>
  );
}

function TapeRow({
  row,
  selected,
  onSelect
}) {
  return (
    <button
      className={`bingopedia-square-row bingopedia-tape-row ${selected ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelect(row)}
    >
      <span className="bingopedia-square-main">
        <strong>{row.title}</strong>
        <span className="bingopedia-square-tags">
          <span>Tape Guide</span>
        </span>
      </span>
      <span className="bingopedia-square-metrics">
        <span>{formatStatDuration(row.stats?.bestMs)} PB</span>
        <span>{row.stats?.completions ?? 0} collected</span>
      </span>
    </button>
  );
}

function SquareList({
  selectedAreaSummary,
  searchActive,
  groupedRows,
  selectedSquareId,
  tapeRow,
  selectedTapeId,
  miscTechRows,
  selectedMiscTechId,
  onSelectSquare,
  onSelectTape,
  onSelectMiscTech,
  onBackToAreas,
  paneRef
}) {
  const heading = searchActive
    ? "Matching Squares"
    : selectedAreaSummary
      ? `Squares in ${selectedAreaSummary.label}`
      : "Select a Location";
  const totalSquares = groupedRows.reduce((total, group) => total + group.squares.length, 0);

  return (
    <div className="bingopedia-pane bingopedia-square-list-pane" ref={paneRef}>
      <button className="secondary-button bingopedia-mobile-back" type="button" onClick={onBackToAreas}>
        Back to Levels
      </button>

      <div className="bingopedia-pane-heading">
        <p className="eyebrow">Square Selection</p>
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

      {!searchActive && tapeRow ? (
        <section className="bingopedia-square-group bingopedia-tape-group">
          <h3>Tape</h3>
          <div className="bingopedia-square-list">
            <TapeRow
              row={tapeRow}
              selected={tapeRow.id === selectedTapeId}
              onSelect={onSelectTape}
            />
          </div>
        </section>
      ) : null}

      {!searchActive && miscTechRows.length > 0 ? (
        <section className="bingopedia-square-group bingopedia-misc-tech-group">
          <h3>
            Misc. Tech
            <span>{miscTechRows.length}</span>
          </h3>
          <div className="bingopedia-square-list">
            {miscTechRows.map((row) => (
              <MiscTechRow
                key={row.id}
                row={row}
                selected={row.id === selectedMiscTechId}
                onSelect={onSelectMiscTech}
              />
            ))}
          </div>
        </section>
      ) : null}
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
      <p>Select a square from the objective list to open guide video, stats, and practice it!</p>
    </div>
  );
}

function RecentAttempts({
  attempts,
  onOpenHistoryRun
}) {
  if (!attempts.length) {
    return <div className="analytics-empty-state">No attempts recorded for this square.</div>;
  }

  return (
    <div className="bingopedia-attempt-list">
      {attempts.map((attempt, index) => {
        const canOpenHistory =
          typeof onOpenHistoryRun === "function" &&
          typeof attempt.sessionId === "string" &&
          attempt.sessionId.length > 0;
        const resultLabel = attempt.result === "complete" ? "Clear" : "Skip";
        const durationLabel = formatStatDuration(attempt.durationMs);
        const dateLabel = formatTimestamp(attempt.endedAt, "Never");
        const content = (
          <>
            <strong>{resultLabel}</strong>
            <span>{durationLabel}</span>
            <span>{dateLabel}</span>
          </>
        );
        const key = `${attempt.sessionId}-${attempt.endedAt}-${index}`;

        if (!canOpenHistory) {
          return (
            <div className="bingopedia-attempt-row" key={key}>
              {content}
            </div>
          );
        }

        return (
          <button
            className="bingopedia-attempt-row is-clickable"
            type="button"
            key={key}
            onClick={() => onOpenHistoryRun(attempt.sessionId)}
            aria-label={`Open ${resultLabel.toLowerCase()} attempt from ${dateLabel} in History Manager`}
          >
            {content}
          </button>
        );
      })}
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
  onPractice,
  onOpenHistoryRun
}) {
  const sources = useMemo(() => buildBingopediaLearningVideoSources(row), [row]);

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
            <span className={`bingopedia-level-label ${districtToneClassName(row.district)}`}>{row.areaLabel}</span>
            <span>{formatBingopediaTypeLabel(row)}</span>
          </p>
        </div>
      </div>

      <section className="bingopedia-detail-section" aria-label="Guide video">
        <LearningVideoPanel
          sources={sources}
          autoplay={autoplay}
          muted={muted}
          emptyLabel={getLearningVideoEmptyLabel()}
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
          <MetricCard label="last clear" value={formatTimestamp(row.lastClearAt, "Never")} />
        </div>
      </section>

      <section className="bingopedia-recent-section">
        <h3>Recent Attempts</h3>
        <RecentAttempts attempts={row.recentAttempts} onOpenHistoryRun={onOpenHistoryRun} />
      </section>
    </div>
  );
}

function TapeDetail({
  row,
  areaSummary,
  autoplay,
  muted,
  onBack
}) {
  const stats = row.stats ?? {};

  return (
    <div className="bingopedia-square-detail">
      <button className="secondary-button bingopedia-mobile-back" type="button" onClick={onBack}>
        Back to Squares
      </button>

      <div className="bingopedia-detail-heading">
        <div>
          <p className="eyebrow">Tape Guide</p>
          <h2>{row.title}</h2>
          <p className="bingopedia-detail-meta">
            <span className={`bingopedia-level-label ${areaDistrictClassName(row.area)}`}>{areaSummary?.label ?? row.area}</span>
            <span>Tape</span>
          </p>
        </div>
      </div>

      <section className="bingopedia-detail-section" aria-label="Guide video">
        <LearningVideoPanel
          sources={row.sources}
          autoplay={autoplay}
          muted={muted}
          emptyLabel={getLearningVideoEmptyLabel("No mapped tape video for this area.")}
          className="bingopedia-video-panel"
        />
      </section>

      <section className="bingopedia-detail-section">
        <h3>Performance</h3>
        <div className="bingopedia-metric-grid">
          <MetricCard label="PB" value={formatStatDuration(stats.bestMs)} />
          <MetricCard label="collected" value={stats.completions ?? 0} />
          <MetricCard label="average" value={formatStatDuration(stats.averageMs)} />
          <MetricCard label="last collected" value={formatTimestamp(stats.lastCollectedAt, "Never")} />
        </div>
      </section>
    </div>
  );
}

function MiscTechDetail({
  row,
  areaSummary,
  autoplay,
  muted,
  onBack
}) {
  const areaLabel = row.area ? areaSummary?.label ?? row.area : "Unrecognized";

  return (
    <div className="bingopedia-square-detail">
      <button className="secondary-button bingopedia-mobile-back" type="button" onClick={onBack}>
        Back to Squares
      </button>

      <div className="bingopedia-detail-heading">
        <div>
          <p className="eyebrow">Misc. Tech</p>
          <h2>{row.title}</h2>
          <p className="bingopedia-detail-meta">
            <span className={`bingopedia-level-label ${areaDistrictClassName(row.area)}`}>{areaLabel}</span>
            <span>{row.groupLabel}</span>
          </p>
        </div>
      </div>

      <section className="bingopedia-detail-section" aria-label="Guide video">
        <LearningVideoPanel
          sources={row.sources}
          autoplay={autoplay}
          muted={muted}
          emptyLabel={getLearningVideoEmptyLabel("No mapped video for this tech entry.")}
          className="bingopedia-video-panel"
        />
      </section>
    </div>
  );
}

export function BingopediaPanel({
  history,
  bestTimesByObjective,
  aggregateStats,
  settings,
  onPracticeObjective,
  onOpenHistoryRun
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
  const [selectedTapeId, setSelectedTapeId] = useState("");
  const [selectedMiscTechId, setSelectedMiscTechId] = useState("");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [mobileBrowseStep, setMobileBrowseStep] = useState("areas");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(BINGOPEDIA_FILTERS.ALL);
  const [practiceStatus, setPracticeStatus] = useState("");
  const areaPaneRef = useRef(null);
  const squarePaneRef = useRef(null);
  const detailPaneRef = useRef(null);
  const selectedAreaSummary = viewModel.areaSummaries[selectedArea] ?? null;
  const selectedSquare = viewModel.squares.find((row) => row.id === selectedSquareId) ?? null;
  const searchActive = search.trim().length > 0 || activeFilter !== BINGOPEDIA_FILTERS.ALL;
  const tapeRow = useMemo(() => {
    if (searchActive) {
      return null;
    }

    const row = buildBingopediaTapeRow(selectedArea);
    return row
      ? {
          ...row,
          stats: selectedAreaSummary?.tapeStats ?? {}
        }
      : null;
  }, [searchActive, selectedArea, selectedAreaSummary]);
  const selectedTape = tapeRow?.id === selectedTapeId ? tapeRow : null;
  const miscTechRows = useMemo(
    () => (searchActive ? [] : buildBingopediaMiscTechRows(selectedArea)),
    [searchActive, selectedArea]
  );
  const selectedMiscTech =
    miscTechRows.find((row) => row.id === selectedMiscTechId) ?? null;
  const listMotionKey = searchActive
    ? `search:${search.trim()}:${activeFilter}`
    : `area:${selectedArea}`;
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

  function scrollPaneIntoView(paneRef) {
    if (!shouldUseMobileBingopediaFlow()) {
      return;
    }

    const behavior = shouldReduceMotion() ? "auto" : "smooth";
    window.requestAnimationFrame(() => {
      paneRef.current?.scrollIntoView({
        behavior,
        block: "start"
      });
    });
  }

  function selectArea(area) {
    setSelectedArea(area);
    setSelectedSquareId("");
    setSelectedTapeId("");
    setSelectedMiscTechId("");
    setDetailPanelOpen(false);
    setMobileBrowseStep("squares");
    setPracticeStatus("");
    scrollPaneIntoView(squarePaneRef);
  }

  function selectSquare(row) {
    setSelectedArea(row.area);
    setSelectedSquareId(row.id);
    setSelectedTapeId("");
    setSelectedMiscTechId("");
    setDetailPanelOpen(true);
    setMobileBrowseStep("detail");
    setPracticeStatus("");
    scrollPaneIntoView(detailPaneRef);
  }

  function selectTape(row) {
    setSelectedArea(row.area);
    setSelectedSquareId("");
    setSelectedTapeId(row.id);
    setSelectedMiscTechId("");
    setDetailPanelOpen(true);
    setMobileBrowseStep("detail");
    setPracticeStatus("");
    scrollPaneIntoView(detailPaneRef);
  }

  function selectMiscTech(row) {
    if (row.area) {
      setSelectedArea(row.area);
    }

    setSelectedSquareId("");
    setSelectedTapeId("");
    setSelectedMiscTechId(row.id);
    setDetailPanelOpen(true);
    setMobileBrowseStep("detail");
    setPracticeStatus("");
    scrollPaneIntoView(detailPaneRef);
  }

  function backToAreas() {
    setDetailPanelOpen(false);
    setMobileBrowseStep("areas");
    setPracticeStatus("");
    scrollPaneIntoView(areaPaneRef);
  }

  function backToSquares() {
    setDetailPanelOpen(false);
    setMobileBrowseStep("squares");
    setPracticeStatus("");
    scrollPaneIntoView(squarePaneRef);
  }

  function updateSearch(value) {
    setSearch(value);
    setDetailPanelOpen(false);
    setMobileBrowseStep("squares");
  }

  function updateFilter(value) {
    setActiveFilter(value);
    setDetailPanelOpen(false);
    setMobileBrowseStep("squares");
    scrollPaneIntoView(squarePaneRef);
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
            <a href={PRIMARY_LEARNING_VIDEO_PLAYLIST_URL} target="_blank" rel="noreferrer">
              Video Library Compiled by Naestrinus and others!
            </a>
          </p>
          <h1>Bingopedia</h1>
        </div>
        <SearchAndFilters
          search={search}
          activeFilter={activeFilter}
          onSearchChange={updateSearch}
          onFilterChange={updateFilter}
        />
      </div>

      <div className={`bingopedia-browser is-mobile-${mobileBrowseStep} ${detailPanelOpen ? "is-detail-open" : ""}`}>
        <AreaIndex
          districts={viewModel.districts}
          selectedArea={selectedArea}
          onSelectArea={selectArea}
          paneRef={areaPaneRef}
        />
        <SquareList
          key={listMotionKey}
          selectedAreaSummary={selectedAreaSummary}
          searchActive={searchActive}
          groupedRows={groupedRows}
          selectedSquareId={selectedSquareId}
          tapeRow={tapeRow}
          selectedTapeId={selectedTapeId}
          miscTechRows={miscTechRows}
          selectedMiscTechId={selectedMiscTechId}
          onSelectSquare={selectSquare}
          onSelectTape={selectTape}
          onSelectMiscTech={selectMiscTech}
          onBackToAreas={backToAreas}
          paneRef={squarePaneRef}
        />
        <div className={`bingopedia-pane bingopedia-detail-pane ${selectedSquare || selectedTape || selectedMiscTech ? "is-selected" : ""}`} ref={detailPaneRef}>
          {selectedTape ? (
            <TapeDetail
              key={selectedTape.id}
              row={selectedTape}
              areaSummary={selectedAreaSummary}
              autoplay={settings.learnVideoAutoplay}
              muted={settings.learnAudioMuted}
              onBack={backToSquares}
            />
          ) : selectedMiscTech ? (
            <MiscTechDetail
              key={selectedMiscTech.id}
              row={selectedMiscTech}
              areaSummary={selectedAreaSummary}
              autoplay={settings.learnVideoAutoplay}
              muted={settings.learnAudioMuted}
              onBack={backToSquares}
            />
          ) : (
            <SquareDetail
              key={selectedSquare?.id ?? `area:${selectedArea}`}
              row={selectedSquare}
              areaSummary={selectedAreaSummary}
              autoplay={settings.learnVideoAutoplay}
              muted={settings.learnAudioMuted}
              practiceStatus={practiceStatus}
              onBack={backToSquares}
              onPractice={practiceSquare}
              onOpenHistoryRun={onOpenHistoryRun}
            />
          )}
        </div>
      </div>
    </section>
  );
}
