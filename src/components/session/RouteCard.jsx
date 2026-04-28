import { useRef } from "react";
import { getAreaLabel } from "../../data/areaMeta.js";
import {
  VISION_TRAINING_GRID_COLUMNS,
  VISION_TRAINING_GRID_SLOT_COUNT,
  buildVisionTrainingBoard
} from "../../lib/session/routeBoard.js";
import { formatDuration, formatDurationDelta } from "../../lib/timeFormat.js";
import { FireworkBurst } from "./FireworkBurst.jsx";
import { TimerDisplay } from "./TimerDisplay.jsx";

function formatRouteObjectiveLabel(objective) {
  if (!objective) {
    return "";
  }

  const areaPrefix = `${getAreaLabel(objective.area)} - `;
  return objective.label.startsWith(areaPrefix)
    ? objective.label.slice(areaPrefix.length)
    : objective.label;
}

function resolveGridColumns(slotCount, { preferVertical = false, visionTraining = false } = {}) {
  if (visionTraining) {
    return VISION_TRAINING_GRID_COLUMNS;
  }

  if (slotCount <= 1) {
    return 1;
  }

  if (preferVertical) {
    if (slotCount <= 6) {
      return 2;
    }

    return 3;
  }

  if (slotCount <= 4) {
    return 2;
  }

  if (slotCount === 10) {
    return 5;
  }

  if (slotCount <= 9) {
    return 3;
  }

  if (slotCount <= 16) {
    return 4;
  }

  return 5;
}

function routeTileClassName(slot, useDistrictLocationColors, visionTrainingEnabled, boardCellKind) {
  return [
    "route-tile",
    boardCellKind === "placeholder" ? "is-placeholder" : slot.objective ? "is-active" : "is-empty",
    visionTrainingEnabled ? "is-vision-training" : null,
    useDistrictLocationColors ? "uses-district-location-color" : null
  ]
    .filter(Boolean)
    .join(" ");
}

function formatRouteSeedPbFeedback(feedback) {
  if (!feedback) {
    return "";
  }

  if (feedback.seedPbStatus === "incomplete") {
    return "Incomplete";
  }

  if (feedback.seedPbStatus === "no-prior") {
    return "No prior";
  }

  if (!Number.isFinite(feedback.seedPbDiffMs)) {
    return "";
  }

  return formatDurationDelta(feedback.seedPbDiffMs);
}

function seedPbToneClass(feedback) {
  if (!Number.isFinite(feedback?.seedPbDiffMs)) {
    return "is-neutral";
  }

  if (feedback.seedPbDiffMs < 0) {
    return "is-faster";
  }

  if (feedback.seedPbDiffMs > 0) {
    return "is-slower";
  }

  return "is-neutral";
}

export function RouteCard({
  routeSlots,
  visibleCount,
  boardSeed = "",
  totalTimer,
  isPaused,
  useDistrictLocationColors = true,
  visionTrainingEnabled = false,
  preferVerticalLayout = false,
  sessionFeedback,
  backdrop,
  onCompleteSlot,
  onRunBack,
  onTogglePause,
  onEndSession
}) {
  const previousVisionBoardRef = useRef(null);
  const previousBoardSeedRef = useRef(boardSeed);
  const slotCount = Math.max(visibleCount ?? 0, routeSlots.length);
  const showRouteKeyMarkers = slotCount <= 10;

  if (previousBoardSeedRef.current !== boardSeed) {
    previousVisionBoardRef.current = null;
    previousBoardSeedRef.current = boardSeed;
  }

  const gridColumns = resolveGridColumns(slotCount, {
    preferVertical: preferVerticalLayout,
    visionTraining: visionTrainingEnabled
  });
  const boardCells = visionTrainingEnabled && slotCount < VISION_TRAINING_GRID_SLOT_COUNT
    ? buildVisionTrainingBoard(routeSlots, boardSeed, slotCount, previousVisionBoardRef.current)
    : routeSlots.map((slot, boardIndex) => ({
        boardIndex,
        kind: "slot",
        slot
      }));
  previousVisionBoardRef.current =
    visionTrainingEnabled && slotCount < VISION_TRAINING_GRID_SLOT_COUNT ? boardCells : null;
  const waveReward =
    sessionFeedback?.type === "route-square-complete" && sessionFeedback.waveComplete
      ? sessionFeedback
      : null;
  const waveSeedPbFeedback = formatRouteSeedPbFeedback(waveReward);

  return (
    <section className="panel drill-panel route-panel">
      {waveReward ? (
        <div className="drill-complete-feedback route-wave-feedback">
          <span className="drill-complete-feedback-label">Wave Complete</span>
          <strong className="drill-complete-feedback-value">
            {waveReward.completedCount}
            <small> / {waveReward.objectiveCount}</small>
          </strong>
          <div className="drill-complete-feedback-details">
            {Number.isFinite(waveReward.elapsedMs) ? (
              <p className="drill-complete-detail-row">
                <span>Route Time</span>
                <strong>{formatDuration(waveReward.elapsedMs)}</strong>
              </p>
            ) : null}
            {waveSeedPbFeedback ? (
              <p className={`drill-complete-detail-row drill-complete-seed-diff ${seedPbToneClass(waveReward)}`}>
                <span>Seed PB</span>
                <strong>{waveSeedPbFeedback}</strong>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="drill-panel-header vertical">
        <p className="eyebrow">Current Route</p>
        <h1>{visibleCount} Squares</h1>
      </div>

      <div
        className={`route-grid${visionTrainingEnabled ? " is-vision-training" : ""}`}
        style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
      >
        {boardCells.map((cell) => {
          if (cell.kind === "placeholder") {
            return (
              <div
                key={`placeholder-${cell.boardIndex}`}
                className={routeTileClassName(null, useDistrictLocationColors, visionTrainingEnabled, cell.kind)}
                aria-hidden="true"
              />
            );
          }

          const { slot } = cell;
          const tileReward =
            sessionFeedback?.type === "route-square-complete" &&
            sessionFeedback.slotIndex === slot.slotIndex
              ? sessionFeedback
              : null;

          return (
            <button
              key={`${slot.slotIndex}-${slot.objectiveId ?? "empty"}`}
              className={routeTileClassName(
                slot,
                useDistrictLocationColors,
                visionTrainingEnabled,
                cell.kind
              )}
              data-district={slot.objective?.district ?? undefined}
              style={{ "--route-tile-delay": `${Math.min(slot.slotIndex, 8) * 18}ms` }}
              type="button"
              onClick={() => onCompleteSlot(slot.slotIndex)}
              disabled={isPaused || !slot.objective}
              title={
                slot.objective
                  ? `${formatRouteObjectiveLabel(slot.objective)} · ${getAreaLabel(slot.objective.area)}`
                  : "Cleared"
              }
            >
              {tileReward ? (
                <>
                  <span
                    key={`${tileReward.id}_flash`}
                    className="route-tile-reward-flash"
                    aria-hidden="true"
                  />
                  <FireworkBurst
                    key={tileReward.id}
                    className="route-tile-reward"
                    backdrop={backdrop}
                    originTarget="parent"
                    bursts={[
                      { particleCount: 15, x: 0.5, y: 0.48, radiusScale: 1.34, speedScale: 0.94, gravityScale: 0.48 },
                      { particleCount: 6, x: 0.24, y: 0.34, delayMs: 55, radiusScale: 1.02, speedScale: 0.78, gravityScale: 0.42 },
                      { particleCount: 6, x: 0.76, y: 0.36, delayMs: 85, radiusScale: 1.02, speedScale: 0.78, gravityScale: 0.42 },
                      { particleCount: 6, x: 0.5, y: 0.7, delayMs: 115, radiusScale: 0.94, speedScale: 0.72, gravityScale: 0.42 }
                    ]}
                  />
                </>
              ) : null}
              {showRouteKeyMarkers ? <span className="route-tile-key">{slot.slotLabel}</span> : null}
              {slot.objective ? (
                <>
                  <div className="route-tile-body">
                    <strong>{formatRouteObjectiveLabel(slot.objective)}</strong>
                  </div>
                  <div className="route-tile-footer">
                    <span className="route-tile-area">{getAreaLabel(slot.objective.area)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="route-tile-body">
                    <strong>Cleared</strong>
                  </div>
                  <div className="route-tile-footer">
                    <span>Clear the Board to Continue</span>
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      <TimerDisplay
        label="Total Route Time"
        formattedElapsed={totalTimer.formattedElapsed}
        isRunning={totalTimer.isRunning}
        isPaused={totalTimer.isPaused}
        emphasis="is-accent is-primary"
      />

      <div className="action-row drill-action-row">
        <div className="drill-action-main">
          <button className="secondary-button" type="button" onClick={onTogglePause}>
            {isPaused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className="drill-action-menu">
          <button
            className="secondary-button drill-action-menu-trigger"
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
          >
            <svg className="drill-action-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 7L7 7M20 7L11 7" />
              <path d="M20 17H17M4 17L13 17" />
              <path d="M4 12H7L20 12" />
            </svg>
          </button>
          <div className="drill-action-menu-list" role="menu" aria-label="Additional actions">
            <button
              className="secondary-button drill-action-menu-item"
              type="button"
              onClick={onRunBack}
            >
              Run It Back
            </button>
            <button
              className="secondary-button danger-button drill-action-menu-item"
              type="button"
              onClick={onEndSession}
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
