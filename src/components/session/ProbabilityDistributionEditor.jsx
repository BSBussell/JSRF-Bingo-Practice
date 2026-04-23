import { useEffect, useMemo, useRef } from "react";

import {
  DISTRICT_JUMP_BOUNDARY_STEP,
  DISTRICT_JUMP_DEPTHS,
  DISTRICT_JUMP_DISTRIBUTION_TOTAL,
  LEVEL_SHIFT_BOUNDARY_STEP,
  LEVEL_SHIFT_DISTRIBUTION_TOTAL,
  LEVEL_SHIFT_LENGTHS,
  buildDistrictJumpBoundaries,
  buildDistrictJumpDistributionFromBoundaries,
  buildLevelShiftBoundaries,
  buildLevelShiftDistributionFromBoundaries,
  normalizeDistrictJumpDistribution,
  normalizeLevelShiftDistribution
} from "../../lib/drill/drillSettings.js";

function formatProfilePercent(value) {
  return `${value}%`;
}

function formatDisplayDepth(depth) {
  return depth + 1;
}

const LEVEL_SHIFT_DISTRIBUTION_SEGMENTS = LEVEL_SHIFT_LENGTHS.map((length) => ({
  key: length,
  label: `${length} ${length === 1 ? "Level" : "Levels"}`,
  toneClassName: `distribution-tone-level-${length}`
}));

const DISTRICT_SHIFT_DISTRIBUTION_SEGMENTS = DISTRICT_JUMP_DEPTHS.map((depth) => ({
  key: depth,
  label: `Depth ${formatDisplayDepth(depth)}`,
  toneClassName: `distribution-tone-depth-${depth}`
}));

export function ProbabilityDistributionEditor({
  label,
  description,
  ariaLabel,
  value,
  disabled,
  segments,
  distributionTotal,
  boundaryStep,
  buildBoundaries,
  buildDistributionFromBoundaries,
  normalizeDistribution,
  onChange
}) {
  const barRef = useRef(null);
  const dragStateRef = useRef(null);
  const distribution = useMemo(() => normalizeDistribution(value), [normalizeDistribution, value]);
  const boundaries = useMemo(() => buildBoundaries(distribution), [buildBoundaries, distribution]);

  function applyBoundaryChange(boundaryIndex, nextBoundaryValue) {
    const currentBoundaries = buildBoundaries(distribution);
    const minimumBoundary = boundaryIndex === 0 ? 0 : currentBoundaries[boundaryIndex - 1];
    const maximumBoundary =
      boundaryIndex === currentBoundaries.length - 1
        ? distributionTotal
        : currentBoundaries[boundaryIndex + 1];
    const clampedBoundary = Math.max(
      minimumBoundary,
      Math.min(maximumBoundary, Math.round(nextBoundaryValue))
    );
    const nextBoundaries = currentBoundaries.slice();
    nextBoundaries[boundaryIndex] = clampedBoundary;
    onChange(buildDistributionFromBoundaries(nextBoundaries));
  }

  function updateBoundaryFromPointer(clientX) {
    const barElement = barRef.current;
    const activeBoundaryIndex = dragStateRef.current?.boundaryIndex;
    if (!barElement || !Number.isInteger(activeBoundaryIndex)) {
      return;
    }

    const bounds = barElement.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const ratio = (clientX - bounds.left) / bounds.width;
    applyBoundaryChange(activeBoundaryIndex, ratio * distributionTotal);
  }

  function handleBoundaryPointerDown(boundaryIndex, event) {
    if (disabled) {
      return;
    }

    dragStateRef.current = {
      boundaryIndex
    };
    event.preventDefault();
  }

  function handleBoundaryKeyDown(boundaryIndex, event) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applyBoundaryChange(boundaryIndex, boundaries[boundaryIndex] - boundaryStep);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      applyBoundaryChange(boundaryIndex, boundaries[boundaryIndex] + boundaryStep);
    }
  }

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragStateRef.current || disabled) {
        return;
      }

      event.preventDefault();
      updateBoundaryFromPointer(event.clientX);
    }

    function handlePointerEnd() {
      dragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [disabled, distribution]);

  return (
    <label className={`drill-slider-row ${disabled ? "is-disabled" : ""}`}>
      <div className="drill-slider-copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <div className="drill-slider-control">
        <div
          ref={barRef}
          className={`probability-distribution-editor ${disabled ? "is-disabled" : ""}`}
          aria-label={ariaLabel}
        >
          {segments.map((segment, index) => (
            <span
              key={segment.key}
              className={`probability-distribution-segment ${segment.toneClassName}`}
              style={{ width: `${distribution[index] ?? 0}%` }}
            />
          ))}
          {boundaries.map((boundary, boundaryIndex) => (
            <button
              key={boundaryIndex}
              className="probability-distribution-handle"
              type="button"
              style={{ left: `${boundary}%` }}
              disabled={disabled}
              aria-label={`Adjust the divider between ${segments[boundaryIndex]?.label} and ${segments[boundaryIndex + 1]?.label}`}
              onPointerDown={(event) => handleBoundaryPointerDown(boundaryIndex, event)}
              onKeyDown={(event) => handleBoundaryKeyDown(boundaryIndex, event)}
            />
          ))}
        </div>
        <div className="probability-distribution-legend">
          {segments.map((segment, index) => (
            <span key={segment.key} className="probability-distribution-chip">
              <span
                className={`probability-distribution-swatch ${segment.toneClassName}`}
                aria-hidden="true"
              />
              {`${segment.label} ${formatProfilePercent(distribution[index] ?? 0)}`}
            </span>
          ))}
        </div>
      </div>
    </label>
  );
}

export function LevelShiftDistributionEditor({ value, disabled, onChange }) {
  return (
    <ProbabilityDistributionEditor
      label="Level Shift Distribution"
      description="The odds for how far a level shift will move within the current district."
      ariaLabel="Level shift probability distribution"
      value={value}
      disabled={disabled}
      segments={LEVEL_SHIFT_DISTRIBUTION_SEGMENTS}
      distributionTotal={LEVEL_SHIFT_DISTRIBUTION_TOTAL}
      boundaryStep={LEVEL_SHIFT_BOUNDARY_STEP}
      buildBoundaries={buildLevelShiftBoundaries}
      buildDistributionFromBoundaries={buildLevelShiftDistributionFromBoundaries}
      normalizeDistribution={normalizeLevelShiftDistribution}
      onChange={onChange}
    />
  );
}

export function DistrictJumpDistributionEditor({ value, disabled, onChange }) {
  return (
    <ProbabilityDistributionEditor
      label="District Shift Distribution"
      description="The odds for how deep into a district you will go on district shift. Depth measured from Garage."
      ariaLabel="District jump probability distribution"
      value={value}
      disabled={disabled}
      segments={DISTRICT_SHIFT_DISTRIBUTION_SEGMENTS}
      distributionTotal={DISTRICT_JUMP_DISTRIBUTION_TOTAL}
      boundaryStep={DISTRICT_JUMP_BOUNDARY_STEP}
      buildBoundaries={buildDistrictJumpBoundaries}
      buildDistributionFromBoundaries={buildDistrictJumpDistributionFromBoundaries}
      normalizeDistribution={normalizeDistrictJumpDistribution}
      onChange={onChange}
    />
  );
}
