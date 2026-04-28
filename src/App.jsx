import {
  BingopediaPanel,
  CompletionPanel,
  DrillCard,
  DustyBackdrop,
  Header,
  LearnPanel,
  ModeSelect,
  PopoutViewport,
  RouteCard,
  SeedBuilderPanel,
  SettingsPanel,
  SetupPanel,
  StatsPanel
} from "./components/index.js";
import { useDrillSession } from "./hooks/useDrillSession.js";
import { useMultinodeAutomark } from "./hooks/useMultinodeAutomark.js";
import { useDesktopGlobalShortcuts } from "./hooks/useDesktopGlobalShortcuts.js";
import { useDesktopUpdate } from "./hooks/useDesktopUpdate.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useReleaseDownload } from "./hooks/useReleaseDownload.js";
import { useSessionHotkeys } from "./hooks/useSessionHotkeys.js";
import { useTimer } from "./hooks/useTimer.js";
import { resolveMultinodeAutomarkAction } from "./lib/multinode/automarkDispatch.js";
import {
  isDrillPopoutView,
  openDrillPopoutWindow,
  syncDrillPopoutAlwaysOnTop
} from "./lib/drill/drillPopout.js";
import { buildCompletionRecap } from "./lib/session/completionRecap.js";
import { getPhasePausedDuration } from "./lib/session/drillSession.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "./lib/session/sessionTypes.js";
import { SEED_BUILDER_MODE } from "./lib/seedBuilder.js";
import { isTauriRuntime } from "./lib/runtime.js";
import {
  APP_STORAGE_KEY,
  createDefaultAppState,
  normalizeAppState
} from "./lib/storage.js";
import { buildLearningVideoSources } from "./data/learnVideos.js";
import { objectivesById } from "./data/objectives.js";
import { formatHotkeyBinding } from "./lib/hotkeys.js";
import { parseReleaseNotesMarkdown } from "./lib/releaseNotes.js";
import { resolveTheme } from "./lib/theme/index.js";
import { useEffect, useRef, useState } from "react";

const MULTINODE_SITE_URL = "https://jsrfmulti.surge.sh/bingo/";

function UpdatePreviewModal({ offer, onClose }) {
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

  if (!offer) {
    return null;
  }

  const releaseTitle = offer.release?.name || offer.release?.tagName || "Latest release";
  const versionLine =
    offer.installedVersion && offer.release?.tagName
      ? `${offer.installedVersion} -> ${offer.release.tagName}`
      : offer.release?.tagName ?? null;
  const notes = offer.release?.notes?.trim() || "No release notes were included with this update.";
  const noteBlocks = parseReleaseNotesMarkdown(notes);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="panel modal-card update-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Update Available</p>
        <h2 id="update-preview-title">{releaseTitle}</h2>
        <p className="modal-copy">
          Here&rsquo;s what you&rsquo;ll get from updating.
          {versionLine ? ` ${versionLine}` : ""}
        </p>
        <section className="update-preview-notes" aria-label="Release notes">
          {noteBlocks.length ? (
            noteBlocks.map((block, index) => {
              if (block.type === "heading") {
                if (block.level === 1) {
                  return <h1 key={index}>{block.text}</h1>;
                }

                if (block.level === 2) {
                  return <h2 key={index}>{block.text}</h2>;
                }

                if (block.level === 3) {
                  return <h3 key={index}>{block.text}</h3>;
                }

                if (block.level === 4) {
                  return <h4 key={index}>{block.text}</h4>;
                }

                if (block.level === 5) {
                  return <h5 key={index}>{block.text}</h5>;
                }

                return <h6 key={index}>{block.text}</h6>;
              }

              if (block.type === "list") {
                return (
                  <ul key={index}>
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                );
              }

              return <p key={index}>{block.text}</p>;
            })
          ) : (
            <p>{notes}</p>
          )}
        </section>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button reward-button"
            type="button"
            onClick={() => {
              offer.onDownload();
              onClose();
            }}
          >
            Download Update
          </button>
        </div>
      </div>
    </div>
  );
}

function CurrentDrillPanel({
  drillSession,
  settings,
  backdrop,
  totalTimer,
  splitTimer,
  routePreferVerticalLayout = false,
  onToggleLearnPanel
}) {
  const learnPanelVisible = Boolean(drillSession.currentSession?.ui?.learnPanelVisible);
  const currentSessionType = drillSession.currentSession?.sessionType ?? PRACTICE_SESSION_TYPE;
  const learnVideoSources = buildLearningVideoSources({
    objective: drillSession.currentObjective,
    phaseInfo: drillSession.phaseInfo
  });

  if (currentSessionType === ROUTE_SESSION_TYPE) {
    return (
      <RouteCard
        routeSlots={drillSession.routeSlots}
        visibleCount={drillSession.currentSession?.sessionSpec?.config?.routeVisibleCount ?? 0}
        totalTimer={totalTimer}
        isPaused={Boolean(drillSession.currentSession?.pausedAt)}
        useDistrictLocationColors={settings.routeDistrictColorsEnabled}
        preferVerticalLayout={routePreferVerticalLayout}
        sessionFeedback={drillSession.sessionFeedback}
        backdrop={backdrop}
        onCompleteSlot={drillSession.completeRouteSlot}
        onRunBack={drillSession.restartCurrentSession}
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
            key={drillSession.currentObjective?.id ?? "unknown"}
            sources={learnVideoSources}
            autoplay={settings.learnVideoAutoplay}
            muted={settings.learnAudioMuted}
          />
        ) : null
      }
      phaseInfo={drillSession.phaseInfo}
      phaseActionLabel={drillSession.phaseActionLabel}
      totalTimer={totalTimer}
      splitTimer={splitTimer}
      sessionFeedback={drillSession.sessionFeedback}
      backdrop={backdrop}
      onPhaseAction={drillSession.performPhaseAction}
      onRunBack={drillSession.restartCurrentSession}
      onSkipSplit={drillSession.skipCurrentSplit}
      onTogglePause={drillSession.togglePause}
      onSkip={drillSession.skipObjective}
      onEndSession={drillSession.endSession}
      learnPanelVisible={learnPanelVisible}
      onToggleLearnPanel={onToggleLearnPanel}
    />
  );
}

function StartCountdownPanel({
  countdownLabel,
  isPendingReady = false,
  onStartCountdown,
  startCountdownHotkey,
  multinode = null
}) {
  const readyHotkeyLabel = startCountdownHotkey
    ? formatHotkeyBinding(startCountdownHotkey)
    : null;

  return (
    <section className="panel drill-panel start-countdown-panel">
      <div className="drill-panel-header vertical">
        <p className="eyebrow">Get Ready</p>
        <h1>Drill Start</h1>
      </div>
      {isPendingReady ? (
        <div className="start-countdown-stage start-countdown-stage-idle">
          <button
            className="primary-button reward-button start-countdown-ready-button"
            type="button"
            onClick={onStartCountdown}
          >
            Ready?
          </button>
          {readyHotkeyLabel ? (
            <p className="start-countdown-sequence">Hotkey: {readyHotkeyLabel}</p>
          ) : null}
        </div>
      ) : (
        <div className="start-countdown-stage" role="status" aria-live="assertive">
          <strong key={countdownLabel} className="start-countdown-number">
            {countdownLabel}
          </strong>
        </div>
      )}
      {multinode ? (
        <div className="multinode-ready-panel">
          <label className="multinode-ready-label" htmlFor="multinode-link-input">
            Multi Link for Automarking
          </label>
          <div className="multinode-ready-controls">
            <input
              id="multinode-link-input"
              className="multinode-ready-input"
              type="text"
              value={multinode.link}
              placeholder="https://jsrfmulti.surge.sh/bingo/?connect=..."
              onChange={(event) => multinode.onChangeLink(event.target.value)}
            />
            <a
              className="secondary-button multinode-ready-site-link"
              href={MULTINODE_SITE_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open Site
            </a>
          </div>
          <p className={`multinode-ready-status is-${multinode.status}`}>
            {multinode.indicator} {multinode.statusLabel}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function ModeShell({ drillSession, popoutControl, popoutError, children }) {
  return (
    <div className="content-stack">
      {children}
      {popoutControl ? <div className="drill-popout-row">{popoutControl}</div> : null}
      {popoutError ? <p className="drill-popout-error">{popoutError}</p> : null}
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
  backdrop,
  totalTimer,
  splitTimer,
  learnPanelVisible = false,
  onToggleLearnPanel,
  multinode = null
}) {
  return (
    <DrillStage learnPanelVisible={learnPanelVisible}>
      {drillSession.currentSession ? (
        <CurrentDrillPanel
          drillSession={drillSession}
          settings={settings}
          backdrop={backdrop}
          totalTimer={totalTimer}
          splitTimer={splitTimer}
          onToggleLearnPanel={onToggleLearnPanel}
        />
      ) : (
        <StartCountdownPanel
          countdownLabel={drillSession.startCountdownLabel}
          isPendingReady={drillSession.isStartCountdownPendingReady}
          onStartCountdown={drillSession.beginStartCountdown}
          startCountdownHotkey={settings.hotkeys.startCountdown}
          multinode={multinode}
        />
      )}
    </DrillStage>
  );
}

function CompletionStage({ drillSession, backdrop }) {
  const completionRecap = buildCompletionRecap({
    completionSummary: drillSession.pendingCompletion,
    history: drillSession.history
  });

  return (
    <DrillStage>
      <CompletionPanel
        completionSummary={drillSession.pendingCompletion}
        completionRecap={completionRecap}
        onNewExercise={drillSession.clearPendingCompletion}
        onRunBack={drillSession.replayPendingCompletion}
        onCopySeed={drillSession.copyPendingCompletionSeed}
        backdrop={backdrop}
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
  onToggleLearnPanel,
  multinode
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
          backdrop={backdrop}
          totalTimer={totalTimer}
          splitTimer={splitTimer}
          learnPanelVisible={learnPanelVisible}
          onToggleLearnPanel={onToggleLearnPanel}
          multinode={multinode}
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
  popoutError,
  multinode
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
          backdrop={backdrop}
          totalTimer={totalTimer}
          splitTimer={splitTimer}
          multinode={multinode}
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
  desktopGlobalWarning,
  onBeginHotkeyCapture,
  onCancelHotkeyCapture
}) {
  return (
    <div className="content-stack">
      <SettingsPanel
        settings={drillSession.settings}
        hasActiveSession={Boolean(drillSession.currentSession)}
        capturingAction={capturingAction}
        desktopHotkeyWarning={desktopGlobalWarning}
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

function StatsModeView({
  drillSession,
  focusedHistoryRunId,
  onFocusedHistoryRunHandled
}) {
  return (
    <StatsPanel
      stats={drillSession.stats}
      history={drillSession.history}
      seedNamesByExportSeed={drillSession.seedNamesByExportSeed}
      averageWindow={drillSession.settings.averageWindow}
      focusedHistoryRunId={focusedHistoryRunId}
      onDeleteEntry={drillSession.deleteHistoryEntry}
      onDeleteRun={drillSession.deleteHistoryRun}
      onCopySeed={drillSession.copySeed}
      onRunSeed={drillSession.runSeed}
      onRenameSeed={drillSession.renameSeed}
      onFocusedHistoryRunHandled={onFocusedHistoryRunHandled}
    />
  );
}

function BingopediaModeView({
  drillSession,
  onOpenHistoryRun
}) {
  return (
    <div className="content-stack">
      <BingopediaPanel
        history={drillSession.history}
        bestTimesByObjective={drillSession.bestTimesByObjective}
        aggregateStats={drillSession.aggregateStats}
        settings={drillSession.settings}
        onPracticeObjective={drillSession.practiceObjective}
        onOpenHistoryRun={onOpenHistoryRun}
      />
    </div>
  );
}

function SeedBuilderModeView({ drillSession }) {
  return (
    <div className="content-stack">
      <SeedBuilderPanel
        draft={drillSession.seedBuilderDraft}
        drillSettings={drillSession.settings.drillSettings}
        onUpdateDraft={drillSession.updateSeedBuilderDraft}
        onStartSession={drillSession.startSession}
        onCopySeed={drillSession.copySeed}
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
  const multinodeLink = settings.multinodeLink ?? "";
  const startCountdownSessionType = drillSession.startCountdown?.sessionSpec?.sessionType ?? null;
  const countdownObjectiveId =
    drillSession.startCountdown?.sessionSpec?.objectiveIds?.[0] ?? null;
  const countdownObjective = countdownObjectiveId ? objectivesById[countdownObjectiveId] ?? null : null;
  const currentAutomarkObjective =
    drillSession.currentSession?.sessionType === PRACTICE_SESSION_TYPE
      ? drillSession.currentObjective
      : startCountdownSessionType === PRACTICE_SESSION_TYPE
        ? countdownObjective
        : null;
  const currentPracticePhase =
    drillSession.currentSession?.sessionType === PRACTICE_SESSION_TYPE
      ? drillSession.currentSession.phase
      : null;
  const routeAutomarkCandidates =
    drillSession.currentSession?.sessionType === ROUTE_SESSION_TYPE
      ? drillSession.routeSlots
          .filter((slot) => slot.objective)
          .map((slot) => ({
            objective: slot.objective,
            routeSlotId: `${slot.slotIndex}:${slot.objective.id}`,
            routeSlotIndex: slot.slotIndex
          }))
      : [];
  const routeAutomarkSignature = routeAutomarkCandidates
    .map((candidate) => candidate.routeSlotId)
    .join("|");
  const automarkActiveKey = drillSession.currentSession
    ? drillSession.currentSession.sessionType === ROUTE_SESSION_TYPE
      ? `${drillSession.currentSession.id}:route:${routeAutomarkSignature}`
      : `${drillSession.currentSession.id}:practice:${drillSession.currentSession.phase}:${drillSession.currentObjective?.id ?? ""}`
    : drillSession.startCountdown
      ? `${drillSession.startCountdown.id}:countdown:${startCountdownSessionType ?? ""}:${countdownObjectiveId ?? ""}`
      : "idle";
  const automarkEnabled = Boolean(
    multinodeLink.trim() &&
      (drillSession.currentSession ||
        drillSession.isStartCountdownActive)
  );
  const multinodeAutomark = useMultinodeAutomark({
    link: multinodeLink,
    enabled: automarkEnabled,
    currentObjective: currentAutomarkObjective,
    currentObjectiveMatchOptions: {
      phase: currentPracticePhase,
      allowAreaChange: currentPracticePhase === "travel"
    },
    candidateObjectives: routeAutomarkCandidates,
    activeKey: automarkActiveKey,
    onObjectiveMatched(payload) {
      const session = drillSession.currentSession;
      const action = resolveMultinodeAutomarkAction({
        event: payload.event,
        sessionType: session?.sessionType,
        phase: session?.phase,
        routeSlotIndex: payload.routeSlotIndex
      });

      if (import.meta.env.DEV) {
        console.debug("[multinode automark]", {
          event: payload.event,
          objectiveId: payload.objective?.id ?? null,
          routeSlotIndex: payload.routeSlotIndex,
          sessionType: session?.sessionType ?? null,
          phase: session?.phase ?? null,
          action: action.type,
          reason: action.reason
        });
      }

      // Automark deliberately delegates to the same manual actions, keeping split
      // progression, feedback, timing, history, PBs, and stats centralized.
      if (action.type === "practice-travel") {
        drillSession.markEnteredLevel();
        return;
      }

      if (action.type === "practice-tape") {
        drillSession.unlockTape();
        return;
      }

      if (action.type === "practice-objective") {
        drillSession.completeObjective();
        return;
      }

      if (action.type === "route-slot") {
        drillSession.completeRouteSlot(action.routeSlotIndex);
      }
    }
  });
  const activeTheme = resolveTheme(settings.themeId, settings.customTheme);
  const desktopRuntime = isTauriRuntime();
  const useDesktopGlobalHotkeys = desktopRuntime;
  const hasActiveSession = Boolean(drillSession.currentSession);
  const isSessionMode =
    activeMode === PRACTICE_SESSION_TYPE || activeMode === ROUTE_SESSION_TYPE;
  const [capturingAction, setCapturingAction] = useState(null);
  const [popoutError, setPopoutError] = useState(null);
  const [focusedStatsHistoryRunId, setFocusedStatsHistoryRunId] = useState("");
  const [updatePreviewOpen, setUpdatePreviewOpen] = useState(false);
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
  const desktopUpdateOffer = desktopUpdate.offer;
  const headerReleaseAction = desktopRuntime
    ? desktopUpdateOffer
      ? {
          label: desktopUpdateOffer.label,
          tone: desktopUpdateOffer.tone,
          title: desktopUpdateOffer.title,
          onClick() {
            setUpdatePreviewOpen(true);
          }
        }
      : null
    : webReleaseDownload.action;
  const headerReleaseActionLoading = desktopRuntime
    ? desktopUpdate.isChecking
    : webReleaseDownload.isChecking;

  useEffect(() => {
    if (!desktopUpdateOffer && updatePreviewOpen) {
      setUpdatePreviewOpen(false);
    }
  }, [desktopUpdateOffer, updatePreviewOpen]);

  function openStatsHistoryRun(sessionId) {
    if (typeof sessionId !== "string" || !sessionId) {
      return;
    }

    setFocusedStatsHistoryRunId(sessionId);
    drillSession.goToStats();
  }

  useEffect(() => {
    let cancelled = false;
    let removeDesktopFocusListener = null;

    function applyFocusState(nextFocusState) {
      setHasWindowFocus(Boolean(nextFocusState));
    }

    function handleFocus() {
      applyFocusState(true);
    }

    function handleBlur() {
      applyFocusState(false);
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    if (desktopRuntime) {
      import("@tauri-apps/api/window")
        .then(async ({ getCurrentWindow }) => {
          if (cancelled) {
            return;
          }

          const currentWindow = getCurrentWindow();

          try {
            const focused = await currentWindow.isFocused();
            if (!cancelled) {
              applyFocusState(focused);
            }
          } catch {
            // Browser focus events are already active; keep the best-known state.
          }

          try {
            const unlisten = await currentWindow.onFocusChanged((event) => {
              applyFocusState(event.payload);
            });

            if (cancelled) {
              unlisten();
              return;
            }

            removeDesktopFocusListener = unlisten;
          } catch {
            // Browser focus events are already active; keep the best-known state.
          }
        })
        .catch(() => {
          // Browser focus events are already active; keep the best-known state.
        });
    }

    return () => {
      cancelled = true;
      removeDesktopFocusListener?.();
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [desktopRuntime]);

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
    startCountdown: drillSession.startCountdown,
    hotkeys: settings.hotkeys,
    onSplit: drillSession.performPhaseAction,
    onSkip: drillSession.skipObjective,
    onPause: drillSession.togglePause,
    onRunBack: drillSession.restartCurrentSession,
    onSkipSplit: drillSession.skipCurrentSplit,
    onToggleGuide: drillSession.toggleLearnPanelVisibility,
    onStartCountdown: drillSession.beginStartCountdown,
    onEnd: drillSession.endSession,
    onRouteSlot: drillSession.completeRouteSlot
  });
  const desktopGlobalShortcuts = useDesktopGlobalShortcuts({
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
    onRunBack: drillSession.restartCurrentSession,
    onSkipSplit: drillSession.skipCurrentSplit,
    onToggleGuide: drillSession.toggleLearnPanelVisibility,
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
  const multinodeStatusLabel =
    multinodeAutomark.status === "connected"
      ? "Connected"
      : multinodeAutomark.status === "connecting"
        ? "Connecting..."
        : multinodeAutomark.status === "error"
          ? `Failed${multinodeAutomark.error ? `: ${multinodeAutomark.error}` : ""}`
          : multinodeAutomark.status === "closed"
            ? "Disconnected"
            : "Idle";
  const multinodeStatusIndicator =
    multinodeAutomark.status === "connected"
      ? "✓"
      : multinodeAutomark.status === "error"
        ? "✕"
        : "•";
  const multinodePanelProps = {
    link: multinodeLink,
    status: multinodeAutomark.status,
    indicator: multinodeStatusIndicator,
    statusLabel: multinodeStatusLabel,
    objectiveStatus: multinodeAutomark.currentObjectiveStatus,
    lastMatchReason: multinodeAutomark.lastMatchResult?.result?.reason ?? null,
    onChangeLink(nextValue) {
      drillSession.updateSettings((previousSettings) => ({
        ...previousSettings,
        multinodeLink: nextValue
      }));
    },
    onConnect: multinodeAutomark.connect,
    onDisconnect: multinodeAutomark.disconnect
  };

  if (popoutView) {
    return (
      <div className="popout-root" style={activeTheme.cssVariables}>
        <PopoutViewport>
          {drillSession.currentSession ? (
            <CurrentDrillPanel
              drillSession={drillSession}
              settings={settings}
              backdrop={activeTheme.backdrop}
              totalTimer={totalTimer}
              splitTimer={splitTimer}
              routePreferVerticalLayout={true}
              onToggleLearnPanel={drillSession.toggleLearnPanelVisibility}
            />
          ) : drillSession.isStartCountdownActive ? (
            <StartCountdownPanel
              countdownLabel={drillSession.startCountdownLabel}
              isPendingReady={drillSession.isStartCountdownPendingReady}
              onStartCountdown={drillSession.beginStartCountdown}
              startCountdownHotkey={settings.hotkeys.startCountdown}
            />
          ) : drillSession.pendingCompletion ? (
            <CompletionPanel
              completionSummary={drillSession.pendingCompletion}
              completionRecap={buildCompletionRecap({
                completionSummary: drillSession.pendingCompletion,
                history: drillSession.history
              })}
              onNewExercise={drillSession.clearPendingCompletion}
              onRunBack={drillSession.replayPendingCompletion}
              onCopySeed={drillSession.copyPendingCompletionSeed}
              backdrop={activeTheme.backdrop}
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
        onSelectSeedBuilder={drillSession.goToSeedBuilder}
        onSelectBingopedia={drillSession.goToBingopedia}
        onSelectStats={drillSession.goToStats}
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
            multinode={multinodePanelProps}
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
            multinode={multinodePanelProps}
          />
        ) : activeMode === "settings" ? (
          <SettingsModeView
            drillSession={drillSession}
            capturingAction={capturingAction}
            desktopGlobalWarning={desktopGlobalShortcuts.warningMessage}
            onBeginHotkeyCapture={setCapturingAction}
            onCancelHotkeyCapture={() => setCapturingAction(null)}
          />
        ) : activeMode === "bingopedia" ? (
          <BingopediaModeView
            drillSession={drillSession}
            onOpenHistoryRun={openStatsHistoryRun}
          />
        ) : activeMode === SEED_BUILDER_MODE ? (
          <SeedBuilderModeView drillSession={drillSession} />
        ) : activeMode === "stats" ? (
          <StatsModeView
            drillSession={drillSession}
            focusedHistoryRunId={focusedStatsHistoryRunId}
            onFocusedHistoryRunHandled={() => setFocusedStatsHistoryRunId("")}
          />
        ) : (
          <ModeSelect
            hasActiveSession={Boolean(drillSession.currentSession)}
            onSelectPractice={drillSession.goToPractice}
            onSelectRoute={drillSession.goToRoute}
            onSelectSeedBuilder={drillSession.goToSeedBuilder}
            onSelectBingopedia={drillSession.goToBingopedia}
            onSelectStats={drillSession.goToStats}
            onSelectSettings={drillSession.goToSettings}
            currentSessionType={drillSession.currentSession?.sessionType ?? null}
          />
        )}
      </main>
      {desktopUpdateOffer && updatePreviewOpen ? (
        <UpdatePreviewModal
          offer={desktopUpdateOffer}
          onClose={() => setUpdatePreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
