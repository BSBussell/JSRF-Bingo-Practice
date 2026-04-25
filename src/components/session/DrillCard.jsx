import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getAreaLabel } from "../../data/areaMeta.js";
import { formatDuration, formatDurationDelta } from "../../lib/timeFormat.js";
import { FireworkBurst } from "./FireworkBurst.jsx";
import { TimerDisplay } from "./TimerDisplay.jsx";

function formatDrillObjectiveLabel(objective) {
  if (!objective) {
    return "";
  }

  const areaLabel = objective.areaLabel ?? getAreaLabel(objective.area);
  const areaPrefix = `${areaLabel} - `;

  return objective.label.startsWith(areaPrefix)
    ? objective.label.slice(areaPrefix.length)
    : objective.label;
}

function fitSingleLineFontSize(value, {
  minRem,
  maxRem,
  availableRem,
  averageCharacterEm = 1
}) {
  const length = Math.max(1, value.length);
  const size = Math.max(
    minRem,
    Math.min(maxRem, availableRem / (length * averageCharacterEm))
  );

  return `${size.toFixed(3)}rem`;
}

function formatCompletionFeedback(feedback) {
  if (!feedback) {
    return null;
  }

  if (feedback.pbStatus === "new-pb") {
    return {
      label: "New PB",
      detail: `-${formatDuration(Math.abs(feedback.pbDiffMs ?? 0))}`
    };
  }

  if (feedback.pbStatus === "missed-pb") {
    return {
      label: "Complete",
      detail: `+${formatDuration(Math.max(0, feedback.pbDiffMs ?? 0))}`
    };
  }

  if (feedback.pbStatus === "tied-pb") {
    return {
      label: "Complete",
      detail: "Tied"
    };
  }

  return {
    label: "Complete",
    detail: "No prior"
  };
}

function formatSeedPbFeedback(feedback) {
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

function squarePbToneClass(feedback) {
  if (feedback?.pbStatus === "new-pb") {
    return "is-pb";
  }

  if (feedback?.pbStatus === "missed-pb") {
    return "is-slower";
  }

  return "is-neutral";
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

function fitMultiLineFontSize(value, {
  minRem,
  maxRem,
  availableRem,
  availableBlockRem,
  averageCharacterEm = 1,
  lineHeight = 1,
  maxLines = 2
}) {
  const length = Math.max(1, value.length);
  const estimatedLineCount = Math.max(
    1,
    Math.min(maxLines, Math.ceil((length * maxRem * averageCharacterEm) / availableRem))
  );
  const widthFit = (availableRem * maxLines) / (length * averageCharacterEm);
  const heightFit = availableBlockRem / (estimatedLineCount * lineHeight);
  const size = Math.max(minRem, Math.min(maxRem, widthFit, heightFit));

  return `${size.toFixed(3)}rem`;
}

function useMultiLineFontFit(value, {
  minRem,
  maxRem,
  popoutMinRem = minRem,
  popoutMaxRem = maxRem,
  availableRem,
  availableBlockRem,
  popoutAvailableBlockRem = availableBlockRem,
  averageCharacterEm,
  lineHeight = 1,
  maxLines = 2
}) {
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState(() => fitMultiLineFontSize(value, {
    minRem,
    maxRem,
    availableRem,
    availableBlockRem,
    averageCharacterEm,
    lineHeight,
    maxLines
  }));

  useLayoutEffect(() => {
    const element = textRef.current;

    if (!element) {
      return undefined;
    }

    let frameId = 0;
    let disposed = false;

    function getRootFontSize() {
      return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    }

    function restoreInlineProperty(property, value) {
      if (value) {
        element.style.setProperty(property, value);
      } else {
        element.style.removeProperty(property);
      }
    }

    function measureFitAt(fontSizePx, targetHeight) {
      const previousFontSize = element.style.fontSize;
      const previousDisplay = element.style.display;
      const previousOverflow = element.style.overflow;
      const previousWhiteSpace = element.style.whiteSpace;
      const previousLineClamp = element.style.getPropertyValue("-webkit-line-clamp");
      const previousBoxOrient = element.style.getPropertyValue("-webkit-box-orient");

      element.style.fontSize = `${fontSizePx}px`;
      element.style.display = "block";
      element.style.overflow = "visible";
      element.style.whiteSpace = "normal";
      element.style.setProperty("-webkit-line-clamp", "unset");
      element.style.setProperty("-webkit-box-orient", "initial");

      const fits = element.scrollHeight <= targetHeight + 1
        && element.scrollWidth <= element.clientWidth + 1;

      element.style.fontSize = previousFontSize;
      element.style.display = previousDisplay;
      element.style.overflow = previousOverflow;
      element.style.whiteSpace = previousWhiteSpace;
      restoreInlineProperty("-webkit-line-clamp", previousLineClamp);
      restoreInlineProperty("-webkit-box-orient", previousBoxOrient);

      return fits;
    }

    function measureNow() {
      if (disposed) {
        return;
      }

      const isPopout = Boolean(element.closest(".popout-scale-target"));
      const rootFontSize = getRootFontSize();
      const activeMinPx = (isPopout ? popoutMinRem : minRem) * rootFontSize;
      const activeMaxPx = (isPopout ? popoutMaxRem : maxRem) * rootFontSize;
      const fallbackBlockRem = isPopout ? popoutAvailableBlockRem : availableBlockRem;
      const computedStyle = getComputedStyle(element);
      const targetHeight = element.clientHeight
        || Number.parseFloat(computedStyle.maxHeight)
        || fallbackBlockRem * rootFontSize;
      let low = activeMinPx;
      let high = activeMaxPx;

      for (let index = 0; index < 9; index += 1) {
        const midpoint = (low + high) / 2;

        if (measureFitAt(midpoint, targetHeight)) {
          low = midpoint;
        } else {
          high = midpoint;
        }
      }

      setFontSize(`${(low / rootFontSize).toFixed(3)}rem`);
    }

    function scheduleMeasure() {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measureNow);
    }

    measureNow();

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleMeasure)
      : null;
    resizeObserver?.observe(element);

    if (element.parentElement) {
      resizeObserver?.observe(element.parentElement);
    }

    window.addEventListener("resize", scheduleMeasure);

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleMeasure).catch(() => {});
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [
    averageCharacterEm,
    availableBlockRem,
    availableRem,
    lineHeight,
    maxLines,
    maxRem,
    minRem,
    popoutAvailableBlockRem,
    popoutMaxRem,
    popoutMinRem,
    value
  ]);

  return [textRef, fontSize];
}

export function DrillCard({
  objective,
  learnContent,
  learnPanelVisible,
  phaseInfo,
  totalTimer,
  splitTimer,
  sessionFeedback,
  backdrop,
  phaseActionLabel,
  onPhaseAction,
  onRunBack,
  onSkipSplit,
  onToggleLearnPanel,
  onTogglePause,
  onSkip,
  onEndSession
}) {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef(null);
  const objectiveTitle = formatDrillObjectiveLabel(objective);
  const [objectiveTitleRef, objectiveTitleFontSize] = useMultiLineFontFit(objectiveTitle, {
    minRem: 1.35,
    maxRem: 3.55,
    popoutMinRem: 1.55,
    popoutMaxRem: 3.85,
    availableRem: 33,
    availableBlockRem: 4.35,
    popoutAvailableBlockRem: 5.7,
    averageCharacterEm: 0.58,
    lineHeight: 0.98,
    maxLines: 2
  });

  if (!objective) {
    return (
      <section className="panel">
        <h1>No square available</h1>
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
  const objectiveAreaLabel = objective.areaLabel ?? getAreaLabel(objective.area);
  const objectiveAreaLabelStyle = {
    "--drill-location-font-size": fitSingleLineFontSize(objectiveAreaLabel, {
      minRem: 0.58,
      maxRem: 1.02,
      availableRem: 16
    }),
    "--drill-location-popout-font-size": fitSingleLineFontSize(objectiveAreaLabel, {
      minRem: 0.78,
      maxRem: 1.28,
      availableRem: 20
    })
  };

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

  const liveSplitIndex = Math.max(
    0,
    splitRows.findIndex((split) => split.status === "live")
  );
  const squareReward =
    sessionFeedback?.type === "practice-square-complete" &&
    sessionFeedback.objectiveId === objective.id
      ? sessionFeedback
      : null;
  const completionFeedback = formatCompletionFeedback(squareReward);
  const seedPbFeedback = formatSeedPbFeedback(squareReward);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!actionMenuRef.current?.contains(event.target)) {
        setIsActionMenuOpen(false);
      }
    }

    if (!isActionMenuOpen) {
      return undefined;
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isActionMenuOpen]);

  function runMenuAction(action) {
    setIsActionMenuOpen(false);
    action();
  }

  return (
    <section className="panel drill-panel">
      {squareReward ? (
        <>
          <span
            key={`${squareReward.id}_flash`}
            className="drill-complete-flash"
            aria-hidden="true"
          />
          <FireworkBurst
            key={squareReward.id}
            className="drill-complete-burst"
            backdrop={backdrop}
            bursts={[
              { particleCount: 38, x: 0.5, y: 0.44, radiusScale: 1.18, speedScale: 0.96 },
              { particleCount: 26, x: 0.28, y: 0.58, delayMs: 80, radiusScale: 0.9, speedScale: 0.82 },
              { particleCount: 26, x: 0.72, y: 0.58, delayMs: 125, radiusScale: 0.9, speedScale: 0.82 }
            ]}
          />
          <div className={`drill-complete-feedback ${squareReward.pbStatus === "new-pb" ? "is-win" : ""}`}>
            <span className="drill-complete-feedback-label">{completionFeedback.label}</span>
            {Number.isFinite(squareReward.durationMs) ? (
              <strong className="drill-complete-feedback-value">
                {formatDuration(squareReward.durationMs)}
              </strong>
            ) : null}
            <div className="drill-complete-feedback-details">
              <p className={`drill-complete-detail-row drill-complete-result-line ${squarePbToneClass(squareReward)}`}>
                <span>Square PB</span>
                <strong>{completionFeedback.detail}</strong>
              </p>
              {seedPbFeedback ? (
                <p className={`drill-complete-detail-row drill-complete-seed-diff ${seedPbToneClass(squareReward)}`}>
                  <span>Seed PB</span>
                  <strong>{seedPbFeedback}</strong>
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <div
        className="drill-panel-header vertical drill-objective-card"
        key={objective.id ?? objective.label}
      >
        <p
          className="eyebrow drill-objective-location"
          data-district={objective.district ?? undefined}
          style={objectiveAreaLabelStyle}
        >
          {objectiveAreaLabel}
        </p>
        <div className="drill-objective-copy">
          <h1 ref={objectiveTitleRef} style={{ fontSize: objectiveTitleFontSize }}>
            {objectiveTitle}
          </h1>
        </div>
      </div>

      <div
        className="split-board"
        style={{
          "--split-count": splitRows.length,
          "--split-active-index": liveSplitIndex,
          "--split-live-width": `${100 / splitRows.length}%`,
          "--split-active-offset": `${liveSplitIndex * 100}%`,
          gridTemplateColumns: `repeat(${splitRows.length}, minmax(0, 1fr))`
        }}
      >
        {splitRows.map((split) => (
          <article
            key={split.key}
            className={`split-card split-${split.status}`}
          >
            <div className="split-heading">
              <span className="split-index">{split.label}</span>
              <span
                key={`${split.key}-${split.status}-${split.detail}`}
                className={`split-status split-status-${split.status}`}
              >
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
            label="Total Drill Time"
            formattedElapsed={totalTimer.formattedElapsed}
            isRunning={totalTimer.isRunning}
            isPaused={totalTimer.isPaused}
            emphasis="is-secondary"
          />
        </div>
      </TimerDisplay>

      <div className="action-row drill-action-row">
        <div className="drill-action-main">
          <button className="primary-button" type="button" onClick={onPhaseAction} disabled={Boolean(squareReward)}>
            {phaseActionLabel}
          </button>
          <button className="secondary-button" type="button" onClick={onSkip} disabled={Boolean(squareReward)}>
            Skip Square
          </button>
          <button className="secondary-button" type="button" onClick={onTogglePause} disabled={Boolean(squareReward)}>
            {phaseInfo?.isPaused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className={`drill-action-menu ${isActionMenuOpen ? "is-open" : ""}`} ref={actionMenuRef}>
          <button
            className="secondary-button drill-action-menu-trigger"
            type="button"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={isActionMenuOpen}
            aria-controls="drill-action-menu-list"
            onClick={() => setIsActionMenuOpen((previousValue) => !previousValue)}
          >
            <svg className="drill-action-menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 7L7 7M20 7L11 7" />
              <path d="M20 17H17M4 17L13 17" />
              <path d="M4 12H7L20 12" />
            </svg>
          </button>
          <div
            className="drill-action-menu-list"
            id="drill-action-menu-list"
            role="menu"
            aria-label="Additional actions"
          >
            <button className="secondary-button drill-action-menu-item" type="button" onClick={() => runMenuAction(onRunBack)}>
              Run It Back
            </button>
            <button className="secondary-button drill-action-menu-item" type="button" onClick={() => runMenuAction(onSkipSplit)} disabled={Boolean(squareReward)}>
              Skip Split
            </button>
            {onToggleLearnPanel ? (
              <button
                className="secondary-button drill-action-menu-item"
                type="button"
                onClick={() => runMenuAction(onToggleLearnPanel)}
              >
                {learnPanelVisible ? "Hide Route Guide" : "Show Route Guide"}
              </button>
            ) : null}
            <button
              className="secondary-button danger-button drill-action-menu-item"
              type="button"
              onClick={() => runMenuAction(onEndSession)}
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
