import { useEffect, useState } from "react";

import { formatDuration } from "../hooks/useTimer.js";
import { FireworkBurst } from "./FireworkBurst.jsx";

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

function formatDurationDelta(durationMs) {
  const safeDurationMs = Number.isFinite(durationMs) ? durationMs : 0;
  const prefix = safeDurationMs > 0 ? "+" : safeDurationMs < 0 ? "-" : "";

  return `${prefix}${formatDuration(Math.abs(safeDurationMs))}`;
}

function renderRecapFactValue(fact) {
  if (!fact) {
    return "";
  }

  if (fact.valueType === "duration") {
    return formatDuration(fact.durationMs);
  }

  if (fact.valueType === "count") {
    return String(fact.count ?? 0);
  }

  if (fact.valueType === "text") {
    return fact.value ?? "";
  }

  if (fact.valueType === "seed-pb-status") {
    if (Number.isFinite(fact.pbDurationMs)) {
      return formatDuration(fact.pbDurationMs);
    }

    return "No prior attempts";
  }

  return "";
}

function renderRecapFactDetail(fact) {
  if (!fact) {
    return "";
  }

  if (fact.detail) {
    return fact.detail;
  }

  if (
    fact.valueType === "seed-pb-status" &&
    Number.isFinite(fact.deltaMs)
  ) {
    return `${formatDurationDelta(fact.deltaMs)} vs PB`;
  }

  return "";
}

function renderRecapFactDetailNode(fact) {
  if (Array.isArray(fact?.detailSegments) && fact.detailSegments.length > 0) {
    return (
      <p className="completion-recap-detail">
        {fact.detailSegments.map((segment, index) => (
          <span
            className={segment.separator ? "completion-recap-detail-separator" : "completion-recap-detail-segment"}
            data-district={segment.district || undefined}
            key={`${segment.label}-${index}`}
          >
            {segment.label}
          </span>
        ))}
      </p>
    );
  }

  const detail = renderRecapFactDetail(fact);

  return detail ? <p>{detail}</p> : null;
}

export function CompletionPanel({
  completionSummary,
  completionRecap,
  onNewExercise,
  onRunBack,
  onCopySeed,
  backdrop
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
  const isRouteCompletion = completionSummary.sessionType === "route";
  const squaresCleared = Number.isInteger(completionSummary.squaresCleared)
    ? Math.min(objectiveCount, Math.max(0, completionSummary.squaresCleared))
    : objectiveCount;
  const recapFacts = Array.isArray(completionRecap?.facts) ? completionRecap.facts : [];
  const attemptsFact = completionRecap?.attempts ?? null;
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
      <span className="completion-reward-sheen" aria-hidden="true" />
      <span className="completion-reward-burst-shell" aria-hidden="true">
        <FireworkBurst
          className="completion-reward-burst"
          backdrop={backdrop}
          bursts={[
            { particleCount: 22, x: 0.5, y: 0.24, radiusScale: 1.2, speedScale: 0.72, gravityScale: 0.3 },
            { particleCount: 10, x: 0.22, y: 0.36, delayMs: 90, radiusScale: 0.9, speedScale: 0.56, gravityScale: 0.26 },
            { particleCount: 10, x: 0.78, y: 0.36, delayMs: 130, radiusScale: 0.9, speedScale: 0.56, gravityScale: 0.26 }
          ]}
        />
      </span>
      <div className="completion-crest" aria-hidden="true">
        <span className="completion-crest-line" />
        <span className="completion-crest-particle" style={crestParticleStyle} />
        <span className="completion-crest-line" />
      </div>

      <div className="panel-heading compact completion-heading">
        <div>
          <p className="eyebrow">{isRouteCompletion ? "Route Complete" : "Drill Complete"}</p>
          <h2>You did it!</h2>
        </div>
      </div>

      {recapFacts.length > 0 ? (
        <section className="completion-recap" aria-label="Completion recap">
          <div className="completion-recap-grid">
            {recapFacts.map((fact) => {
              return (
                <article
                  className={`completion-recap-item ${fact.tone === "win" ? "is-win" : ""}`}
                  key={fact.key}
                >
                  <span>{fact.label}</span>
                  <strong>{renderRecapFactValue(fact)}</strong>
                  {renderRecapFactDetailNode(fact)}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="completion-summary-grid">
          <article className="completion-stat completion-total-stat">
            <span>{isRouteCompletion ? "Total Route Time" : "Total Drill Time"}</span>
            <strong>{formatDuration(completionSummary.totalDurationMs)}</strong>
            <p className="completion-stat-note">Full run timer, pause-adjusted.</p>
          </article>
          <article className="completion-stat completion-objective-stat">
            <span>Squares Cleared</span>
            <strong>{squaresCleared}</strong>
            <p className="completion-stat-note">Completed squares in this run.</p>
          </article>
        </div>
      )}

      {attemptsFact ? (
        <p className="completion-attempts">
          Attempts: <strong>{renderRecapFactValue(attemptsFact)}</strong>
        </p>
      ) : null}

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
          Gimme a new seed
        </button>
        <button className="primary-button reward-button" type="button" onClick={onRunBack}>
          Run that shi Back
        </button>
      </div>
    </section>
  );
}
