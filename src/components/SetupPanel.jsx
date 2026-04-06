import { useEffect, useState } from "react";
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
  VARIANCE_LABELS,
  VARIANCE_STEP,
  isAreaExcluded,
  isDistrictExcluded,
  normalizeDrillSettings,
  setDistrictExclusion,
  toggleAreaExclusion
} from "../lib/drillSettings.js";

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

export function SetupPanel({
  defaultArea,
  defaultDrillSettings,
  onStartSession,
  mode = "drills"
}) {
  const isLearnMode = mode === "learn";
  const [startingArea, setStartingArea] = useState(defaultArea);
  const [drillSettings, setDrillSettings] = useState(() =>
    normalizeDrillSettings(defaultDrillSettings)
  );

  useEffect(() => {
    setStartingArea(defaultArea);
  }, [defaultArea]);

  useEffect(() => {
    setDrillSettings(normalizeDrillSettings(defaultDrillSettings));
  }, [defaultDrillSettings]);

  function updateDrillSetting(key, value) {
    setDrillSettings((previousValue) => ({
      ...previousValue,
      [key]: value
    }));
  }

  function handleAreaToggle(area) {
    setDrillSettings((previousValue) => ({
      ...previousValue,
      excludedAreas: toggleAreaExclusion(previousValue.excludedAreas, area)
    }));
  }

  function handleDistrictToggle(district) {
    setDrillSettings((previousValue) => {
      const nextExcluded = !isDistrictExcluded(previousValue, district);

      return {
        ...previousValue,
        excludedAreas: setDistrictExclusion(
          previousValue.excludedAreas,
          district,
          nextExcluded
        )
      };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    onStartSession(startingArea, drillSettings);
  }

  return (
    <section className="panel setup-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{isLearnMode ? "Learn Mode" : "Drill Mode"}</p>
          <h1>{isLearnMode ? "Start a learn session" : "Start a drill session"}</h1>
        </div>
        <p className="panel-note">
          {isLearnMode
            ? "Pick a starting area and shape the drill set before the route video session begins."
            : "Pick a starting area and shape the drill set before the session starts."}
        </p>
      </div>

      <form className="setup-form setup-form-extended" onSubmit={handleSubmit}>
        <div className="setup-grid">
          <label className="field">
            <span>Starting area</span>
            <select
              name="startingArea"
              value={startingArea}
              required
              onChange={(event) => setStartingArea(event.target.value)}
            >
              {areaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
          </label>

          <label className="setup-toggle-card">
            <div className="settings-row-copy">
              <strong>True random</strong>
              <p>you will spend more time moving across map and less time actually unlocking things but your funeral.</p>
            </div>

            <span className="toggle-shell">
              <input
                type="checkbox"
                checked={drillSettings.trueRandom}
                onChange={(event) => updateDrillSetting("trueRandom", event.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true">
                <span className="toggle-thumb" />
              </span>
            </span>
          </label>
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
                    drillSettings,
                    districtGroup.district
                  );

                  return (
                    <tr key={districtGroup.district}>
                      <th scope="row">
                        <button
                          className={`district-cell-button ${districtExcluded ? "is-excluded" : ""}`}
                          type="button"
                          onClick={() => handleDistrictToggle(districtGroup.district)}
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
                value={drillSettings[field.key]}
                disabled={drillSettings.trueRandom}
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
                value={drillSettings[field.key]}
                disabled={drillSettings.trueRandom}
                onChange={(value) => updateDrillSetting(field.key, value)}
              />
            ))}
          </div>
        </div>

        <button className="primary-button setup-submit-button" type="submit">
          {isLearnMode ? "Start Learn Session" : "Start Drill Session"}
        </button>
      </form>
    </section>
  );
}
