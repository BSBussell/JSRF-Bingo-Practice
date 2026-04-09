import { useEffect, useState } from "react";

import { objectivesById } from "../data/objectives.js";
import {
  buildSeededSessionState,
  buildSessionPhaseViewModel,
  getPhaseActionLabel,
  getPhasePausedKey,
  objectiveNeedsTape,
  skipSessionSplit,
  resolveSeededSessionTransition
} from "../lib/session/drillSession.js";
import { normalizeHotkeyBinding } from "../lib/hotkeys.js";
import { createDefaultAppState, normalizeAppState } from "../lib/storage.js";
import {
  buildStatsViewModel,
  rebuildPerformanceState,
  recordBestTime,
  recordCompletionStats
} from "../lib/stats/stats.js";

const START_COUNTDOWN_SEQUENCE = ["3", "2", "1", "GO!"];
const START_COUNTDOWN_STEP_MS = 1000;
const START_COUNTDOWN_DURATION_MS = START_COUNTDOWN_SEQUENCE.length * START_COUNTDOWN_STEP_MS;

function buildSessionId() {
  return `session_${Date.now()}`;
}

function buildCountdownId() {
  return `countdown_${Date.now()}`;
}

function resolveCurrentObjective(currentSession) {
  if (!currentSession?.objectiveIds?.length) {
    return null;
  }

  const objectiveId =
    currentSession.currentObjectiveId ??
    currentSession.objectiveIds[currentSession.currentObjectiveIndex ?? 0];

  return objectivesById[objectiveId] ?? null;
}

function resolveSessionLearnPanelVisible(session, settings) {
  if (typeof session?.ui?.learnPanelVisible === "boolean") {
    return session.ui.learnPanelVisible;
  }

  return settings.learnPanelDefaultVisible;
}

function resolveStartCountdownDeadline(startCountdown) {
  return (startCountdown?.startedAt ?? 0) + START_COUNTDOWN_DURATION_MS;
}

function resolveStartCountdownLabel(startCountdown, now) {
  if (!startCountdown) {
    return null;
  }

  const elapsedMs = Math.max(0, now - startCountdown.startedAt);
  const stepIndex = Math.min(
    START_COUNTDOWN_SEQUENCE.length - 1,
    Math.floor(elapsedMs / START_COUNTDOWN_STEP_MS)
  );

  return START_COUNTDOWN_SEQUENCE[stepIndex] ?? null;
}

export function useDrillSession(appState, setAppState) {
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const currentSession = appState.currentSession;
  const startCountdown = appState.startCountdown;
  const pendingCompletion = appState.pendingCompletion;
  const currentObjective = resolveCurrentObjective(currentSession);
  const history = appState.history;
  const stats = buildStatsViewModel(appState.aggregateStats, appState.history);
  const phaseInfo = buildSessionPhaseViewModel({
    currentSession,
    currentObjective,
    aggregateStats: appState.aggregateStats,
    bestTimesByObjective: appState.bestTimesByObjective
  });

  function updateState(updater) {
    setAppState((previousValue) => normalizeAppState(updater(previousValue)));
  }

  useEffect(
    () => {
      if (!startCountdown) {
        return undefined;
      }

      let timeoutId = null;

      function scheduleCountdownTick() {
        const now = Date.now();
        setCountdownNow(now);

        const launchAt = resolveStartCountdownDeadline(startCountdown);
        const remainingMs = launchAt - now;
        if (remainingMs <= 0) {
          return;
        }

        const elapsedMs = Math.max(0, now - startCountdown.startedAt);
        const msUntilNextStep = START_COUNTDOWN_STEP_MS - (elapsedMs % START_COUNTDOWN_STEP_MS);
        timeoutId = window.setTimeout(
          scheduleCountdownTick,
          Math.min(msUntilNextStep, remainingMs)
        );
      }

      scheduleCountdownTick();

      return () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      };
    },
    [startCountdown]
  );

  useEffect(
    () => {
      if (!startCountdown) {
        return undefined;
      }

      const timeoutId = window.setTimeout(() => {
        updateState((previousValue) => {
          const pendingStartCountdown = previousValue.startCountdown;
          if (!pendingStartCountdown || pendingStartCountdown.id !== startCountdown.id) {
            return previousValue;
          }

          const sessionSpec = pendingStartCountdown.sessionSpec;
          const exportSeed = pendingStartCountdown.exportSeed ?? "";
          if (!sessionSpec?.objectiveIds?.length) {
            return {
              ...previousValue,
              startCountdown: null,
              currentSession: null
            };
          }

          const firstObjective = objectivesById[sessionSpec.objectiveIds[0]];
          if (!firstObjective) {
            return {
              ...previousValue,
              startCountdown: null,
              currentSession: null
            };
          }

          const learnPanelVisible = resolveSessionLearnPanelVisible(
            previousValue.currentSession,
            previousValue.settings
          );
          const nextSettings = {
            ...previousValue.settings,
            startingArea: sessionSpec.config.startingArea,
            drillSettings: sessionSpec.config
          };
          const launchedAt = resolveStartCountdownDeadline(pendingStartCountdown);

          return {
            ...previousValue,
            selectedMode: "practice",
            settings: nextSettings,
            pendingCompletion: null,
            startCountdown: null,
            currentSession: {
              ...buildSeededSessionState({
                sessionId: pendingStartCountdown.sessionId,
                now: launchedAt,
                currentArea: sessionSpec.config.startingArea,
                objective: firstObjective,
                currentObjectiveIndex: 0,
                sessionSpec,
                exportSeed
              }),
              ui: {
                learnPanelVisible
              }
            }
          };
        });
      }, Math.max(0, resolveStartCountdownDeadline(startCountdown) - Date.now()));

      return () => {
        window.clearTimeout(timeoutId);
      };
    },
    [startCountdown, setAppState]
  );

  function startSession(sessionLaunch) {
    if (startCountdown) {
      return;
    }

    const sessionSpec = sessionLaunch?.sessionSpec;
    const exportSeed = sessionLaunch?.exportSeed ?? "";
    if (!sessionSpec?.objectiveIds?.length || !objectivesById[sessionSpec.objectiveIds[0]]) {
      updateState((previousValue) => ({
        ...previousValue,
        startCountdown: null,
        currentSession: null
      }));
      return;
    }

    const countdownId = buildCountdownId();
    const startedAt = Date.now();

    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: "practice",
      currentSession: null,
      pendingCompletion: null,
      startCountdown: {
        id: countdownId,
        sessionId: buildSessionId(),
        startedAt,
        sessionSpec: {
          ...sessionSpec,
          config: {
            ...sessionSpec.config
          },
          objectiveIds: sessionSpec.objectiveIds.slice()
        },
        exportSeed
      }
    }));
  }

  function markEnteredLevel() {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session || session.phase !== "travel") {
        return previousValue;
      }

      const objective = resolveCurrentObjective(session);
      if (!objective) {
        return previousValue;
      }

      const now = Date.now();
      const needsTape = objectiveNeedsTape(objective, session.unlockedTapeAreas);

      return {
        ...previousValue,
        currentSession: {
          ...session,
          enteredLevelAt: now,
          tapeStartedAt: needsTape ? now : null,
          phase: needsTape ? "tape" : "challenge",
          phaseStartedAt: now,
          challengeStartedAt: needsTape ? null : now
        }
      };
    });
  }

  function unlockTape() {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session || session.phase !== "tape") {
        return previousValue;
      }

      const objective = resolveCurrentObjective(session);
      if (!objective) {
        return previousValue;
      }

      const now = Date.now();
      const unlockedTapeAreas = session.unlockedTapeAreas.includes(objective.area)
        ? session.unlockedTapeAreas
        : [...session.unlockedTapeAreas, objective.area];

      return {
        ...previousValue,
        currentSession: {
          ...session,
          unlockedTapeAreas,
          tapeUnlockedAt: now,
          phase: "challenge",
          phaseStartedAt: now,
          challengeStartedAt: now
        }
      };
    });
  }

  function togglePause() {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session) {
        return previousValue;
      }

      if (!session.pausedAt) {
        return {
          ...previousValue,
          currentSession: {
            ...session,
            pausedAt: Date.now()
          }
        };
      }

      const resumedAt = Date.now();
      const pauseDurationMs = Math.max(0, resumedAt - session.pausedAt);
      const phaseKey = getPhasePausedKey(session.phase);

      return {
        ...previousValue,
        currentSession: {
          ...session,
          pausedAt: null,
          totalPausedMs: session.totalPausedMs + pauseDurationMs,
          sessionTotalPausedMs: session.sessionTotalPausedMs + pauseDurationMs,
          [phaseKey]: session[phaseKey] + pauseDurationMs
        }
      };
    });
  }

  function endSession() {
    updateState((previousValue) => ({
      ...previousValue,
      startCountdown: null,
      currentSession: null
    }));
  }

  function completeObjective() {
    resolveObjective("complete");
  }

  function skipObjective() {
    resolveObjective("skip");
  }

  function skipCurrentSplit() {
    if (!currentSession) {
      return;
    }

    if (currentSession.phase === "challenge") {
      skipObjective();
      return;
    }

    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session) {
        return previousValue;
      }

      const objective = resolveCurrentObjective(session);
      if (!objective) {
        return {
          ...previousValue,
          currentSession: null
        };
      }

      return {
        ...previousValue,
        currentSession: skipSessionSplit({
          session,
          objective,
          now: Date.now()
        })
      };
    });
  }

  function resolveObjective(result) {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session) {
        return previousValue;
      }

      const objective = resolveCurrentObjective(session);
      if (!objective) {
        return {
          ...previousValue,
          currentSession: null
        };
      }

      const endedAt = Date.now();
      const travelStartedAt = session.objectiveStartedAt ?? endedAt;
      const levelEnteredAt = session.enteredLevelAt;
      const challengeStartedAt = session.challengeStartedAt;
      const previousBestMs = previousValue.bestTimesByObjective[objective.id]?.durationMs ?? null;
      const totalDurationMs = endedAt - travelStartedAt - session.totalPausedMs;
      const travelDurationMs =
        typeof levelEnteredAt === "number"
          ? Math.max(0, levelEnteredAt - travelStartedAt - session.travelPausedMs)
          : objective.area === session.currentArea
            ? 0
            : null;
      const tapeDurationMs =
        typeof session.tapeUnlockedAt === "number" && typeof session.tapeStartedAt === "number"
          ? Math.max(0, session.tapeUnlockedAt - session.tapeStartedAt - session.tapePausedMs)
          : null;
      const challengeDurationMs =
        typeof challengeStartedAt === "number"
          ? Math.max(0, endedAt - challengeStartedAt - session.challengePausedMs)
          : null;
      const historyEntry = {
        sessionId: session.id,
        objectiveId: objective.id,
        label: objective.label,
        area: objective.area,
        district: objective.district,
        type: objective.type,
        runClass: objective.runClass,
        result,
        durationMs: challengeDurationMs ?? totalDurationMs,
        totalDurationMs,
        travelDurationMs,
        tapeDurationMs,
        challengeDurationMs,
        previousBestMs,
        pbDiffMs:
          previousBestMs !== null && challengeDurationMs !== null
            ? challengeDurationMs - previousBestMs
            : null,
        startedAt: travelStartedAt,
        endedAt
      };
      const nextHistory = [...previousValue.history, historyEntry];
      const nextTransition = resolveSeededSessionTransition({
        session,
        currentObjective: objective,
        result,
        endedAt,
        objectiveLookup: (objectiveId) => objectivesById[objectiveId]
      });

      if (!nextTransition.nextObjective) {
        const squaresCleared = nextHistory.reduce((count, entry) => {
          if (entry.sessionId === session.id && entry.result === "complete") {
            return count + 1;
          }

          return count;
        }, 0);
        const sessionSpec = {
          ...session.sessionSpec,
          config: {
            ...session.sessionSpec.config
          },
          objectiveIds: session.sessionSpec.objectiveIds.slice()
        };

        return {
          ...previousValue,
          history: nextHistory,
          bestTimesByObjective: recordBestTime(previousValue.bestTimesByObjective, historyEntry),
          aggregateStats: recordCompletionStats(previousValue.aggregateStats, historyEntry),
          pendingCompletion: {
            ...nextTransition.completionSummary,
            exportSeed: session.exportSeed ?? nextTransition.completionSummary.exportSeed ?? "",
            squaresCleared,
            sessionSpec
          },
          currentSession: null
        };
      }

      return {
        ...previousValue,
        history: nextHistory,
        bestTimesByObjective: recordBestTime(previousValue.bestTimesByObjective, historyEntry),
        aggregateStats: recordCompletionStats(previousValue.aggregateStats, historyEntry),
        pendingCompletion: null,
        currentSession: {
          ...buildSeededSessionState({
            sessionId: session.id,
            now: endedAt,
            currentArea: nextTransition.nextArea,
            objective: nextTransition.nextObjective,
            currentObjectiveIndex: nextTransition.nextObjectiveIndex,
            sessionSpec: session.sessionSpec,
            exportSeed: session.exportSeed,
            unlockedTapeAreas: session.unlockedTapeAreas,
            sessionStartedAt: session.sessionStartedAt,
            sessionTotalPausedMs: session.sessionTotalPausedMs
          }),
          ui: {
            learnPanelVisible: resolveSessionLearnPanelVisible(
              session,
              previousValue.settings
            )
          }
        }
      };
    });
  }

  function goToModeSelect() {
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: null,
      startCountdown: null
    }));
  }

  function goToPractice() {
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: "practice",
      startCountdown: null
    }));
  }

  function goToSettings() {
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: "settings",
      startCountdown: null
    }));
  }

  function toggleLearnPanelVisibility() {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session) {
        return previousValue;
      }

      const currentValue = resolveSessionLearnPanelVisible(session, previousValue.settings);

      return {
        ...previousValue,
        currentSession: {
          ...session,
          ui: {
            ...session.ui,
            learnPanelVisible: !currentValue
          }
        }
      };
    });
  }

  function updateSettings(settingsUpdater) {
    updateState((previousValue) => ({
      ...previousValue,
      settings:
        typeof settingsUpdater === "function"
          ? settingsUpdater(previousValue.settings)
          : {
              ...previousValue.settings,
              ...settingsUpdater
            }
    }));
  }

  function updateHotkey(action, binding) {
    const normalizedBinding = normalizeHotkeyBinding(binding);
    updateSettings((previousSettings) => {
      const nextHotkeys = {
        ...previousSettings.hotkeys
      };
      nextHotkeys[action] = normalizedBinding;

      return {
        ...previousSettings,
        hotkeys: nextHotkeys
      };
    });
  }

  function clearHotkey(action) {
    updateSettings((previousSettings) => ({
      ...previousSettings,
      hotkeys: {
        ...previousSettings.hotkeys,
        [action]: null
      }
    }));
  }

  function resetAllData() {
    setAppState(createDefaultAppState());
  }

  function deleteHistoryEntry(historyIndex) {
    updateState((previousValue) => {
      if (
        !Number.isInteger(historyIndex) ||
        historyIndex < 0 ||
        historyIndex >= previousValue.history.length
      ) {
        return previousValue;
      }

      const nextHistory = previousValue.history.filter((_, index) => index !== historyIndex);
      const rebuiltPerformance = rebuildPerformanceState(nextHistory);

      return {
        ...previousValue,
        history: nextHistory,
        ...rebuiltPerformance
      };
    });
  }

  function clearPendingCompletion() {
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: "practice",
      pendingCompletion: null
    }));
  }

  function replayPendingCompletion() {
    if (!pendingCompletion?.sessionSpec?.objectiveIds?.length) {
      return;
    }

    const replayObjectiveId = pendingCompletion.sessionSpec.objectiveIds[0];
    if (!replayObjectiveId || !objectivesById[replayObjectiveId]) {
      return;
    }

    const sessionSpec = {
      ...pendingCompletion.sessionSpec,
      config: {
        ...pendingCompletion.sessionSpec.config
      },
      objectiveIds: pendingCompletion.sessionSpec.objectiveIds.slice()
    };

    try {
      startSession({
        sessionSpec,
        exportSeed: pendingCompletion.exportSeed
      });
    } catch (error) {
      console.warn("Failed to replay pending completion", error);
    }
  }

  async function copyPendingCompletionSeed() {
    const exportSeed = pendingCompletion?.exportSeed;
    if (!exportSeed) {
      return false;
    }

    if (!globalThis.navigator?.clipboard?.writeText) {
      return false;
    }

    try {
      await globalThis.navigator.clipboard.writeText(exportSeed);
      return true;
    } catch {
      return false;
    }
  }

  function performPhaseAction() {
    if (!currentSession) {
      return;
    }

    if (currentSession.phase === "travel") {
      markEnteredLevel();
      return;
    }

    if (currentSession.phase === "tape") {
      unlockTape();
      return;
    }

    completeObjective();
  }

  const phaseActionLabel = getPhaseActionLabel(currentSession?.phase);
  const startCountdownLabel = resolveStartCountdownLabel(startCountdown, countdownNow);

  return {
    currentSession,
    currentObjective,
    history,
    stats,
    phaseInfo,
    pendingCompletion,
    settings: appState.settings,
    startingArea: appState.settings.startingArea,
    selectedMode: appState.selectedMode,
    startCountdownLabel,
    isStartCountdownActive: startCountdown !== null,
    startSession,
    markEnteredLevel,
    unlockTape,
    togglePause,
    phaseActionLabel,
    performPhaseAction,
    completeObjective,
    skipCurrentSplit,
    skipObjective,
    endSession,
    clearPendingCompletion,
    replayPendingCompletion,
    copyPendingCompletionSeed,
    goToModeSelect,
    goToPractice,
    goToSettings,
    toggleLearnPanelVisibility,
    updateSettings,
    updateHotkey,
    clearHotkey,
    resetAllData,
    deleteHistoryEntry
  };
}
