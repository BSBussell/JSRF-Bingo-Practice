import { useEffect, useState } from "react";
import {
  createHotkeyBinding,
  formatHotkeyBinding,
  hasHotkeyModifier,
  HOTKEY_ACTIONS,
  isModifierOnlyCode
} from "../lib/hotkeys.js";
import { isTauriRuntime } from "../lib/runtime.js";

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
            <h1>Trainer controls and playback</h1>
          </div>
          <p className="panel-note">
            On the web version, hotkeys only work while the trainer is focused.
            For global hotkeys, use the desktop version!
          </p>
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
            <h2>Learn mode playback</h2>
            <p>These defaults apply to the embedded route videos during learn sessions.</p>
          </div>
          <div className="settings-list">
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

        {isTauriRuntime() ? (
          <div className="settings-section">
            <div className="settings-section-copy">
              <h2>Pop out window</h2>
              <p>Controls the native desktop drill popout window.</p>
            </div>
            <div className="settings-list">
              <ToggleField
                label="Pop Up always on top"
                description="Keeps the drill popout window above other desktop windows when it is open."
                checked={settings.popoutAlwaysOnTop}
                onChange={(value) => onUpdateSetting("popoutAlwaysOnTop", value)}
              />
            </div>
          </div>
        ) : null}

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
