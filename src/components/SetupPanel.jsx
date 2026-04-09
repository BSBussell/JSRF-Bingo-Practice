import { useEffect, useMemo, useRef, useState } from "react";

import { areaLabels, areasByDistrict } from "../data/areaMeta.js";
import { areaOptions } from "../data/objectives.js";
import {
  CATEGORY_VARIANCE_MAX,
  CATEGORY_VARIANCE_MIN,
  CATEGORY_VARIANCE_FIELDS,
  DRILL_MOVEMENT_FIELDS,
  MOVEMENT_VARIANCE_MAX,
  MOVEMENT_VARIANCE_MIN,
  MOVEMENT_LABELS,
  NUMBER_OF_OBJECTIVES_MAX,
  NUMBER_OF_OBJECTIVES_MIN,
  getAvailableObjectiveCount,
  VARIANCE_LABELS,
  VARIANCE_STEP,
  isAreaExcluded,
  isDistrictExcluded,
  normalizeDrillSettings,
  setDistrictExclusion,
  toggleAreaExclusion
} from "../lib/drill/drillSettings.js";
import {
  buildSessionConfig,
  buildSessionSpecFromConfig,
  createRandomSeed,
  resolveSeedInput
} from "../lib/seed/sessionSeed.js";

function VarianceSlider({
  label,
  min,
  max,
  labels = VARIANCE_LABELS,
  value,
  disabled,
  onChange
}) {
  return (
    <label className={`drill-slider-row ${disabled ? "is-disabled" : ""}`}>
      <div className="drill-slider-copy">
        <strong>{label}</strong>
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
    </label>
  );
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
  isLearnPanelDefaultVisible = false
}) {
  const [startingArea, setStartingArea] = useState(defaultArea);
  const [drillSettings, setDrillSettings] = useState(() =>
    normalizeDrillSettings(defaultDrillSettings)
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
    setDrillSettings(normalizeDrillSettings(defaultDrillSettings));
  }, [defaultDrillSettings]);

  const resolvedSeedState = useMemo(() => resolveSeedInput(seedInput), [seedInput]);
  const resolvedSeedMode = resolvedSeedState.mode;
  const resolvedExportSeed = resolvedSeedState.exportSeed;
  const controlsLocked = resolvedSeedMode !== "manual";
  const resolvedConfig = resolvedSeedState.sessionSpec?.config ?? null;
  const effectiveStartingArea = resolvedConfig?.startingArea ?? startingArea;
  const effectiveDrillSettings = resolvedConfig ?? drillSettings;
  const effectiveObjectiveMax = Math.max(
    NUMBER_OF_OBJECTIVES_MIN,
    Math.min(NUMBER_OF_OBJECTIVES_MAX, getAvailableObjectiveCount(effectiveDrillSettings))
  );
  const manualConfig = buildSessionConfig(startingArea, drillSettings);
  const manualConfigSignature = JSON.stringify(manualConfig);

  useEffect(() => {
    if (resolvedSeedMode === "exported" && resolvedExportSeed) {
      if (lastAppliedExportSeedRef.current !== resolvedExportSeed) {
        setStartingArea(resolvedSeedState.sessionSpec.config.startingArea);
        setDrillSettings(resolvedSeedState.sessionSpec.config);
        setManualSeedState(null);
        setManualError("");
        lastAppliedExportSeedRef.current = resolvedExportSeed;
      }
      return;
    }

    lastAppliedExportSeedRef.current = "";
  }, [resolvedSeedMode, resolvedExportSeed]);

  function clearManualDerivedState() {
    setManualSeedState(null);
    setManualError("");
    setCopyStatus("");
  }

  function updateDrillSetting(key, value) {
    clearManualDerivedState();
    setDrillSettings((previousValue) =>
      normalizeDrillSettings({
        ...previousValue,
        [key]: value
      })
    );
  }

  function handleAreaToggle(area) {
    clearManualDerivedState();
    setDrillSettings((previousValue) =>
      normalizeDrillSettings({
        ...previousValue,
        excludedAreas: toggleAreaExclusion(previousValue.excludedAreas, area)
      })
    );
  }

  function handleDistrictToggle(district) {
    clearManualDerivedState();
    setDrillSettings((previousValue) => {
      const nextExcluded = !isDistrictExcluded(previousValue, district);

      return normalizeDrillSettings({
        ...previousValue,
        excludedAreas: setDistrictExclusion(
          previousValue.excludedAreas,
          district,
          nextExcluded
        )
      });
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
        ...buildSessionSpecFromConfig(manualConfig, createRandomSeed()),
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

  return (
    <section className="panel setup-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Practice Mode</p>
          <h1>Start a practice session</h1>
        </div>
        <p className="panel-note">
          Pick a starting area or resolve a seed before the session starts.
          Route guide videos default to {isLearnPanelDefaultVisible ? "visible" : "hidden"} and can
          be toggled mid-session.
        </p>
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
              <span>Number of objectives</span>
              <input
                type="number"
                min={NUMBER_OF_OBJECTIVES_MIN}
                max={effectiveObjectiveMax}
                value={effectiveDrillSettings.numberOfObjectives}
                disabled={controlsLocked}
                onChange={(event) =>
                  updateDrillSetting("numberOfObjectives", Number(event.target.value))
                }
              />
              <span className="field-hint">
                The session ends after this many objectives (capped by current available pool: {effectiveObjectiveMax}).
              </span>
            </label>
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
                min={MOVEMENT_VARIANCE_MIN}
                max={MOVEMENT_VARIANCE_MAX}
                labels={MOVEMENT_LABELS}
                value={effectiveDrillSettings[field.key]}
                disabled={controlsLocked || effectiveDrillSettings.trueRandom}
                onChange={(value) => updateDrillSetting(field.key, value)}
              />
            ))}
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
          {resolvedSeedState.warning ? (
            <p className="setup-warning">{resolvedSeedState.warning}</p>
          ) : null}
          {manualError ? <p className="setup-error">{manualError}</p> : null}
          {copyStatus ? <p className="field-hint">{copyStatus}</p> : null}
        </div>

        <div className="setup-submit-row">
          <button className="primary-button setup-submit-button" type="submit">
            Start Practice Session
          </button>
          <button className="secondary-button" type="button" onClick={handleCopySeed}>
            Copy Seed to Clipboard
          </button>
        </div>
      </form>
    </section>
  );
}
