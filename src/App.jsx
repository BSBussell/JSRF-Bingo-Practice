import { CompletionPanel } from "./components/CompletionPanel.jsx";
import { Header } from "./components/Header.jsx";
import { DrillCard } from "./components/DrillCard.jsx";
import { DustyBackdrop } from "./components/DustyBackdrop.jsx";
import { HistoryPanel } from "./components/HistoryPanel.jsx";
import { LearnPanel } from "./components/LearnPanel.jsx";
import { ModeSelect } from "./components/ModeSelect.jsx";
import { PopoutViewport } from "./components/PopoutViewport.jsx";
import { RouteCard } from "./components/RouteCard.jsx";
import { SettingsPanel } from "./components/SettingsPanel.jsx";
import { SetupPanel } from "./components/SetupPanel.jsx";
import { StatsPanel } from "./components/StatsPanel.jsx";
import { useDrillSession } from "./hooks/useDrillSession.js";
import { useDesktopGlobalShortcuts } from "./hooks/useDesktopGlobalShortcuts.js";
import { useDesktopUpdate } from "./hooks/useDesktopUpdate.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useReleaseDownload } from "./hooks/useReleaseDownload.js";
import { useSessionHotkeys } from "./hooks/useSessionHotkeys.js";
import { useTimer } from "./hooks/useTimer.js";
import {
  isDrillPopoutView,
  openDrillPopoutWindow,
  syncDrillPopoutAlwaysOnTop
} from "./lib/drill/drillPopout.js";
import { getPhasePausedDuration } from "./lib/session/drillSession.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "./lib/session/sessionTypes.js";
import { isTauriRuntime } from "./lib/runtime.js";
import {
  APP_STORAGE_KEY,
  createDefaultAppState,
  normalizeAppState
} from "./lib/storage.js";
import { resolveTheme } from "./lib/theme/index.js";
import { useEffect, useRef, useState } from "react";

function CurrentDrillPanel({
  drillSession,
  settings,
  totalTimer,
  splitTimer,
  onToggleLearnPanel
}) {
  const learnPanelVisible = Boolean(drillSession.currentSession?.ui?.learnPanelVisible);
  const currentSessionType = drillSession.currentSession?.sessionType ?? PRACTICE_SESSION_TYPE;

  if (currentSessionType === ROUTE_SESSION_TYPE) {
    return (
      <RouteCard
        routeSlots={drillSession.routeSlots}
        visibleCount={drillSession.currentSession?.sessionSpec?.config?.routeVisibleCount ?? 0}
        totalTimer={totalTimer}
        isPaused={Boolean(drillSession.currentSession?.pausedAt)}
        useDistrictLocationColors={settings.routeDistrictColorsEnabled}
        onCompleteSlot={drillSession.completeRouteSlot}
        onTogglePause={drillSession.togglePause}
        onEndSession={drillSession.endSession}
      />
    );
  }

  return (
    <DrillCard
      objective={drillSession.currentObjective}
      learnContent={
        learnPanelVisible ? (
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
      onSkipSplit={drillSession.skipCurrentSplit}
      onTogglePause={drillSession.togglePause}
      onSkip={drillSession.skipObjective}
      onEndSession={drillSession.endSession}
      learnPanelVisible={learnPanelVisible}
      onToggleLearnPanel={onToggleLearnPanel}
    />
  );
}

function StartCountdownPanel({ countdownLabel }) {
  return (
    <section className="panel drill-panel start-countdown-panel">
      <div className="drill-panel-header vertical">
        <p className="eyebrow">Get Ready</p>
        <h1>Drill Start</h1>
      </div>
      <div className="start-countdown-stage" role="status" aria-live="assertive">
        <strong key={countdownLabel} className="start-countdown-number">
          {countdownLabel}
        </strong>
      </div>
    </section>
  );
}

function ModeShell({ drillSession, popoutControl, popoutError, children }) {
  return (
    <div className="content-stack">
      {children}
      {popoutControl ? <div className="drill-popout-row">{popoutControl}</div> : null}
      {popoutError ? <p className="drill-popout-error">{popoutError}</p> : null}
      <HistoryPanel
        history={drillSession.history}
        onDeleteEntry={drillSession.deleteHistoryEntry}
      />
      <StatsPanel stats={drillSession.stats} />
    </div>
  );
}

function DrillStage({ learnPanelVisible = false, children }) {
  return (
    <div className={`practice-drill-slot ${learnPanelVisible ? "learn-session-layout" : ""}`}>
      {children}
    </div>
  );
}

function ActiveSessionStage({
  drillSession,
  settings,
  totalTimer,
  splitTimer,
  learnPanelVisible = false,
  onToggleLearnPanel
}) {
  return (
    <DrillStage learnPanelVisible={learnPanelVisible}>
      {drillSession.currentSession ? (
        <CurrentDrillPanel
          drillSession={drillSession}
          settings={settings}
          totalTimer={totalTimer}
          splitTimer={splitTimer}
          onToggleLearnPanel={onToggleLearnPanel}
        />
      ) : (
        <StartCountdownPanel countdownLabel={drillSession.startCountdownLabel} />
      )}
    </DrillStage>
  );
}

function CompletionStage({ drillSession, backdrop }) {
  return (
    <DrillStage>
      <CompletionPanel
        completionSummary={drillSession.pendingCompletion}
        onNewExercise={drillSession.clearPendingCompletion}
        onRunBack={drillSession.replayPendingCompletion}
        onCopySeed={drillSession.copyPendingCompletionSeed}
        backdrop={backdrop}
        history={drillSession.history}
      />
    </DrillStage>
  );
}

function PracticeModeView({
  drillSession,
  settings,
  backdrop,
  totalTimer,
  splitTimer,
  popoutControl,
  popoutError,
  onToggleLearnPanel
}) {
  const learnPanelVisible = Boolean(drillSession.currentSession?.ui?.learnPanelVisible);
  const isPracticeSession = drillSession.currentSession?.sessionType !== ROUTE_SESSION_TYPE;

  if ((drillSession.currentSession && isPracticeSession) || drillSession.isStartCountdownActive) {
    return (
      <ModeShell
        drillSession={drillSession}
        popoutControl={popoutControl}
        popoutError={popoutError}
      >
        <ActiveSessionStage
          drillSession={drillSession}
          settings={settings}
          totalTimer={totalTimer}
          splitTimer={splitTimer}
          learnPanelVisible={learnPanelVisible}
          onToggleLearnPanel={onToggleLearnPanel}
        />
      </ModeShell>
    );
  }

  if (
    drillSession.pendingCompletion &&
    drillSession.pendingCompletion.sessionType !== ROUTE_SESSION_TYPE
  ) {
    return (
      <ModeShell
        drillSession={drillSession}
        popoutControl={popoutControl}
        popoutError={popoutError}
      >
        <CompletionStage drillSession={drillSession} backdrop={backdrop} />
      </ModeShell>
    );
  }

  return (
    <ModeShell
      drillSession={drillSession}
      popoutControl={popoutControl}
      popoutError={popoutError}
    >
      <SetupPanel
        defaultArea={drillSession.startingArea}
        defaultDrillSettings={settings.drillSettings}
        onStartSession={drillSession.startSession}
        isLearnPanelDefaultVisible={settings.learnPanelDefaultVisible}
        sessionType={PRACTICE_SESSION_TYPE}
      />
    </ModeShell>
  );
}

function RouteModeView({
  drillSession,
  settings,
  backdrop,
  totalTimer,
  splitTimer,
  popoutControl,
  popoutError
}) {
  if (
    (drillSession.currentSession && drillSession.currentSession.sessionType === ROUTE_SESSION_TYPE) ||
    (drillSession.isStartCountdownActive &&
      drillSession.selectedMode === ROUTE_SESSION_TYPE)
  ) {
    return (
      <ModeShell
        drillSession={drillSession}
        popoutControl={popoutControl}
        popoutError={popoutError}
      >
        <ActiveSessionStage
          drillSession={drillSession}
          settings={settings}
          totalTimer={totalTimer}
          splitTimer={splitTimer}
        />
      </ModeShell>
    );
  }

  if (drillSession.pendingCompletion?.sessionType === ROUTE_SESSION_TYPE) {
    return (
      <ModeShell
        drillSession={drillSession}
        popoutControl={popoutControl}
        popoutError={popoutError}
      >
        <CompletionStage drillSession={drillSession} backdrop={backdrop} />
      </ModeShell>
    );
  }

  return (
    <ModeShell
      drillSession={drillSession}
      popoutControl={popoutControl}
      popoutError={popoutError}
    >
      <SetupPanel
        defaultArea={drillSession.startingArea}
        defaultDrillSettings={settings.drillSettings}
        onStartSession={drillSession.startSession}
        sessionType={ROUTE_SESSION_TYPE}
      />
    </ModeShell>
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
  const appMainRef = useRef(null);
  const lastAutoOpenKeyRef = useRef(null);
  const [appState, setAppState] = useLocalStorage(
    APP_STORAGE_KEY,
    createDefaultAppState(),
    normalizeAppState
  );
  const drillSession = useDrillSession(appState, setAppState);
  const totalTimer = useTimer(
    drillSession.currentSession?.sessionStartedAt ?? null,
    drillSession.currentSession?.pausedAt ?? null,
    drillSession.currentSession?.sessionTotalPausedMs ?? 0
  );
  const splitTimer = useTimer(
    drillSession.currentSession?.phaseStartedAt ?? null,
    drillSession.currentSession?.pausedAt ?? null,
    getPhasePausedDuration(drillSession.currentSession)
  );
  const activeMode = appState.selectedMode;
  const settings = drillSession.settings;
  const activeTheme = resolveTheme(settings.themeId, settings.customTheme);
  const desktopRuntime = isTauriRuntime();
  const useDesktopGlobalHotkeys = desktopRuntime;
  const hasActiveSession = Boolean(drillSession.currentSession);
  const isSessionMode =
    activeMode === PRACTICE_SESSION_TYPE || activeMode === ROUTE_SESSION_TYPE;
  const [capturingAction, setCapturingAction] = useState(null);
  const [popoutError, setPopoutError] = useState(null);
  const [hasWindowFocus, setHasWindowFocus] = useState(
    typeof document === "undefined" ? true : document.hasFocus()
  );
  const previousCountdownActiveRef = useRef(drillSession.isStartCountdownActive);
  const autoOpenKey =
    appState.startCountdown?.id ??
    drillSession.currentSession?.id ??
    null;
  const webReleaseDownload = useReleaseDownload({
    enabled: !desktopRuntime && !popoutView
  });
  const desktopUpdate = useDesktopUpdate({
    enabled: desktopRuntime && !popoutView
  });
  const headerReleaseAction = desktopRuntime
    ? desktopUpdate.action
    : webReleaseDownload.action;
  const headerReleaseActionLoading = desktopRuntime
    ? desktopUpdate.isChecking
    : webReleaseDownload.isChecking;

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
    const wasActive = previousCountdownActiveRef.current;
    const isActive = drillSession.isStartCountdownActive;
    previousCountdownActiveRef.current = isActive;

    if (popoutView || wasActive || !isActive) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      appMainRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [drillSession.isStartCountdownActive, popoutView]);

  useEffect(() => {
    if (!isTauriRuntime() || popoutView) {
      return;
    }

    syncDrillPopoutAlwaysOnTop(settings.popoutAlwaysOnTop).catch((error) => {
      console.warn("Failed to sync drill popout always-on-top setting", error);
    });
  }, [settings.popoutAlwaysOnTop]);

  useEffect(() => {
    if (popoutView || !settings.autoOpenPopout || !autoOpenKey) {
      if (!autoOpenKey) {
        lastAutoOpenKeyRef.current = null;
      }
      return;
    }

    if (lastAutoOpenKeyRef.current === autoOpenKey) {
      return;
    }

    lastAutoOpenKeyRef.current = autoOpenKey;
    setPopoutError(null);
    openDrillPopoutWindow(settings.popoutAlwaysOnTop).catch((error) => {
      console.warn("Failed to auto-open drill pop-out window", error);
      setPopoutError(error instanceof Error ? error.message : String(error));
    });
  }, [autoOpenKey, popoutView, settings.autoOpenPopout, settings.popoutAlwaysOnTop]);

  useSessionHotkeys({
    enabled: (!useDesktopGlobalHotkeys || hasWindowFocus) && isSessionMode,
    currentSession: drillSession.currentSession,
    hotkeys: settings.hotkeys,
    onSplit: drillSession.performPhaseAction,
    onSkip: drillSession.skipObjective,
    onPause: drillSession.togglePause,
    onEnd: drillSession.endSession,
    onRouteSlot: drillSession.completeRouteSlot
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
    setPopoutError(null);
    openDrillPopoutWindow(settings.popoutAlwaysOnTop).catch((error) => {
      console.warn("Failed to open drill pop-out window", error);
      setPopoutError(error instanceof Error ? error.message : String(error));
    });
  }

  const popoutButton =
    !popoutView &&
    (drillSession.currentSession || drillSession.isStartCountdownActive || drillSession.pendingCompletion) ? (
    <button className="secondary-button drill-popout-button" type="button" onClick={handlePopoutClick}>
      Pop Out
    </button>
    ) : null;

  if (popoutView) {
    return (
      <div className="popout-root" style={activeTheme.cssVariables}>
        <PopoutViewport>
          {drillSession.currentSession ? (
            <CurrentDrillPanel
              drillSession={drillSession}
              settings={settings}
              totalTimer={totalTimer}
              splitTimer={splitTimer}
              onToggleLearnPanel={drillSession.toggleLearnPanelVisibility}
            />
          ) : drillSession.isStartCountdownActive ? (
            <StartCountdownPanel countdownLabel={drillSession.startCountdownLabel} />
          ) : drillSession.pendingCompletion ? (
            <CompletionPanel
              completionSummary={drillSession.pendingCompletion}
              onNewExercise={drillSession.clearPendingCompletion}
              onRunBack={drillSession.replayPendingCompletion}
              onCopySeed={drillSession.copyPendingCompletionSeed}
              backdrop={activeTheme.backdrop}
              history={drillSession.history}
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
    <div className="app-shell" style={activeTheme.cssVariables}>
      <DustyBackdrop backdrop={activeTheme.backdrop} />
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />

      <Header
        activeMode={activeMode}
        hasActiveSession={Boolean(drillSession.currentSession)}
        releaseAction={headerReleaseAction}
        releaseActionLoading={headerReleaseActionLoading}
        onOpenHome={drillSession.goToModeSelect}
        onSelectPractice={drillSession.goToPractice}
        onSelectRoute={drillSession.goToRoute}
        onSelectSettings={drillSession.goToSettings}
        currentSessionType={drillSession.currentSession?.sessionType ?? null}
      />

      <main ref={appMainRef} className="app-main">
        {activeMode === PRACTICE_SESSION_TYPE ? (
          <PracticeModeView
            drillSession={drillSession}
            settings={settings}
            backdrop={activeTheme.backdrop}
            totalTimer={totalTimer}
            splitTimer={splitTimer}
            popoutControl={popoutButton}
            popoutError={popoutError}
            onToggleLearnPanel={drillSession.toggleLearnPanelVisibility}
          />
        ) : activeMode === ROUTE_SESSION_TYPE ? (
          <RouteModeView
            drillSession={drillSession}
            settings={settings}
            backdrop={activeTheme.backdrop}
            totalTimer={totalTimer}
            splitTimer={splitTimer}
            popoutControl={popoutButton}
            popoutError={popoutError}
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
            onSelectPractice={drillSession.goToPractice}
            onSelectRoute={drillSession.goToRoute}
            onSelectSettings={drillSession.goToSettings}
            currentSessionType={drillSession.currentSession?.sessionType ?? null}
          />
        )}
      </main>
    </div>
  );
}
