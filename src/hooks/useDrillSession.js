import { useState } from "react";

import { objectivesById } from "../data/objectives.js";
import {
  buildSeededSessionState,
  buildSessionPhaseViewModel,
  getPhaseActionLabel,
  getPhasePausedKey,
  objectiveNeedsTape,
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

function buildSessionId() {
  return `session_${Date.now()}`;
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

export function useDrillSession(appState, setAppState) {
  const [completionSummary, setCompletionSummary] = useState(null);
  const currentSession = appState.currentSession;
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

  function setSelectedMode(selectedMode) {
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode
    }));
  }

  function startSession(sessionLaunch) {
    setCompletionSummary(null);

    updateState((previousValue) => {
      const sessionSpec = sessionLaunch?.sessionSpec;
      const exportSeed = sessionLaunch?.exportSeed ?? "";

      if (!sessionSpec?.objectiveIds?.length) {
        return {
          ...previousValue,
          currentSession: null
        };
      }

      const firstObjective = objectivesById[sessionSpec.objectiveIds[0]];
      if (!firstObjective) {
        return {
          ...previousValue,
          currentSession: null
        };
      }

      const sessionId = buildSessionId();
      const now = Date.now();
      const selectedMode = previousValue.selectedMode ?? "drills";
      const nextSettings = {
        ...previousValue.settings,
        startingArea: sessionSpec.config.startingArea,
        drillSettings: sessionSpec.config
      };

      return {
        ...previousValue,
        selectedMode,
        settings: nextSettings,
        currentSession: buildSeededSessionState({
          sessionId,
          now,
          currentArea: sessionSpec.config.startingArea,
          objective: firstObjective,
          currentObjectiveIndex: 0,
          sessionSpec,
          exportSeed
        })
      };
    });
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
    setCompletionSummary(null);
    updateState((previousValue) => ({
      ...previousValue,
      currentSession: null
    }));
  }

  function completeObjective() {
    resolveObjective("complete");
  }

  function skipObjective() {
    resolveObjective("skip");
  }

  function resolveObjective(result) {
    let nextCompletionSummary = null;

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
        nextCompletionSummary = nextTransition.completionSummary;

        return {
          ...previousValue,
          history: nextHistory,
          bestTimesByObjective: recordBestTime(previousValue.bestTimesByObjective, historyEntry),
          aggregateStats: recordCompletionStats(previousValue.aggregateStats, historyEntry),
          currentSession: null
        };
      }

      return {
        ...previousValue,
        history: nextHistory,
        bestTimesByObjective: recordBestTime(previousValue.bestTimesByObjective, historyEntry),
        aggregateStats: recordCompletionStats(previousValue.aggregateStats, historyEntry),
        currentSession: buildSeededSessionState({
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
        })
      };
    });

    if (nextCompletionSummary) {
      setCompletionSummary(nextCompletionSummary);
    }
  }

  function goToModeSelect() {
    setSelectedMode(null);
  }

  function goToDrills() {
    setSelectedMode("drills");
  }

  function goToLearn() {
    setSelectedMode("learn");
  }

  function goToSettings() {
    setSelectedMode("settings");
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
    setCompletionSummary(null);
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

  function dismissCompletionSummary() {
    setCompletionSummary(null);
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

  return {
    currentSession,
    currentObjective,
    history,
    stats,
    phaseInfo,
    completionSummary,
    settings: appState.settings,
    startingArea: appState.settings.startingArea,
    selectedMode: appState.selectedMode,
    startSession,
    markEnteredLevel,
    unlockTape,
    togglePause,
    phaseActionLabel,
    performPhaseAction,
    completeObjective,
    skipObjective,
    endSession,
    dismissCompletionSummary,
    goToModeSelect,
    goToDrills,
    goToLearn,
    goToSettings,
    updateSettings,
    updateHotkey,
    clearHotkey,
    resetAllData,
    deleteHistoryEntry
  };
}
