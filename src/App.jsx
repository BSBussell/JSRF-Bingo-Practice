import { Header } from "./components/Header.jsx";
import { DrillCard } from "./components/DrillCard.jsx";
import { DustyBackdrop } from "./components/DustyBackdrop.jsx";
import { HistoryPanel } from "./components/HistoryPanel.jsx";
import { LearnPanel } from "./components/LearnPanel.jsx";
import { ModeSelect } from "./components/ModeSelect.jsx";
import { PopoutViewport } from "./components/PopoutViewport.jsx";
import { SettingsPanel } from "./components/SettingsPanel.jsx";
import { SetupPanel } from "./components/SetupPanel.jsx";
import { StatsPanel } from "./components/StatsPanel.jsx";
import { useDrillSession } from "./hooks/useDrillSession.js";
import { useDesktopGlobalShortcuts } from "./hooks/useDesktopGlobalShortcuts.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useSessionHotkeys } from "./hooks/useSessionHotkeys.js";
import { useTimer } from "./hooks/useTimer.js";
import {
  isDrillPopoutView,
  openDrillPopoutWindow,
  syncDrillPopoutAlwaysOnTop
} from "./lib/drillPopout.js";
import { getPhasePausedDuration } from "./lib/drillSession.js";
import { isTauriRuntime } from "./lib/runtime.js";
import {
  APP_STORAGE_KEY,
  createDefaultAppState,
  normalizeAppState
} from "./lib/storage.js";
import { useEffect, useState } from "react";

function CurrentDrillPanel({
  activeMode,
  drillSession,
  settings,
  totalTimer,
  splitTimer
}) {
  return (
    <DrillCard
      objective={drillSession.currentObjective}
      learnContent={
        activeMode === "learn" ? (
          <LearnPanel
            objective={drillSession.currentObjective}
            phaseInfo={drillSession.phaseInfo}
            autoplay={settings.learnVideoAutoplay}
            muted={settings.learnAudioMuted}
          />
        ) : null
      }
      phaseInfo={drillSession.phaseInfo}
      phaseActionLabel={drillSession.phaseActionLabel}
      totalTimer={totalTimer}
      splitTimer={splitTimer}
      onPhaseAction={drillSession.performPhaseAction}
      onTogglePause={drillSession.togglePause}
      onSkip={drillSession.skipObjective}
      onEndSession={drillSession.endSession}
    />
  );
}

function PracticeModeView({
  activeMode,
  drillSession,
  settings,
  totalTimer,
  splitTimer,
  popoutControl
}) {
  if (drillSession.currentSession) {
    return (
      <div className="content-stack">
        <div className={`practice-drill-slot ${activeMode === "learn" ? "learn-session-layout" : ""}`}>
          <CurrentDrillPanel
            activeMode={activeMode}
            drillSession={drillSession}
            settings={settings}
            totalTimer={totalTimer}
            splitTimer={splitTimer}
          />
        </div>
        {popoutControl ? <div className="drill-popout-row">{popoutControl}</div> : null}
        <HistoryPanel history={drillSession.history} />
        <StatsPanel stats={drillSession.stats} />
      </div>
    );
  }

  return (
    <div className="content-stack">
      <SetupPanel
        defaultArea={drillSession.startingArea}
        defaultDrillSettings={settings.drillSettings}
        onStartSession={drillSession.startSession}
        mode={activeMode}
      />
      <HistoryPanel history={drillSession.history} />
      <StatsPanel stats={drillSession.stats} />
    </div>
  );
}

function SettingsModeView({
  drillSession,
  capturingAction,
  onBeginHotkeyCapture,
  onCancelHotkeyCapture
}) {
  return (
    <div className="content-stack">
      <SettingsPanel
        settings={drillSession.settings}
        hasActiveSession={Boolean(drillSession.currentSession)}
        capturingAction={capturingAction}
        onBeginHotkeyCapture={onBeginHotkeyCapture}
        onCancelHotkeyCapture={onCancelHotkeyCapture}
        onUpdateSetting={(key, value) =>
          drillSession.updateSettings((previousSettings) => ({
            ...previousSettings,
            [key]: value
          }))
        }
        onUpdateHotkey={drillSession.updateHotkey}
        onClearHotkey={drillSession.clearHotkey}
        onResetAllData={drillSession.resetAllData}
      />
    </div>
  );
}

export default function App() {
  const popoutView = isDrillPopoutView();
  const [appState, setAppState] = useLocalStorage(
    APP_STORAGE_KEY,
    createDefaultAppState(),
    normalizeAppState
  );
  const drillSession = useDrillSession(appState, setAppState);
  const totalTimer = useTimer(
    drillSession.currentSession?.objectiveStartedAt ?? null,
    drillSession.currentSession?.pausedAt ?? null,
    drillSession.currentSession?.totalPausedMs ?? 0
  );
  const splitTimer = useTimer(
    drillSession.currentSession?.phaseStartedAt ?? null,
    drillSession.currentSession?.pausedAt ?? null,
    getPhasePausedDuration(drillSession.currentSession)
  );
  const activeMode = appState.selectedMode;
  const settings = drillSession.settings;
  const useDesktopGlobalHotkeys = isTauriRuntime();
  const hasActiveSession = Boolean(drillSession.currentSession);
  const isSessionMode = activeMode === "drills" || activeMode === "learn";
  const [capturingAction, setCapturingAction] = useState(null);
  const [hasWindowFocus, setHasWindowFocus] = useState(
    typeof document === "undefined" ? true : document.hasFocus()
  );

  useEffect(() => {
    function handleFocus() {
      setHasWindowFocus(true);
    }

    function handleBlur() {
      setHasWindowFocus(false);
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    if (activeMode !== "settings" && capturingAction) {
      setCapturingAction(null);
    }
  }, [activeMode, capturingAction]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    syncDrillPopoutAlwaysOnTop(settings.popoutAlwaysOnTop).catch((error) => {
      console.warn("Failed to sync drill popout always-on-top setting", error);
    });
  }, [settings.popoutAlwaysOnTop]);

  useSessionHotkeys({
    enabled: (!useDesktopGlobalHotkeys || hasWindowFocus) && isSessionMode,
    currentSession: drillSession.currentSession,
    hotkeys: settings.hotkeys,
    onSplit: drillSession.performPhaseAction,
    onSkip: drillSession.skipObjective,
    onPause: drillSession.togglePause,
    onEnd: drillSession.endSession
  });
  useDesktopGlobalShortcuts({
    enabled:
      useDesktopGlobalHotkeys &&
      hasActiveSession,
    hasWindowFocus,
    suspendNative: Boolean(capturingAction),
    suspendReason: capturingAction ? `Rebinding ${capturingAction}.` : null,
    hotkeys: settings.hotkeys,
    onSplit: drillSession.performPhaseAction,
    onSkip: drillSession.skipObjective,
    onPause: drillSession.togglePause,
    onEnd: drillSession.endSession
  });

  function handlePopoutClick() {
    openDrillPopoutWindow(settings.popoutAlwaysOnTop).catch((error) => {
      console.warn("Failed to open drill pop-out window", error);
    });
  }

  const popoutButton = !popoutView && drillSession.currentSession ? (
    <button className="secondary-button drill-popout-button" type="button" onClick={handlePopoutClick}>
      Pop Out
    </button>
  ) : null;

  if (popoutView) {
    return (
      <div className="popout-root">
        <PopoutViewport>
          {drillSession.currentSession ? (
            <CurrentDrillPanel
              activeMode={activeMode}
              drillSession={drillSession}
              settings={settings}
              totalTimer={totalTimer}
              splitTimer={splitTimer}
            />
          ) : (
            <section className="panel drill-panel popout-empty-panel">
              <div className="drill-panel-header vertical">
                <p className="eyebrow">Drill Pop Out</p>
                <h1>No active drill</h1>
              </div>
              <p className="panel-note">
                Start or resume a drill in the main window, then use Pop Out to move it here.
              </p>
            </section>
          )}
        </PopoutViewport>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <DustyBackdrop />
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />

      <Header
        activeMode={activeMode}
        hasActiveSession={Boolean(drillSession.currentSession)}
        onOpenHome={drillSession.goToModeSelect}
        onSelectDrills={drillSession.goToDrills}
        onSelectLearn={drillSession.goToLearn}
        onSelectSettings={drillSession.goToSettings}
      />

      <main className="app-main">
        {activeMode === "drills" || activeMode === "learn" ? (
          <PracticeModeView
            activeMode={activeMode}
            drillSession={drillSession}
            settings={settings}
            totalTimer={totalTimer}
            splitTimer={splitTimer}
            popoutControl={popoutButton}
          />
        ) : activeMode === "settings" ? (
          <SettingsModeView
            drillSession={drillSession}
            capturingAction={capturingAction}
            onBeginHotkeyCapture={setCapturingAction}
            onCancelHotkeyCapture={() => setCapturingAction(null)}
          />
        ) : (
          <ModeSelect
            hasActiveSession={Boolean(drillSession.currentSession)}
            onSelectDrills={drillSession.goToDrills}
            onSelectLearn={drillSession.goToLearn}
            onSelectSettings={drillSession.goToSettings}
          />
        )}
      </main>
    </div>
  );
}
