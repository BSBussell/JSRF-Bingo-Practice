import { useEffect, useState } from "react";

import { formatDuration } from "../hooks/useTimer.js";

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function resolveHexColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function hexToRgba(hex, alpha) {
  const normalized = resolveHexColor(hex, "#000000");
  const value = Number.parseInt(normalized.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function CompletionPanel({
  completionSummary,
  onNewExercise,
  onRunBack,
  onCopySeed,
  backdrop,
  history = []
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const exportSeed = completionSummary?.exportSeed ?? "";

  useEffect(() => {
    setCopyStatus("");
  }, [exportSeed]);

  if (!completionSummary) {
    return null;
  }

  const objectiveCount = completionSummary.objectiveCount ?? 0;
  const sessionHistory = Array.isArray(history)
    ? history.filter((entry) => entry?.sessionId === completionSummary.sessionId)
    : [];
  const inferredSquaresCleared = sessionHistory.reduce((count, entry) => {
    if (entry?.result === "complete") {
      return count + 1;
    }

    return count;
  }, 0);
  const squaresClearedRaw =
    sessionHistory.length > 0
      ? inferredSquaresCleared
      : Number.isInteger(completionSummary.squaresCleared)
        ? completionSummary.squaresCleared
        : 0;
  const squaresCleared = Math.min(objectiveCount, Math.max(0, squaresClearedRaw));
  const objectiveLabel = objectiveCount === 1 ? "objective" : "objectives";
  const particleSize = clampNumber(backdrop?.appearance?.size, 0.2, 2.5, 1.15);
  const particleGlow = clampNumber(backdrop?.appearance?.glow, 0, 5, 1.15);
  const particleFlicker = clampNumber(backdrop?.appearance?.flicker, 0, 3, 1);
  const particleOpacity = clampNumber(backdrop?.appearance?.opacity, 0.05, 1, 0.9);
  const particleSpeed = clampNumber(backdrop?.motion?.speed, 0, 3, 1);
  const particleSway = clampNumber(backdrop?.motion?.swayAmplitude, 0, 3, 1);
  const particleColor = resolveHexColor(backdrop?.colors?.particleColor, "#ffdf00");
  const particleCore = resolveHexColor(backdrop?.colors?.particleCore, "#fff6d6");
  const particleGlowColor = hexToRgba(particleColor, 0.48);
  const crestParticleStyle = {
    "--completion-particle-size": `${9 + particleSize * 8}px`,
    "--completion-particle-glow": `${14 + particleGlow * 9}px`,
    "--completion-particle-opacity": particleOpacity.toFixed(3),
    "--completion-particle-flicker-ms": `${Math.round(2200 - particleFlicker * 420)}ms`,
    "--completion-particle-float-ms": `${Math.round(2400 - particleSpeed * 380)}ms`,
    "--completion-particle-sway-px": `${(1.2 + particleSway * 1.4).toFixed(2)}px`,
    "--completion-particle-color": particleColor,
    "--completion-particle-core": particleCore,
    "--completion-particle-glow-color": particleGlowColor
  };

  async function handleCopySeed() {
    if (typeof onCopySeed !== "function") {
      return;
    }

    const wasCopied = await onCopySeed();
    setCopyStatus(wasCopied ? "Seed copied." : "Copy failed.");
  }

  return (
    <section className="panel completion-panel end-screen" role="status" aria-live="polite">
      <div className="completion-crest" aria-hidden="true">
        <span className="completion-crest-line" />
        <span className="completion-crest-particle" style={crestParticleStyle} />
        <span className="completion-crest-line" />
      </div>

      <div className="panel-heading compact completion-heading">
        <div>
          <p className="eyebrow">Drill Complete</p>
          <h2>You did it!</h2>
        </div>
      </div>

      <div className="completion-summary-grid">
        <article className="completion-stat completion-total-stat">
          <span>Total Drill Time</span>
          <strong>{formatDuration(completionSummary.totalDurationMs)}</strong>
          <p className="completion-stat-note">Full run timer, pause-adjusted.</p>
        </article>
        <article className="completion-stat completion-objective-stat">
          <span>Squares Cleared</span>
          <strong>
            {squaresCleared}
            <small> / {objectiveCount}</small>
          </strong>
          <p className="completion-stat-note">Completed squares in this run.</p>
          <div className="completion-objective-meter" aria-hidden="true">
            <span style={{ "--completion-objective-progress": `${Math.max(0, Math.min(1, objectiveCount > 0 ? squaresCleared / objectiveCount : 0))}` }} />
          </div>
        </article>
      </div>

      <section className="completion-seed-card">
        <div className="completion-seed-heading">
          <span>Replay Seed</span>
          <button
            className="secondary-button completion-seed-copy-button"
            type="button"
            onClick={handleCopySeed}
          >
            Copy Seed
          </button>
        </div>
        <code className="completion-seed-value">{exportSeed || "Seed unavailable."}</code>
        {copyStatus ? <p className="completion-seed-status">{copyStatus}</p> : null}
      </section>

      <div className="action-row completion-primary-actions">
        <button className="secondary-button" type="button" onClick={onNewExercise}>
          Do another one
        </button>
        <button className="primary-button" type="button" onClick={onRunBack}>
          Run that shi Back
        </button>
      </div>
    </section>
  );
}
