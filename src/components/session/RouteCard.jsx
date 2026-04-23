import { getAreaLabel } from "../../data/areaMeta.js";
import { formatDuration } from "../../hooks/useTimer.js";
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

function resolveGridColumns(slotCount, { preferVertical = false } = {}) {
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

  return 4;
}

function routeTileClassName(slot, useDistrictLocationColors) {
  return [
    "route-tile",
    slot.objective ? "is-active" : "is-empty",
    useDistrictLocationColors ? "uses-district-location-color" : null
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDurationDelta(durationMs) {
  const safeDurationMs = Number.isFinite(durationMs) ? durationMs : 0;
  const prefix = safeDurationMs > 0 ? "+" : safeDurationMs < 0 ? "-" : "";

  return `${prefix}${formatDuration(Math.abs(safeDurationMs))}`;
}

function formatRouteSeedPbFeedback(feedback) {
  if (!feedback || feedback.seedPbStatus === "no-prior") {
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
  totalTimer,
  isPaused,
  useDistrictLocationColors = true,
  preferVerticalLayout = false,
  sessionFeedback,
  backdrop,
  onCompleteSlot,
  onTogglePause,
  onEndSession
}) {
  const slotCount = Math.max(visibleCount ?? 0, routeSlots.length);
  const gridColumns = resolveGridColumns(slotCount, {
    preferVertical: preferVerticalLayout
  });
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
        className="route-grid"
        style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
      >
        {routeSlots.map((slot) => {
          const tileReward =
            sessionFeedback?.type === "route-square-complete" &&
            sessionFeedback.slotIndex === slot.slotIndex
              ? sessionFeedback
              : null;

          return (
            <button
              key={`${slot.slotIndex}-${slot.objectiveId ?? "empty"}`}
              className={routeTileClassName(slot, useDistrictLocationColors)}
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
              <span className="route-tile-key">{slot.slotLabel}</span>
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
            ☰
          </button>
          <div className="drill-action-menu-list" role="menu" aria-label="Additional actions">
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
