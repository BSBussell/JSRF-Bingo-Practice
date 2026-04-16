import { useEffect, useState } from "react";
import {
  createHotkeyBinding,
  formatHotkeyBinding,
  hasHotkeyModifier,
  HOTKEY_ACTIONS,
  isModifierOnlyCode
} from "../lib/hotkeys.js";
import { isTauriRuntime } from "../lib/runtime.js";
import {
  BACKDROP_DENSITY_FIELDS,
  BACKDROP_DIRECTION_OPTIONS,
  BACKDROP_MOTION_FIELDS,
  BACKDROP_SPAWN_ZONE_OPTIONS,
  CORE_COLOR_FIELDS,
  createDefaultCustomTheme,
  CUSTOM_THEME_ID,
  HAZE_COLOR_FIELDS,
  PARTICLE_APPEARANCE_FIELDS,
  PARTICLE_COLOR_FIELDS,
  THEME_OPTIONS
} from "../lib/theme/index.js";

function HotkeyRow({
  action,
  hotkey,
  isCapturing,
  onBeginCapture,
  onClearHotkey
}) {
  const isDesktopGlobalRejected = isTauriRuntime() && hotkey && !hasHotkeyModifier(hotkey);

  return (
    <div className="settings-row hotkey-settings-row">
      <div className="settings-row-copy">
        <strong>{action.label}</strong>
        <p>{action.description}</p>
        {isDesktopGlobalRejected ? (
          <p className="settings-inline-warning">
            Desktop-global mode rejects single-key bindings. This one will only work while focused.
          </p>
        ) : null}
      </div>

      <div className="settings-row-actions">
        <button
          className={`secondary-button hotkey-button ${isCapturing ? "is-capturing" : ""}`}
          type="button"
          onClick={() => {
            if (isCapturing) {
              onBeginCapture(null);
              return;
            }

            onBeginCapture(action.key);
          }}
        >
          {isCapturing ? "Press combo" : formatHotkeyBinding(hotkey)}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => onClearHotkey(action.key)}
          disabled={!hotkey}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ToggleField({ label, description, checked, onChange }) {
  return (
    <label className="settings-row settings-toggle-row">
      <div className="settings-row-copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>

      <span className="toggle-shell">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-track" aria-hidden="true">
          <span className="toggle-thumb" />
        </span>
      </span>
    </label>
  );
}

function ThemeColorField({ label, description, value, onChange }) {
  return (
    <label className="theme-control">
      <span className="theme-control-label">{label}</span>
      <span className="theme-control-description">{description}</span>
      <span className="theme-color-input">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <span className="theme-control-value">{value.toUpperCase()}</span>
      </span>
    </label>
  );
}

function ThemeRangeField({ label, description, value, min, max, step, onChange }) {
  return (
    <label className="theme-control">
      <span className="theme-control-label">{label}</span>
      <span className="theme-control-description">{description}</span>
      <span className="theme-range-input">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
        <span className="theme-control-value">{value.toFixed(2)}</span>
      </span>
    </label>
  );
}

function ThemeSelectField({ label, description, value, options, onChange }) {
  return (
    <label className="theme-control">
      <span className="theme-control-label">{label}</span>
      <span className="theme-control-description">{description}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResetDataModal({ hasActiveSession, onClose, onConfirm }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="panel modal-card danger-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-data-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Warning</p>
        <h2 id="reset-data-title">Reset all trainer data?</h2>
        <p className="modal-copy">
          This clears your current session, drill history, personal bests, area stats, and all saved
          settings.
        </p>
        {hasActiveSession ? (
          <p className="modal-copy modal-warning">
            A live session is running right now. Resetting will end it immediately.
          </p>
        ) : null}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Keep Data
          </button>
          <button className="secondary-button danger-button" type="button" onClick={onConfirm}>
            Reset Everything
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeSection({ title, copy, children, footer = null }) {
  return (
    <div className="settings-theme-section">
      <div className="settings-theme-section-header">
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
      <div className="settings-theme-section-body">{children}</div>
      {footer ? <div className="settings-theme-section-footer">{footer}</div> : null}
    </div>
  );
}

function ThemeGroup({ title, copy, children }) {
  return (
    <div className="settings-theme-group">
      <div className="settings-theme-group-copy">
        <h4>{title}</h4>
        {copy ? <p>{copy}</p> : null}
      </div>
      <div className="theme-control-grid">{children}</div>
    </div>
  );
}

export function SettingsPanel({
  settings,
  hasActiveSession,
  capturingAction,
  onBeginHotkeyCapture,
  onCancelHotkeyCapture,
  onUpdateSetting,
  onUpdateHotkey,
  onClearHotkey,
  onResetAllData
}) {
  const [isResetOpen, setIsResetOpen] = useState(false);
  const activeThemeOption = THEME_OPTIONS.find((option) => option.value === settings.themeId) ?? THEME_OPTIONS[0];

  function updateCustomTheme(key, value) {
    onUpdateSetting("customTheme", {
      ...settings.customTheme,
      [key]: value
    });
  }

  function updateBackdrop(section, key, value) {
    onUpdateSetting("customTheme", {
      ...settings.customTheme,
      backdrop: {
        ...settings.customTheme.backdrop,
        [section]: {
          ...settings.customTheme.backdrop[section],
          [key]: value
        }
      }
    });
  }

  useEffect(() => {
    if (!capturingAction) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelHotkeyCapture();
        return;
      }

      if (event.key === "Tab") {
        onCancelHotkeyCapture();
        return;
      }

      if (isModifierOnlyCode(event.code)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Backspace" || event.code === "Delete") {
        onClearHotkey(capturingAction);
        onCancelHotkeyCapture();
        return;
      }

      onUpdateHotkey(
        capturingAction,
        createHotkeyBinding(event.code, {
          ctrl: event.ctrlKey,
          alt: event.altKey,
          shift: event.shiftKey,
          meta: event.metaKey
        })
      );
      onCancelHotkeyCapture();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    capturingAction,
    onCancelHotkeyCapture,
    onClearHotkey,
    onUpdateHotkey
  ]);

  return (
    <>
      <section className="panel settings-panel">
        <div className="panel-heading settings-heading">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Trainer controls, playback, and theme</h1>
          </div>
          <p className="panel-note">
            On the web version, hotkeys only work while the trainer is focused.
            For global hotkeys, use the desktop version!
          </p>
        </div>

        <div className="settings-section">
          <div className="settings-section-copy">
            <h2>Theme</h2>
            <p>Swap presets instantly or mess with all the knobs yourself!</p>
          </div>
          <div className="settings-list">
            <div className="settings-row settings-theme-selector-row">
              <div className="settings-row-copy">
                <strong>Active theme</strong>
                <p>{activeThemeOption.description}</p>
              </div>
              <div className="settings-row-actions settings-theme-actions">
                <label className="field settings-inline-field">
                  <span>Theme preset</span>
                  <select
                    value={settings.themeId}
                    onChange={(event) => onUpdateSetting("themeId", event.target.value)}
                  >
                    {THEME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {settings.themeId === CUSTOM_THEME_ID ? (
            <div className="settings-theme-layout">
              <ThemeSection
                title="Core Theme"
                copy="Defines the core application look."
              >
                <div className="theme-control-grid">
                  {CORE_COLOR_FIELDS.map((field) => (
                    <ThemeColorField
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={settings.customTheme[field.key]}
                      onChange={(value) => updateCustomTheme(field.key, value)}
                    />
                  ))}
                  <ThemeRangeField
                    label="Corner radius"
                    description="Rounds panels, cards, and controls without changing layout."
                    value={settings.customTheme.cornerRadius}
                    min={0.2}
                    max={3}
                    step={0.05}
                    onChange={(value) => updateCustomTheme("cornerRadius", value)}
                  />
                  <ThemeRangeField
                    label="Global glow"
                    description="Overall glow strength for UI highlights and haze."
                    value={settings.customTheme.glowIntensity}
                    min={0}
                    max={4}
                    step={0.05}
                    onChange={(value) => updateCustomTheme("glowIntensity", value)}
                  />
                </div>
              </ThemeSection>

              <ThemeSection
                title="Backdrop Style"
                copy="Controls the ambient backdrop atmosphere."
              >
                <ThemeGroup
                  title="Haze palette"
                  copy="Set the atmospheric haze tones behind the particle field."
                >
                  {HAZE_COLOR_FIELDS.map((field) => (
                    <ThemeColorField
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={settings.customTheme.backdrop.colors[field.key]}
                      onChange={(value) => updateBackdrop("colors", field.key, value)}
                    />
                  ))}
                </ThemeGroup>
              </ThemeSection>

              <ThemeSection
                title="Particle Behavior"
                copy="Shapes how particles move and behave. Thought it'd be fun to expose these knobs!"
                footer={(
                  <div className="theme-reset-row">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onUpdateSetting("customTheme", createDefaultCustomTheme())}
                    >
                      Reset Custom Theme
                    </button>
                  </div>
                )}
              >
                <ThemeGroup
                  title="Color"
                  copy="Set the base tint and bright core used by each particle."
                >
                  {PARTICLE_COLOR_FIELDS.map((field) => (
                    <ThemeColorField
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={settings.customTheme.backdrop.colors[field.key]}
                      onChange={(value) => updateBackdrop("colors", field.key, value)}
                    />
                  ))}
                </ThemeGroup>

                <ThemeGroup
                  title="Appearance"
                  copy="Control how bright, glowy, large, and twinkly the particles feel."
                >
                  {PARTICLE_APPEARANCE_FIELDS.map((field) => (
                    <ThemeRangeField
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={settings.customTheme.backdrop.appearance[field.key]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onChange={(value) => updateBackdrop("appearance", field.key, value)}
                    />
                  ))}
                </ThemeGroup>

                <ThemeGroup
                  title="Motion"
                  copy="Shape the moving particles: rising sparks, falling dust, or floating motes."
                >
                  <ThemeSelectField
                    label="Direction"
                    description="Sets whether particles rise, fall, or lazily float."
                    value={settings.customTheme.backdrop.motion.direction}
                    options={BACKDROP_DIRECTION_OPTIONS}
                    onChange={(value) => updateBackdrop("motion", "direction", value)}
                  />
                  {BACKDROP_MOTION_FIELDS.map((field) => (
                    <ThemeRangeField
                      key={field.key}
                      label={field.label}
                      description={field.description}
                      value={settings.customTheme.backdrop.motion[field.key]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      onChange={(value) => updateBackdrop("motion", field.key, value)}
                    />
                  ))}
                </ThemeGroup>

                <ThemeGroup
                  title="Density & Spawn"
                  copy="Control how many particles appear and where they enter the scene."
                >
                  <ThemeRangeField
                    label="Particle density"
                    description="Approximate number of particles."
                    value={settings.customTheme.backdrop.density.amount}
                    min={BACKDROP_DENSITY_FIELDS[0].min}
                    max={BACKDROP_DENSITY_FIELDS[0].max}
                    step={BACKDROP_DENSITY_FIELDS[0].step}
                    onChange={(value) => updateBackdrop("density", "amount", value)}
                  />
                  <ThemeSelectField
                    label="Spawn area"
                    description="Choose whether particles start across the whole scene or in a focused band."
                    value={settings.customTheme.backdrop.density.zone}
                    options={BACKDROP_SPAWN_ZONE_OPTIONS}
                    onChange={(value) => updateBackdrop("density", "zone", value)}
                  />
                  <ThemeRangeField
                    label="Spawn spread"
                    description="How wide the particle field starts."
                    value={settings.customTheme.backdrop.density.spread}
                    min={BACKDROP_DENSITY_FIELDS[1].min}
                    max={BACKDROP_DENSITY_FIELDS[1].max}
                    step={BACKDROP_DENSITY_FIELDS[1].step}
                    onChange={(value) => updateBackdrop("density", "spread", value)}
                  />
                </ThemeGroup>
              </ThemeSection>
            </div>
          ) : null}
        </div>

        <div className="settings-section">
          <div className="settings-section-copy">
            <h2>Session hotkeys</h2>
          </div>
          <div className="settings-list">
            {HOTKEY_ACTIONS.map((action) => (
              <HotkeyRow
                key={action.key}
                action={action}
                hotkey={settings.hotkeys[action.key]}
                isCapturing={capturingAction === action.key}
                onBeginCapture={onBeginHotkeyCapture}
                onClearHotkey={onClearHotkey}
              />
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-copy">
            <h2>Route board</h2>
            <p>Controls the live route square grid.</p>
          </div>
          <div className="settings-list">
            <ToggleField
              label="District-colored area labels"
              description="Colors route square area labels by the Shibuya-Cho, Kogane, and Benten bingo convention."
              checked={settings.routeDistrictColorsEnabled}
              onChange={(value) => onUpdateSetting("routeDistrictColorsEnabled", value)}
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-copy">
            <h2>Route guide playback</h2>
            <p>These defaults apply to the embedded route videos in practice sessions.</p>
          </div>
          <div className="settings-list">
            <ToggleField
              label="Show route guide by default"
              description="Starts new sessions with the route guide embed visible."
              checked={settings.learnPanelDefaultVisible}
              onChange={(value) => onUpdateSetting("learnPanelDefaultVisible", value)}
            />
            <ToggleField
              label="Video auto play"
              description="Starts the mapped route video automatically when a new square loads."
              checked={settings.learnVideoAutoplay}
              onChange={(value) => onUpdateSetting("learnVideoAutoplay", value)}
            />
            <ToggleField
              label="Audio mute"
              description="Keeps learn videos muted by default. This will also makes autoplay more reliable."
              checked={settings.learnAudioMuted}
              onChange={(value) => onUpdateSetting("learnAudioMuted", value)}
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-copy">
            <h2>Pop out window</h2>
            <p>Controls the drill popout window.</p>
          </div>
          <div className="settings-list">
            <ToggleField
              label="Auto open on drill start"
              description="Opens the drill popout automatically when a new practice countdown begins."
              checked={settings.autoOpenPopout}
              onChange={(value) => onUpdateSetting("autoOpenPopout", value)}
            />
            {isTauriRuntime() ? (
              <ToggleField
                label="Pop Up always on top"
                description="Keeps the drill popout window above other desktop windows when it is open."
                checked={settings.popoutAlwaysOnTop}
                onChange={(value) => onUpdateSetting("popoutAlwaysOnTop", value)}
              />
            ) : null}
          </div>
        </div>

        <div className="settings-section danger-zone">
          <div className="settings-section-copy">
            <h2>Reset</h2>
            <p>Use this when you want a completely clean trainer state.</p>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>Reset all data</strong>
                <p>Deletes progress, history, personal bests, the active session, and all settings.</p>
              </div>
              <div className="settings-row-actions">
                <button className="secondary-button danger-button" type="button" onClick={() => setIsResetOpen(true)}>
                  Reset All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isResetOpen ? (
        <ResetDataModal
          hasActiveSession={hasActiveSession}
          onClose={() => setIsResetOpen(false)}
          onConfirm={() => {
            onResetAllData();
            setIsResetOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
