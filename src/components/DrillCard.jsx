import { formatDuration } from "../hooks/useTimer.js";
import { TimerDisplay } from "./TimerDisplay.jsx";

export function DrillCard({
  objective,
  learnContent,
  phaseInfo,
  totalTimer,
  splitTimer,
  phaseActionLabel,
  onPhaseAction,
  onSkipSplit,
  onTogglePause,
  onSkip,
  onEndSession
}) {
  if (!objective) {
    return (
      <section className="panel">
        <h1>No objective available</h1>
        <p>The current session has exhausted the available drill pool.</p>
        <button className="secondary-button" type="button" onClick={onEndSession}>
          End Drill Session
        </button>
      </section>
    );
  }

  function formatPbDetail(bestMs) {
    return bestMs !== null ? `PB ${formatDuration(bestMs)}` : "No PB";
  }

  function formatSplitDetail(durationMs) {
    return durationMs !== null ? formatDuration(durationMs) : "Done";
  }

  const splitRows = [];

  if (phaseInfo?.needsTravel) {
    splitRows.push({
      key: "travel",
      label: "Enter Level",
      status:
        phaseInfo.phase === "travel"
          ? "live"
          : phaseInfo.phase === "tape" || phaseInfo.phase === "challenge"
            ? "done"
            : "pending",
      detail:
        phaseInfo.phase === "travel"
          ? "Live"
          : phaseInfo.phase === "tape" || phaseInfo.phase === "challenge"
            ? formatSplitDetail(phaseInfo.travelSplitMs)
            : "Pending"
    });
  }

  if (phaseInfo?.requiresTape) {
    splitRows.push({
      key: "tape",
      label: "Tape",
      status:
        phaseInfo.phase === "tape"
          ? "live"
          : phaseInfo.tapeUnlocked || phaseInfo.phase === "challenge"
            ? "done"
            : "pending"
      ,
      detail:
        phaseInfo.phase === "tape"
          ? formatPbDetail(phaseInfo.tapePbMs)
          : phaseInfo.tapeUnlocked || phaseInfo.phase === "challenge"
            ? formatSplitDetail(phaseInfo.tapeSplitMs)
            : formatPbDetail(phaseInfo.tapePbMs)
    });
  }

  splitRows.push({
    key: "challenge",
    label: "Complete",
    status: phaseInfo?.phase === "challenge" ? "live" : "pending",
    detail:
      phaseInfo?.phase === "challenge"
        ? formatPbDetail(phaseInfo.challengePbMs)
        : formatPbDetail(phaseInfo?.challengePbMs ?? null)
  });

  return (
    <section className="panel drill-panel">
      <div className="drill-panel-header vertical">
        <p className="eyebrow">Current Drill</p>
        <h1>{objective.label}</h1>
      </div>

      <div
        className="split-board"
        style={{ gridTemplateColumns: `repeat(${splitRows.length}, minmax(0, 1fr))` }}
      >
        {splitRows.map((split) => (
          <article
            key={split.key}
            className={`split-card split-${split.status}`}
          >
            <div className="split-heading">
              <span className="split-index">{split.label}</span>
              <span className={`split-status split-status-${split.status}`}>
                {split.detail ?? split.status}
              </span>
            </div>
          </article>
        ))}
      </div>

      {learnContent ? <div className="drill-embed-slot">{learnContent}</div> : null}

      <TimerDisplay
        label="Current Split"
        formattedElapsed={splitTimer.formattedElapsed}
        isRunning={splitTimer.isRunning}
        isPaused={splitTimer.isPaused}
        emphasis="is-accent is-primary is-composite"
      >
        <div className="timer-subslot">
          <TimerDisplay
            label="Total Run"
            formattedElapsed={totalTimer.formattedElapsed}
            isRunning={totalTimer.isRunning}
            isPaused={totalTimer.isPaused}
            emphasis="is-secondary"
          />
        </div>
      </TimerDisplay>

      <div className="action-row">
        <button className="primary-button" type="button" onClick={onPhaseAction}>
          {phaseActionLabel}
        </button>
        <button className="secondary-button" type="button" onClick={onSkipSplit}>
          Skip Split
        </button>
        <button className="secondary-button" type="button" onClick={onSkip}>
          Skip Objective
        </button>
        <button className="secondary-button" type="button" onClick={onTogglePause}>
          {phaseInfo?.isPaused ? "Resume" : "Pause"}
        </button>
        <button className="ghost-button" type="button" onClick={onEndSession}>
          End Session
        </button>
      </div>
    </section>
  );
}
