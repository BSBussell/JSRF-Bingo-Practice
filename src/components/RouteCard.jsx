import { getAreaLabel } from "../data/areaMeta.js";
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

function resolveGridColumns(slotCount) {
  if (slotCount <= 1) {
    return 1;
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

export function RouteCard({
  routeSlots,
  visibleCount,
  totalTimer,
  isPaused,
  onCompleteSlot,
  onTogglePause,
  onEndSession
}) {
  const slotCount = Math.max(visibleCount ?? 0, routeSlots.length);
  const gridColumns = resolveGridColumns(slotCount);

  return (
    <section className="panel drill-panel route-panel">
      <div className="drill-panel-header vertical">
        <p className="eyebrow">Current Route</p>
        <h1>{visibleCount} Squares</h1>
      </div>

      <div
        className="route-grid"
        style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
      >
        {routeSlots.map((slot) => (
          <button
            key={`${slot.slotIndex}-${slot.objectiveId ?? "empty"}`}
            className={`route-tile ${slot.objective ? "is-active" : "is-empty"}`}
            type="button"
            onClick={() => onCompleteSlot(slot.slotIndex)}
            disabled={isPaused || !slot.objective}
            title={
              slot.objective
                ? `${formatRouteObjectiveLabel(slot.objective)} · ${getAreaLabel(slot.objective.area)}`
                : "Cleared"
            }
          >
            <span className="route-tile-key">{slot.slotLabel}</span>
            {slot.objective ? (
              <>
                <div className="route-tile-body">
                  <strong>{formatRouteObjectiveLabel(slot.objective)}</strong>
                </div>
                <div className="route-tile-footer">
                  <span>{getAreaLabel(slot.objective.area)}</span>
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
        ))}
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
