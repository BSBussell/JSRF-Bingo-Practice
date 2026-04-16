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
    : `Pick a starting area or resolve a seed before the session starts. Route guide videos default to ${isLearnPanelDefaultVisible ? "visible" : "hidden"} and can be toggled mid-session.`;
  const submitLabel = isRouteMode ? "Start Route Session" : "Start Practice Session";

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
          <div className="setup-grid setup-grid-seed-row">
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
                Entering a seed will lock all below settings to the provided seed. If you just want to generate a seed from the current settings, leave this blank and click "Copy Seed to Clipboard" to copy the generated seed for the current settings.
              </span>
              {resolvedSeedState.warning ? (
                <p className="setup-warning">{resolvedSeedState.warning}</p>
              ) : null}
            </label>

            <label className="setup-toggle-card">
              <div className="settings-row-copy">
                <strong>True random</strong>
                <p>you will spend more time moving across map and less time actually unlocking things but your funeral.</p>
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

          <div className="setup-grid setup-grid-two-column">
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
            </label>
          </div>

          <div className="setup-grid setup-grid-single-column">
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
                The session ends after this many squares (capped by current available pool: {effectiveObjectiveMax}).
                {isRouteMode ? " Route Mode keeps this at or above visible squares." : ""}
              </span>
            </label>
            {isRouteMode ? (
              <>
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
                    Route Mode shows this many live squares at once, from {ROUTE_VISIBLE_COUNT_MIN} to {effectiveRouteVisibleMax}, and maps them to the number keys `1-0`.
                  </span>
                </label>

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
              </>
            ) : null}
          </div>
        </div>

        <div className="setup-section">
          <div className="setup-section-copy">
            <h2>Excluded areas</h2>
            <p>
              Toggle individual areas, or by district.
            </p>
          </div>

          <div className="district-table-shell">
            <table className="district-table">
              <tbody>
                {areasByDistrict.map((districtGroup) => {
                  const districtExcluded = isDistrictExcluded(
                    effectiveDrillSettings,
                    districtGroup.district
                  );

                  return (
                    <tr key={districtGroup.district}>
                      <th scope="row">
                        <button
                          className={`district-cell-button ${districtExcluded ? "is-excluded" : ""}`}
                          type="button"
                          disabled={controlsLocked}
                          onClick={() => handleDistrictToggle(districtGroup.district)}
                        >
                          {districtGroup.label}
                        </button>
                      </th>
                      {districtGroup.areas.map((area) => {
                        const excluded = isAreaExcluded(effectiveDrillSettings, area);

                        return (
                          <td key={area}>
                            <button
                              className={`district-cell-button area-cell-button ${excluded ? "is-excluded" : ""}`}
                              type="button"
                              disabled={controlsLocked}
                              onClick={() => handleAreaToggle(area)}
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
        </div>

        <div className="setup-section">
          <div className="setup-section-copy">
            <h2>Square variance</h2>
          </div>

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
        </div>

        <div className="setup-section">
          <div className="setup-section-copy">
            <h2>Location Bias</h2>
          </div>

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
                <span className="setup-advanced-title">Advanced</span>
                <span className="field-hint">Fine-tune shift distances.</span>
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
        </div>

        <div className="setup-section">
          <div className="setup-section-copy">
            <h2>Resolved seed</h2>
            <p>
              {resolvedSeedMode === "manual"
                ? "Generate or copy a reproducible exported seed for the current settings."
                : `${formatSeedModeLabel(resolvedSeedMode)} is active. Manual generation controls are locked to the resolved session.`}
            </p>
          </div>

          <div className="seed-display-shell">
            <code className="seed-display">
              {displayedExportSeed || "Seed will be generated when you start or copy the session."}
            </code>
          </div>
          {resolvedSeedMode === "phrase" ? (
            <p className="field-hint">
              Copying exports the full reproducible session seed, not the original phrase.
            </p>
          ) : null}
          {manualError ? <p className="setup-error">{manualError}</p> : null}
          {copyStatus ? <p className="field-hint">{copyStatus}</p> : null}
        </div>

        <div className="setup-submit-row">
          <button className="primary-button setup-submit-button" type="submit">
            {submitLabel}
          </button>
          <button className="secondary-button" type="button" onClick={handleCopySeed}>
            Copy Seed to Clipboard
          </button>
        </div>
      </form>
    </section>
  );
}
