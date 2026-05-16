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
  buildMultinodeAutomarkContext,
  formatMultinodeConnectionStatus
} from "./lib/multinode/appAutomark.js";
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
import { resolveSeedInput } from "./lib/seed/sessionSeed.js";
import { isTauriRuntime } from "./lib/runtime.js";
import {
  APP_STORAGE_KEY,
  createDefaultAppState,
  normalizeAppState
} from "./lib/storage.js";
import { buildLearningVideoSources } from "./data/learnVideos.js";
import { objectivesById } from "./data/objectives.js";
import { formatHotkeyBinding } from "./lib/hotkeys.js";
import {
  applyCompetitionClaim,
  createCompetitionRaceState,
  getCompetitionPlayerName,
  registerCompetitionPlayers,
  setCompetitionLocalPlayer
} from "./lib/multinode/competition.js";
import { parseReleaseNotesMarkdown } from "./lib/releaseNotes.js";
import { resolveTheme } from "./lib/theme/index.js";
import { COMPETITION_MODE } from "./lib/modes.js";
import { useEffect, useMemo, useRef, useState } from "react";

const MULTINODE_SITE_URL = "https://jsrfmulti.surge.sh/bingo/";
const COMPETITION_EFFECT_VISIBLE_MS = 1700;

function buildCompetitionObjectives(sessionSpec) {
  const objectiveIds = Array.isArray(sessionSpec?.objectiveIds)
    ? sessionSpec.objectiveIds
    : [];

  return objectiveIds
    .map((objectiveId) => {
      const objective = objectivesById[objectiveId];
      if (!objective) {
        return null;
      }

      return {
        id: objective.id,
        label: objective.label
      };
    })
    .filter(Boolean);
}

function normalizeSeenPlayers(players = []) {
  const seenByIndex = new Map();

  for (const player of players) {
    if (!Number.isInteger(player?.index) || player.index < 0) {
      continue;
    }

    const previous = seenByIndex.get(player.index) ?? {
      index: player.index,
      name: null
    };
    const nextName =
      typeof player?.name === "string" && player.name.trim()
        ? player.name.trim()
        : previous.name;

    seenByIndex.set(player.index, {
      index: player.index,
      name: nextName
    });
  }

  return Array.from(seenByIndex.values()).sort((left, right) => left.index - right.index);
}

function MultinodeCompetitionPanel({ multinode }) {
  if (!multinode) {
    return null;
  }

  const leaderboardRows = multinode.competition?.leaderboard ?? [];
  const recentClaims = multinode.competition?.recentClaims ?? [];
  const playerOptions = multinode.competition?.playerOptions ?? [];

  return (
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
      <p className="multinode-ready-note">
        This only works when everyone is using the same seed!
      </p>

      <div className="multinode-competition-shell">
        <div className="multinode-competition-header">
          <strong>Competition</strong>
          <span>
            {multinode.competition?.claimedCount ?? 0}/{multinode.competition?.totalObjectives ?? 0}
          </span>
        </div>
        <label className="field multinode-competition-identity">
          <span>You are</span>
          <select
            value={
              Number.isInteger(multinode.claimedPlayerIndex)
                ? String(multinode.claimedPlayerIndex)
                : ""
            }
            onChange={(event) => multinode.onChangeClaimedPlayerIndex(event.target.value)}
          >
            <option value="">Not selected</option>
            {playerOptions.map((player) => (
              <option key={player.value} value={player.value}>
                {player.label}
              </option>
            ))}
          </select>
        </label>

        <div className="multinode-competition-leaderboard" aria-label="Competition leaderboard">
          {leaderboardRows.length ? (
            leaderboardRows.map((row, rowIndex) => (
              <div className="multinode-competition-row" key={row.playerIndex}>
                <span className="multinode-competition-rank">#{rowIndex + 1}</span>
                <span className="multinode-competition-name">{row.playerName}</span>
                <strong className="multinode-competition-score">{row.score}</strong>
              </div>
            ))
          ) : (
            <p className="multinode-competition-empty">No claims yet.</p>
          )}
        </div>

        <div className="multinode-competition-feed" aria-label="Recent objective claims">
          {recentClaims.length ? (
            recentClaims.map((claim) => (
              <p key={claim.id} className="multinode-competition-feed-item">
                <strong>{claim.playerName}</strong> claimed {claim.objectiveLabel}
              </p>
            ))
          ) : (
            <p className="multinode-competition-empty">No objectives claimed yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
        boardSeed={drillSession.currentSession?.id ?? drillSession.currentSession?.exportSeed ?? ""}
        totalTimer={totalTimer}
        isPaused={Boolean(drillSession.currentSession?.pausedAt)}
        useDistrictLocationColors={settings.routeDistrictColorsEnabled}
        visionTrainingEnabled={
          Boolean(drillSession.currentSession?.sessionSpec?.config?.routeVisionTrainingEnabled)
        }
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
      <MultinodeCompetitionPanel multinode={multinode} />
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

function DrillStage({ learnPanelVisible = false, competitionEffect = null, children }) {
  return (
    <div className={`practice-drill-slot ${learnPanelVisible ? "learn-session-layout" : ""}`}>
      {competitionEffect ? (
        <div className={`competition-effect-banner is-${competitionEffect.tone}`}>
          {competitionEffect.label}
        </div>
      ) : null}
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
  multinode = null,
  competitionEffect = null
}) {
  return (
    <DrillStage learnPanelVisible={learnPanelVisible} competitionEffect={competitionEffect}>
      {drillSession.currentSession ? (
        <>
          <CurrentDrillPanel
            drillSession={drillSession}
            settings={settings}
            backdrop={backdrop}
            totalTimer={totalTimer}
            splitTimer={splitTimer}
            onToggleLearnPanel={onToggleLearnPanel}
          />
          <MultinodeCompetitionPanel multinode={multinode} />
        </>
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
  multinode,
  competitionEffect
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
          competitionEffect={competitionEffect}
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
  multinode,
  competitionEffect
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
          competitionEffect={competitionEffect}
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

function CompetitionModeView({
  drillSession,
  settings,
  backdrop,
  totalTimer,
  splitTimer,
  popoutControl,
  popoutError,
  multinode,
  competitionEffect,
  onToggleLearnPanel
}) {
  const [seedInput, setSeedInput] = useState("");
  const [seedSessionType, setSeedSessionType] = useState(PRACTICE_SESSION_TYPE);
  const resolvedSeed = useMemo(
    () => resolveSeedInput(seedInput, seedSessionType),
    [seedInput, seedSessionType]
  );
  const missingSeed = !seedInput.trim();
  const missingLink = !multinode?.link?.trim();
  const missingIdentity = !Number.isInteger(multinode?.claimedPlayerIndex);
  const notConnected = multinode?.status !== "connected";
  const missingSessionSpec = !resolvedSeed.sessionSpec?.objectiveIds?.length;
  const disabledStart =
    missingSeed || missingLink || missingIdentity || notConnected || missingSessionSpec;

  function handleStartCompetition() {
    if (disabledStart) {
      return;
    }

    drillSession.startSession({
      sessionSpec: resolvedSeed.sessionSpec,
      exportSeed: resolvedSeed.exportSeed,
      selectedModeOverride: COMPETITION_MODE
    });
  }

  if (drillSession.currentSession || drillSession.isStartCountdownActive) {
    return (
      <ModeShell drillSession={drillSession} popoutControl={popoutControl} popoutError={popoutError}>
        <ActiveSessionStage
          drillSession={drillSession}
          settings={settings}
          backdrop={backdrop}
          totalTimer={totalTimer}
          splitTimer={splitTimer}
          onToggleLearnPanel={onToggleLearnPanel}
          multinode={multinode}
          competitionEffect={competitionEffect}
        />
      </ModeShell>
    );
  }

  if (drillSession.pendingCompletion) {
    return (
      <ModeShell drillSession={drillSession} popoutControl={popoutControl} popoutError={popoutError}>
        <CompletionStage drillSession={drillSession} backdrop={backdrop} />
      </ModeShell>
    );
  }

  return (
    <ModeShell drillSession={drillSession} popoutControl={popoutControl} popoutError={popoutError}>
      <section className="panel setup-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Competition Mode</p>
            <h1>Start a competition run</h1>
          </div>
          <p className="panel-note">Seed + Multi link + claimed player are required.</p>
        </div>
        <div className="setup-form setup-form-extended">
          <label className="field">
            <span>Session type</span>
            <select
              value={seedSessionType}
              onChange={(event) => setSeedSessionType(event.target.value)}
            >
              <option value={PRACTICE_SESSION_TYPE}>Square</option>
              <option value={ROUTE_SESSION_TYPE}>Route</option>
            </select>
          </label>
          <label className="field">
            <span>Seed</span>
            <textarea
              className="seed-textarea"
              rows={1}
              value={seedInput}
              placeholder="Paste exported seed or enter phrase"
              onChange={(event) => setSeedInput(event.target.value)}
            />
            {resolvedSeed.warning ? <p className="setup-warning">{resolvedSeed.warning}</p> : null}
          </label>
          <MultinodeCompetitionPanel multinode={multinode} />
          <div className="setup-action-controls">
            <button
              className="primary-button reward-button"
              type="button"
              disabled={disabledStart}
              onClick={handleStartCompetition}
            >
              Start Competition
            </button>
          </div>
          {missingSeed ? <p className="setup-warning">Enter a seed to start.</p> : null}
          {!missingSeed && missingSessionSpec ? <p className="setup-warning">Seed did not resolve to a runnable session.</p> : null}
          {missingLink ? <p className="setup-warning">Enter a Multi link.</p> : null}
          {!missingLink && notConnected ? <p className="setup-warning">Multi connection must be connected before starting.</p> : null}
          {!missingIdentity ? null : <p className="setup-warning">Select which room player is you.</p>}
        </div>
      </section>
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
  const claimedPlayerIndex = settings.multinodeClaimedPlayerIndex;
  const competitionRaceKey =
    drillSession.currentSession?.id ?? drillSession.startCountdown?.sessionId ?? "";
  const competitionObjectives = useMemo(
    () =>
      buildCompetitionObjectives(
        drillSession.currentSession?.sessionSpec ?? drillSession.startCountdown?.sessionSpec
      ),
    [drillSession.currentSession?.sessionSpec, drillSession.startCountdown?.sessionSpec]
  );
  const competitionObjectivesSignature = useMemo(
    () => competitionObjectives.map((objective) => objective.id).join("|"),
    [competitionObjectives]
  );
  const [competitionRace, setCompetitionRace] = useState(() =>
    createCompetitionRaceState({
      raceKey: competitionRaceKey,
      objectives: competitionObjectives,
      localClaimedPlayerIndex: claimedPlayerIndex
    })
  );
  const competitionRaceRef = useRef(competitionRace);
  const [seenMultinodePlayers, setSeenMultinodePlayers] = useState([]);
  const seenMultinodeLinkRef = useRef("");
  const winnerEffectRaceKeyRef = useRef("");
  const lastHandledKillComboSeqRef = useRef(-1);
  const [competitionEffect, setCompetitionEffect] = useState(null);
  const automarkContext = buildMultinodeAutomarkContext({
    currentSession: drillSession.currentSession,
    startCountdown: drillSession.startCountdown,
    currentObjective: drillSession.currentObjective,
    routeSlots: drillSession.routeSlots
  });

  useEffect(() => {
    competitionRaceRef.current = competitionRace;
  }, [competitionRace]);

  useEffect(() => {
    const normalizedLink = multinodeLink.trim();
    if (seenMultinodeLinkRef.current === normalizedLink) {
      return;
    }

    seenMultinodeLinkRef.current = normalizedLink;
    setSeenMultinodePlayers([]);
  }, [multinodeLink]);

  useEffect(() => {
    setCompetitionRace(
      createCompetitionRaceState({
        raceKey: competitionRaceKey,
        objectives: competitionObjectives,
        localClaimedPlayerIndex: claimedPlayerIndex
      })
    );
    winnerEffectRaceKeyRef.current = "";
    setCompetitionEffect(null);
  }, [competitionRaceKey, competitionObjectivesSignature]);

  useEffect(() => {
    setCompetitionRace((previousRace) =>
      setCompetitionLocalPlayer(previousRace, claimedPlayerIndex)
    );
  }, [claimedPlayerIndex]);

  useEffect(() => {
    if (!competitionEffect) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCompetitionEffect((activeEffect) =>
        activeEffect?.id === competitionEffect.id ? null : activeEffect
      );
    }, COMPETITION_EFFECT_VISIBLE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [competitionEffect]);

  const multinodeAutomark = useMultinodeAutomark({
    link: multinodeLink,
    enabled:
      Boolean(multinodeLink.trim()) &&
      (automarkContext.enabled || activeMode === COMPETITION_MODE),
    currentObjective: automarkContext.currentObjective,
    currentObjectiveMatchOptions: automarkContext.currentObjectiveMatchOptions,
    candidateObjectives: automarkContext.candidateObjectives,
    activeKey: automarkContext.activeKey,
    onObjectiveMatched(payload) {
      const session = drillSession.currentSession;
      const action = resolveMultinodeAutomarkAction({
        event: payload.event,
        sessionType: session?.sessionType,
        phase: session?.phase,
        routeSlotIndex: payload.routeSlotIndex
      });

      // Automark deliberately delegates to the same manual actions, keeping split
      // progression, feedback, timing, history, PBs, and stats centralized.
      if (action.type === "practice-travel") {
        drillSession.markEnteredLevel();
      } else if (action.type === "practice-tape") {
        drillSession.unlockTape();
      } else if (action.type === "practice-objective") {
        drillSession.completeObjective();
      } else if (action.type === "route-slot") {
        drillSession.completeRouteSlot(action.routeSlotIndex);
      }

      const shouldAwardCompetitionPoint =
        activeMode === COMPETITION_MODE &&
        (action.type === "practice-objective" || action.type === "route-slot");
      const claimRace = competitionRaceRef.current;
      const claimUpdate = shouldAwardCompetitionPoint
        ? applyCompetitionClaim(claimRace, {
            objectiveId: payload.objective?.id,
            objectiveLabel: payload.objective?.label,
            playerIndex: payload.playerIndex,
            playerName: payload.playerName,
            eventType: payload.event?.type,
            occurredAt: Date.now()
          })
        : {
            state: claimRace,
            claimResult: {
              claimed: false
            }
          };

      if (claimUpdate.state !== claimRace) {
        setCompetitionRace(claimUpdate.state);
      }

      if (claimUpdate.claimResult?.claimed) {
        const claimPlayerName = getCompetitionPlayerName(
          claimUpdate.state,
          claimUpdate.claimResult.claim.playerIndex
        );
        if (claimUpdate.claimResult.tone === "yay") {
          setCompetitionEffect({
            id: `claim-${claimUpdate.claimResult.claim.objectiveId}-${claimUpdate.claimResult.claim.occurredAt}`,
            tone: "yay",
            label: "You got it!"
          });
        } else if (claimUpdate.claimResult.tone === "doom") {
          setCompetitionEffect({
            id: `claim-${claimUpdate.claimResult.claim.objectiveId}-${claimUpdate.claimResult.claim.occurredAt}`,
            tone: "doom",
            label: `${claimPlayerName} sniped it`
          });
        }
      }

      if (
        claimUpdate.state?.isComplete &&
        claimUpdate.state.raceKey &&
        winnerEffectRaceKeyRef.current !== claimUpdate.state.raceKey
      ) {
        winnerEffectRaceKeyRef.current = claimUpdate.state.raceKey;
        const winnerName = Number.isInteger(claimUpdate.state.winnerPlayerIndex)
          ? getCompetitionPlayerName(claimUpdate.state, claimUpdate.state.winnerPlayerIndex)
          : "Tie";
        if (claimUpdate.claimResult?.winnerTone === "yay") {
          setCompetitionEffect({
            id: `winner-${claimUpdate.state.raceKey}`,
            tone: "yay",
            label: "You got it!"
          });
        } else if (claimUpdate.claimResult?.winnerTone === "doom") {
          setCompetitionEffect({
            id: `winner-${claimUpdate.state.raceKey}`,
            tone: "doom",
            label: `${winnerName} won the race`
          });
        }
      }
    }
  });

  useEffect(() => {
    if (
      activeMode === COMPETITION_MODE &&
      multinodeAutomark.lastGameEvent?.type === "kill_combo" &&
      multinodeAutomark.lastGameEventSeq !== lastHandledKillComboSeqRef.current
    ) {
      lastHandledKillComboSeqRef.current = multinodeAutomark.lastGameEventSeq;
      drillSession.exitToCompetitionSetup();
    }
  }, [
    activeMode,
    drillSession,
    multinodeAutomark.lastGameEvent,
    multinodeAutomark.lastGameEventSeq
  ]);

  useEffect(() => {
    setCompetitionRace((previousRace) =>
      registerCompetitionPlayers(previousRace, multinodeAutomark.worldState?.players ?? [])
    );
    setSeenMultinodePlayers((previousPlayers) =>
      normalizeSeenPlayers([
        ...previousPlayers,
        ...(multinodeAutomark.worldState?.players ?? [])
      ])
    );
  }, [multinodeAutomark.worldState]);
  const activeTheme = resolveTheme(settings.themeId, settings.customTheme);
  const desktopRuntime = isTauriRuntime();
  const useDesktopGlobalHotkeys = desktopRuntime;
  const hasActiveSession = Boolean(drillSession.currentSession);
  const isSessionMode =
    activeMode === PRACTICE_SESSION_TYPE ||
    activeMode === ROUTE_SESSION_TYPE ||
    activeMode === COMPETITION_MODE;
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
  const multinodeStatus = formatMultinodeConnectionStatus(
    multinodeAutomark.status,
    multinodeAutomark.error
  );
  const multinodePanelProps = {
    link: multinodeLink,
    status: multinodeAutomark.status,
    indicator: multinodeStatus.indicator,
    statusLabel: multinodeStatus.label,
    claimedPlayerIndex,
    competition: {
      claimedCount: competitionRace.claimedCount,
      totalObjectives: competitionRace.totalObjectives,
      leaderboard: competitionRace.playerIndexes.map((playerIndex) => ({
        playerIndex,
        playerName: getCompetitionPlayerName(competitionRace, playerIndex),
        score: competitionRace.scoresByPlayerIndex[playerIndex] ?? 0
      })),
      recentClaims: competitionRace.recentClaims.slice(0, 8).map((claim) => ({
        id: `${claim.objectiveId}:${claim.playerIndex}:${claim.occurredAt}`,
        playerName: getCompetitionPlayerName(competitionRace, claim.playerIndex),
        objectiveLabel: claim.objectiveLabel
      })),
      playerOptions: seenMultinodePlayers.map((player) => ({
        value: String(player.index),
        label:
          typeof player.name === "string" && player.name
            ? player.name
            : `Player ${player.index + 1}`
      }))
    },
    onChangeLink(nextValue) {
      drillSession.updateSettings((previousSettings) => ({
        ...previousSettings,
        multinodeLink: nextValue
      }));
    },
    onChangeClaimedPlayerIndex(value) {
      const normalizedValue =
        value === "" ? null : Number.isInteger(Number(value)) ? Number(value) : null;

      drillSession.updateSettings((previousSettings) => ({
        ...previousSettings,
        multinodeClaimedPlayerIndex: normalizedValue
      }));
    }
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
        onSelectCompetition={drillSession.goToCompetition}
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
            multinode={null}
            competitionEffect={competitionEffect}
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
            multinode={null}
            competitionEffect={competitionEffect}
          />
        ) : activeMode === COMPETITION_MODE ? (
          <CompetitionModeView
            drillSession={drillSession}
            settings={settings}
            backdrop={activeTheme.backdrop}
            totalTimer={totalTimer}
            splitTimer={splitTimer}
            popoutControl={popoutButton}
            popoutError={popoutError}
            multinode={multinodePanelProps}
            competitionEffect={competitionEffect}
            onToggleLearnPanel={drillSession.toggleLearnPanelVisibility}
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
            onSelectCompetition={drillSession.goToCompetition}
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
