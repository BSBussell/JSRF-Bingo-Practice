import { useEffect, useMemo, useRef, useState } from "react";

import { areaLabels, areasByDistrict } from "../data/areaMeta.js";
import { areaOptions } from "../data/objectives.js";
import {
  DistrictJumpDistributionEditor,
  LevelShiftDistributionEditor
} from "./ProbabilityDistributionEditor.jsx";
import { SegmentedChoice } from "./SegmentedChoice.jsx";
import {
  DEFAULT_DISTRICT_JUMP_DISTRIBUTION,
  DEFAULT_LEVEL_SHIFT_DISTRIBUTION,
  CATEGORY_VARIANCE_MAX,
  CATEGORY_VARIANCE_MIN,
  CATEGORY_VARIANCE_FIELDS,
  DRILL_MOVEMENT_FIELDS,
  MOVEMENT_VARIANCE_MAX,
  MOVEMENT_VARIANCE_MIN,
  MOVEMENT_LABELS,
  NUMBER_OF_OBJECTIVES_MIN,
  ROUTE_VISIBLE_COUNT_MAX,
  ROUTE_VISIBLE_COUNT_MIN,
  VARIANCE_LABELS,
  VARIANCE_STEP,
  isAreaExcluded,
  isDistrictExcluded,
  setDistrictExclusion,
  toggleAreaExclusion
} from "../lib/drill/drillSettings.js";
import {
  buildSessionSpecFromConfig,
  createRandomSeed,
  resolveSeedInput
} from "../lib/seed/sessionSeed.js";
import {
  buildSessionConfig,
  getSessionObjectiveMax,
  mergeSessionConfigIntoDrillSettings,
  normalizeDrillSettingsForSessionType
} from "../lib/session/sessionConfig.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../lib/session/sessionTypes.js";
import {
  ROUTE_REVEAL_MODE_BURST,
  ROUTE_REVEAL_MODE_LABELS,
  ROUTE_REVEAL_MODE_ROLLING
} from "../lib/session/routeRevealMode.js";

function VarianceSlider({
  label,
  min,
  max,
  labels = VARIANCE_LABELS,
  value,
  description,
  hint,
  disabled,
  onChange
}) {
  return (
    <label className={`drill-slider-row ${disabled ? "is-disabled" : ""}`}>
      <div className="drill-slider-copy">
        <strong>{label}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="drill-slider-control">
        <span className="drill-slider-value">{labels[value] ?? labels[0]}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={VARIANCE_STEP}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function distributionsMatch(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function formatSeedModeLabel(mode) {
  if (mode === "phrase") {
    return "Phrase seed";
  }

  if (mode === "exported") {
    return "Imported seed";
  }

  return "Generated seed";
}

function copyTextToClipboard(value) {
  return navigator.clipboard.writeText(value);
}

function SetupSection({ eyebrow, title, description, children }) {
  return (
    <section className="setup-section">
      <div className="setup-section-header">
        <div className="setup-section-copy">
          {eyebrow ? <p className="eyebrow setup-section-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function SetupActionBar({
  submitLabel,
  seedModeLabel,
  displayedExportSeed,
  copyStatus,
  manualError,
  seedFootnote,
  sessionSummary,
  onCopySeed
}) {
  const statusLabel = manualError || copyStatus || "Ready to generate";

  return (
    <div className="setup-action-bar" aria-label="Session generator">
      <div className="setup-action-status">
        <div className="setup-action-heading">
          {/* Left empty because it looks better */}
          <div className="setup-action-meta">
            <span className="badge">{seedModeLabel}</span>
            {sessionSummary.map((item) => (
              <span className="result-chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <code className="setup-action-seed">
          {displayedExportSeed || "Seed will be generated on start or copy."}
        </code>
        <p className={`setup-action-message ${manualError ? "is-error" : ""}`}>
          {statusLabel}
        </p>
        {seedFootnote ? <p className="setup-action-message">{seedFootnote}</p> : null}
      </div>

      <div className="setup-action-controls">
        <button className="primary-button setup-launch-button" type="submit">
          {submitLabel}
        </button>
        <button className="secondary-button" type="button" onClick={onCopySeed}>
          Copy Seed
        </button>
      </div>
    </div>
  );
}

function getDistrictExclusionState(drillSettings, districtGroup) {
  const excludedCount = districtGroup.areas.filter((area) =>
    isAreaExcluded(drillSettings, area)
  ).length;

  if (excludedCount === 0) {
    return "none";
  }

  if (excludedCount === districtGroup.areas.length) {
    return "all";
  }

  return "some";
}

function ExcludedAreasControl({
  drillSettings,
  disabled,
  onAreaToggle,
  onDistrictToggle
}) {
  return (
    <>
      <div className="district-table-shell">
        <table className="district-table">
          <tbody>
            {areasByDistrict.map((districtGroup) => {
              const districtExcluded = isDistrictExcluded(
                drillSettings,
                districtGroup.district
              );

              return (
                <tr key={districtGroup.district}>
                  <th scope="row">
                    <button
                      className={`district-cell-button ${districtExcluded ? "is-excluded" : ""}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => onDistrictToggle(districtGroup.district)}
                    >
                      {districtGroup.label}
                    </button>
                  </th>
                  {districtGroup.areas.map((area) => {
                    const excluded = isAreaExcluded(drillSettings, area);

                    return (
                      <td key={area}>
                        <button
                          className={`district-cell-button area-cell-button ${excluded ? "is-excluded" : ""}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => onAreaToggle(area)}
                        >
                          {areaLabels[area] ?? area}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="excluded-area-mobile" aria-label="Excluded areas by district">
        {areasByDistrict.map((districtGroup) => {
          const districtState = getDistrictExclusionState(drillSettings, districtGroup);
          const districtExcluded = districtState === "all";

          return (
            <section className="excluded-area-mobile-group" key={districtGroup.district}>
              <button
                className={`excluded-area-mobile-district is-${districtState}`}
                type="button"
                disabled={disabled}
                aria-pressed={districtExcluded}
                onClick={() => onDistrictToggle(districtGroup.district)}
              >
                {districtGroup.label}
              </button>

              <div className="excluded-area-mobile-chips">
                {districtGroup.areas.map((area) => {
                  const excluded = isAreaExcluded(drillSettings, area);

                  return (
                    <button
                      className={`excluded-area-mobile-chip ${excluded ? "is-excluded" : ""}`}
                      type="button"
                      key={area}
                      disabled={disabled}
                      aria-pressed={excluded}
                      onClick={() => onAreaToggle(area)}
                    >
                      {areaLabels[area] ?? area}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function SetupPanel({
  defaultArea,
  defaultDrillSettings,
  onStartSession,
  isLearnPanelDefaultVisible = false,
  sessionType = PRACTICE_SESSION_TYPE
}) {
  const isRouteMode = sessionType === ROUTE_SESSION_TYPE;
  const [startingArea, setStartingArea] = useState(defaultArea);
  const [drillSettings, setDrillSettings] = useState(() =>
    normalizeDrillSettingsForSessionType(defaultDrillSettings, sessionType)
  );
  const [seedInput, setSeedInput] = useState("");
  const [manualSeedState, setManualSeedState] = useState(null);
  const [manualError, setManualError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const lastAppliedExportSeedRef = useRef("");

  useEffect(() => {
    setStartingArea(defaultArea);
  }, [defaultArea]);

  useEffect(() => {
    setDrillSettings(normalizeDrillSettingsForSessionType(defaultDrillSettings, sessionType));
  }, [defaultDrillSettings, sessionType]);

  const resolvedSeedState = useMemo(
    () => resolveSeedInput(seedInput, sessionType),
    [seedInput, sessionType]
  );
  const resolvedSeedMode = resolvedSeedState.mode;
  const resolvedExportSeed = resolvedSeedState.exportSeed;
  const controlsLocked = resolvedSeedMode !== "manual";
  const resolvedConfig = resolvedSeedState.sessionSpec?.config ?? null;
  const effectiveStartingArea = resolvedConfig?.startingArea ?? startingArea;
  const effectiveDrillSettings = resolvedConfig ?? drillSettings;
  const effectiveObjectiveMax = getSessionObjectiveMax(effectiveDrillSettings);
  const effectiveObjectiveMin = isRouteMode
    ? Math.min(
        effectiveObjectiveMax,
        Math.max(NUMBER_OF_OBJECTIVES_MIN, effectiveDrillSettings.routeVisibleCount)
      )
    : NUMBER_OF_OBJECTIVES_MIN;
  const effectiveRouteVisibleMax = Math.max(
    ROUTE_VISIBLE_COUNT_MIN,
    Math.min(
      ROUTE_VISIBLE_COUNT_MAX,
      effectiveDrillSettings.numberOfObjectives,
      effectiveObjectiveMax
    )
  );
  const manualConfig = buildSessionConfig(startingArea, drillSettings);
  const manualConfigSignature = JSON.stringify(manualConfig);
  const advancedControlsDisabled = controlsLocked || effectiveDrillSettings.trueRandom;
  const distributionsAtDefault =
    distributionsMatch(
      effectiveDrillSettings.levelShiftDistribution,
      DEFAULT_LEVEL_SHIFT_DISTRIBUTION
    ) &&
    distributionsMatch(
      effectiveDrillSettings.districtJumpDistribution,
      DEFAULT_DISTRICT_JUMP_DISTRIBUTION
    );

  useEffect(() => {
    if (resolvedSeedMode === "exported" && resolvedExportSeed) {
      if (lastAppliedExportSeedRef.current !== resolvedExportSeed) {
        setStartingArea(resolvedSeedState.sessionSpec.config.startingArea);
        setDrillSettings((previousValue) =>
          mergeSessionConfigIntoDrillSettings(
            previousValue,
            resolvedSeedState.sessionSpec.config,
            sessionType
          )
        );
        setManualSeedState(null);
        setManualError("");
        lastAppliedExportSeedRef.current = resolvedExportSeed;
      }
      return;
    }

    lastAppliedExportSeedRef.current = "";
  }, [resolvedSeedMode, resolvedExportSeed, resolvedSeedState.sessionSpec, sessionType]);

  function clearManualDerivedState() {
    setManualSeedState(null);
    setManualError("");
    setCopyStatus("");
  }

  function updateDrillSetting(key, value) {
    clearManualDerivedState();
    setDrillSettings((previousValue) =>
      normalizeDrillSettingsForSessionType(
        {
          ...previousValue,
          [key]: value
        },
        sessionType
      )
    );
  }

  function updateDrillSettings(nextSettings) {
    clearManualDerivedState();
    setDrillSettings((previousValue) =>
      normalizeDrillSettingsForSessionType(
        {
          ...previousValue,
          ...nextSettings
        },
        sessionType
      )
    );
  }

  function handleAreaToggle(area) {
    clearManualDerivedState();
    setDrillSettings((previousValue) =>
      normalizeDrillSettingsForSessionType(
        {
          ...previousValue,
          excludedAreas: toggleAreaExclusion(previousValue.excludedAreas, area)
        },
        sessionType
      )
    );
  }

  function handleDistrictToggle(district) {
    clearManualDerivedState();
    setDrillSettings((previousValue) => {
      const nextExcluded = !isDistrictExcluded(previousValue, district);

      return normalizeDrillSettingsForSessionType(
        {
          ...previousValue,
          excludedAreas: setDistrictExclusion(
            previousValue.excludedAreas,
            district,
            nextExcluded
          )
        },
        sessionType
      );
    });
  }

  function handleStartingAreaChange(value) {
    clearManualDerivedState();
    setStartingArea(value);
  }

  function handleSeedInputChange(value) {
    setSeedInput(value);
    setCopyStatus("");
  }

  function createManualSeed() {
    try {
      const nextSeedState = {
        ...buildSessionSpecFromConfig(manualConfig, createRandomSeed(), sessionType),
        configSignature: manualConfigSignature
      };

      setManualSeedState(nextSeedState);
      setManualError("");
      return nextSeedState;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setManualSeedState(null);
      setManualError(message);
      return null;
    }
  }

  function resolveLaunchState() {
    if (resolvedSeedMode !== "manual") {
      setManualError("");
      return {
        sessionSpec: resolvedSeedState.sessionSpec,
        exportSeed: resolvedSeedState.exportSeed
      };
    }

    if (manualSeedState?.configSignature === manualConfigSignature) {
      setManualError("");
      return manualSeedState;
    }

    return createManualSeed();
  }

  async function handleCopySeed() {
    const launchState = resolveLaunchState();
    if (!launchState?.exportSeed) {
      return;
    }

    try {
      await copyTextToClipboard(launchState.exportSeed);
      setCopyStatus("Seed copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const launchState = resolveLaunchState();
    if (!launchState?.sessionSpec) {
      return;
    }

    onStartSession({
      sessionSpec: launchState.sessionSpec,
      exportSeed: launchState.exportSeed
    });
  }

  const displayedExportSeed =
    resolvedSeedMode !== "manual"
      ? resolvedSeedState.exportSeed
      : manualSeedState?.configSignature === manualConfigSignature
        ? manualSeedState.exportSeed
        : "";
  const modeEyebrow = isRouteMode ? "Route Mode" : "Practice Mode";
  const sessionTitle = isRouteMode ? "Start a route session" : "Start a practice session";
  const sessionNote = isRouteMode
    ? "Pick a starting area, choose how many squares stay visible, or resolve a seed before the route begins."
    : `Pick a starting area or enter a seed before the session starts. Route guide videos default to ${isLearnPanelDefaultVisible ? "visible" : "hidden"} and can be toggled mid-session.`;
  const submitLabel = isRouteMode ? "Start Route Session" : "Start Practice Session";
  const sessionSummary = [
    `${effectiveDrillSettings.numberOfObjectives} square${effectiveDrillSettings.numberOfObjectives === 1 ? "" : "s"}`,
    areaLabels[effectiveStartingArea] ?? effectiveStartingArea
  ];

  if (isRouteMode) {
    sessionSummary.push(
      `${effectiveDrillSettings.routeVisibleCount} visible`,
      ROUTE_REVEAL_MODE_LABELS[effectiveDrillSettings.routeRevealMode]
    );
  }

  if (effectiveDrillSettings.trueRandom) {
    sessionSummary.push("True random");
  }

  return (
    <section className="panel setup-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{modeEyebrow}</p>
          <h1>{sessionTitle}</h1>
        </div>
        <p className="panel-note">{sessionNote}</p>
      </div>

      <form className="setup-form setup-form-extended" onSubmit={handleSubmit}>
        <div className="setup-top-stack">
          <SetupSection
            eyebrow=""
            title="Seed"
            description="Paste a phrase or exported seed to replay a known setup. Leave it blank to generate from the controls below."
          >
            <label className="field">
              <span>Seed input</span>
              <textarea
                className="seed-textarea"
                rows={1}
                value={seedInput}
                placeholder="Funny Seed Name Here"
                onChange={(event) => handleSeedInputChange(event.target.value)}
              />
              <span className="field-hint">
                Active seeds lock manual controls so the exported session stays reproducible.
              </span>
              {resolvedSeedState.warning ? (
                <p className="setup-warning">{resolvedSeedState.warning}</p>
              ) : null}
            </label>
          </SetupSection>

          <SetupSection
            eyebrow=""
            title="Core settings"
            description=""
          >
            <div className="setup-grid setup-grid-two-column setup-grid-run-profile">
              <label className="field">
                <span>Starting area</span>
                <select
                  name="startingArea"
                  value={effectiveStartingArea}
                  required
                  disabled={controlsLocked}
                  onChange={(event) => handleStartingAreaChange(event.target.value)}
                >
                  {areaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Where you are when you want to start
                </span>
              </label>

              <label className="field">
                <span>Number of squares</span>
                <input
                  type="number"
                  min={effectiveObjectiveMin}
                  max={effectiveObjectiveMax}
                  value={effectiveDrillSettings.numberOfObjectives}
                  disabled={controlsLocked}
                  onChange={(event) =>
                    updateDrillSetting("numberOfObjectives", Number(event.target.value))
                  }
                />
                <span className="field-hint">
                  Capped by current available pool: {effectiveObjectiveMax}.
                </span>
              </label>

              {isRouteMode ? (
                <label className="field">
                  <span>Visible squares</span>
                  <input
                    type="number"
                    min={ROUTE_VISIBLE_COUNT_MIN}
                    max={effectiveRouteVisibleMax}
                    value={effectiveDrillSettings.routeVisibleCount}
                    disabled={controlsLocked}
                    onChange={(event) =>
                      updateDrillSetting("routeVisibleCount", Number(event.target.value))
                    }
                  />
                  <span className="field-hint">
                    Route Mode shows this many live squares at once, from {ROUTE_VISIBLE_COUNT_MIN} to {effectiveRouteVisibleMax}.
                  </span>
                </label>
              ) : null}

              {isRouteMode ? (
                <SegmentedChoice
                  label="Reveal mode"
                  value={effectiveDrillSettings.routeRevealMode}
                  disabled={controlsLocked}
                  options={[
                    {
                      value: ROUTE_REVEAL_MODE_ROLLING,
                      label: ROUTE_REVEAL_MODE_LABELS[ROUTE_REVEAL_MODE_ROLLING]
                    },
                    {
                      value: ROUTE_REVEAL_MODE_BURST,
                      label: ROUTE_REVEAL_MODE_LABELS[ROUTE_REVEAL_MODE_BURST]
                    }
                  ]}
                  hint={`${ROUTE_REVEAL_MODE_LABELS[ROUTE_REVEAL_MODE_ROLLING]} refills each cleared slot immediately. ${ROUTE_REVEAL_MODE_LABELS[ROUTE_REVEAL_MODE_BURST]} waits until the whole visible wave is cleared before revealing the next group.`}
                  onChange={(value) => updateDrillSetting("routeRevealMode", value)}
                />
              ) : null}

              <label className="setup-toggle-card setup-toggle-card-compact">
                <div className="settings-row-copy">
                  <strong>True random</strong>
                  <p>Just pulls random squares for you. Might send you running across the map.</p>
                </div>

                <span className="toggle-shell">
                  <input
                    type="checkbox"
                    checked={effectiveDrillSettings.trueRandom}
                    disabled={controlsLocked}
                    onChange={(event) => updateDrillSetting("trueRandom", event.target.checked)}
                  />
                  <span className="toggle-track" aria-hidden="true">
                    <span className="toggle-thumb" />
                  </span>
                </span>
              </label>
            </div>
          </SetupSection>
        </div>

        <SetupSection
          eyebrow="Objective pool"
          title="Excluded areas"
          description="Toggle individual areas, or by district."
        >
          <ExcludedAreasControl
            drillSettings={effectiveDrillSettings}
            disabled={controlsLocked}
            onAreaToggle={handleAreaToggle}
            onDistrictToggle={handleDistrictToggle}
          />
        </SetupSection>

        <SetupSection
          eyebrow="Tuning"
          title="Square variance"
          description={effectiveDrillSettings.trueRandom ? "Disabled while true random is active." : ""}
        >
          <div className="drill-slider-list">
            {CATEGORY_VARIANCE_FIELDS.map((field) => (
              <VarianceSlider
                key={field.key}
                label={field.label}
                min={CATEGORY_VARIANCE_MIN}
                max={CATEGORY_VARIANCE_MAX}
                labels={VARIANCE_LABELS}
                value={effectiveDrillSettings[field.key]}
                disabled={controlsLocked || effectiveDrillSettings.trueRandom}
                onChange={(value) => updateDrillSetting(field.key, value)}
              />
            ))}
          </div>
        </SetupSection>

        <SetupSection
          eyebrow="Level Flow"
          title="Location bias"
          description={effectiveDrillSettings.trueRandom ? "Disabled while true random is active." : "Adjust how often the generator asks you to move between levels and districts."}
        >
          <div className="drill-slider-list">
            {DRILL_MOVEMENT_FIELDS.map((field) => (
              <VarianceSlider
                key={field.key}
                label={field.label}
                description={field.description}
                min={MOVEMENT_VARIANCE_MIN}
                max={MOVEMENT_VARIANCE_MAX}
                labels={MOVEMENT_LABELS}
                value={effectiveDrillSettings[field.key]}
                disabled={controlsLocked || effectiveDrillSettings.trueRandom}
                onChange={(value) => updateDrillSetting(field.key, value)}
              />
            ))}
            <details className={`setup-advanced-panel ${advancedControlsDisabled ? "is-disabled" : ""}`}>
              <summary className="setup-advanced-summary">
                <span className="setup-advanced-title">Advanced shift distances</span>
                <span className="field-hint">Tune shift depth.</span>
              </summary>
              <div className="setup-advanced-content">
                <div className="drill-slider-list">
                  <LevelShiftDistributionEditor
                    value={effectiveDrillSettings.levelShiftDistribution}
                    disabled={advancedControlsDisabled}
                    onChange={(value) => updateDrillSetting("levelShiftDistribution", value)}
                  />
                  <DistrictJumpDistributionEditor
                    value={effectiveDrillSettings.districtJumpDistribution}
                    disabled={advancedControlsDisabled}
                    onChange={(value) => updateDrillSetting("districtJumpDistribution", value)}
                  />
                </div>
                <div className="setup-advanced-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={advancedControlsDisabled || distributionsAtDefault}
                    onClick={() =>
                      updateDrillSettings({
                        levelShiftDistribution: DEFAULT_LEVEL_SHIFT_DISTRIBUTION.slice(),
                        districtJumpDistribution: DEFAULT_DISTRICT_JUMP_DISTRIBUTION.slice()
                      })
                    }
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </details>
          </div>
        </SetupSection>

        <SetupActionBar
          submitLabel={submitLabel}
          seedModeLabel={formatSeedModeLabel(resolvedSeedMode)}
          displayedExportSeed={displayedExportSeed}
          copyStatus={copyStatus}
          manualError={manualError}
          seedFootnote={
            resolvedSeedMode === "phrase"
              ? "Copying exports the full reproducible session seed, not the original phrase."
              : ""
          }
          sessionSummary={sessionSummary}
          onCopySeed={handleCopySeed}
        />
      </form>
    </section>
  );
}
