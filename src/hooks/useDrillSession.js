import { allObjectives, objectivesById } from "../data/objectives.js";
import { normalizeDrillSettings } from "../lib/drillSettings.js";
import { generateNextDrill } from "../lib/drillGenerator.js";
import {
  buildObjectiveSessionState,
  buildSessionPhaseViewModel,
  getPhaseActionLabel,
  getPhasePausedKey,
  objectiveNeedsTape
} from "../lib/drillSession.js";
import { normalizeHotkeyBinding } from "../lib/hotkeys.js";
import { createDefaultAppState, normalizeAppState } from "../lib/storage.js";
import {
  buildStatsViewModel,
  recordBestTime,
  recordCompletionStats
} from "../lib/stats.js";

function buildSessionId() {
  return `session_${Date.now()}`;
}

function resolveCurrentObjective(currentSession) {
  if (!currentSession?.currentObjectiveId) {
    return null;
  }

  return objectivesById[currentSession.currentObjectiveId] ?? null;
}

export function useDrillSession(appState, setAppState) {
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

  function startSession(startingArea, drillSettingsInput) {
    updateState((previousValue) => {
      const sessionId = buildSessionId();
      const now = Date.now();
      const selectedMode = previousValue.selectedMode ?? "drills";
      const drillSettings = normalizeDrillSettings(
        drillSettingsInput ?? previousValue.settings.drillSettings
      );
      const objective = generateNextDrill(allObjectives, {
        currentArea: startingArea,
        requiredArea:
          startingArea === "Garage" || drillSettings.excludedAreas.includes(startingArea)
            ? null
            : startingArea,
        usedObjectiveIds: [],
        history: [],
        sessionId,
        drillSettings
      });
      const nextState = {
        ...previousValue,
        selectedMode,
        settings: {
          ...previousValue.settings,
          startingArea,
          drillSettings
        }
      };

      if (!objective) {
        return {
          ...nextState,
          currentSession: null
        };
      }

      return {
        ...nextState,
        currentSession: buildObjectiveSessionState({
          session: {
            id: sessionId,
            startedAt: now,
            unlockedTapeAreas: []
          },
          currentArea: startingArea,
          objective,
          now,
          usedObjectiveIds: [objective.id],
          drillSettings
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

      const objective = objectivesById[session.currentObjectiveId];
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

      const objective = objectivesById[session.currentObjectiveId];
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
          [phaseKey]: session[phaseKey] + pauseDurationMs
        }
      };
    });
  }

  function endSession() {
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
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session) {
        return previousValue;
      }

      const objective = objectivesById[session.currentObjectiveId];
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
      const nextArea =
        result === "skip"
          ? session.currentArea
          : objective.area ?? session.currentArea;
      const nextObjective = generateNextDrill(allObjectives, {
        currentArea: nextArea,
        usedObjectiveIds: session.usedObjectiveIds,
        history: nextHistory,
        sessionId: session.id,
        drillSettings: session.drillSettings ?? previousValue.settings.drillSettings
      });

      return {
        ...previousValue,
        history: nextHistory,
        bestTimesByObjective: recordBestTime(previousValue.bestTimesByObjective, historyEntry),
        aggregateStats: recordCompletionStats(previousValue.aggregateStats, historyEntry),
        currentSession: nextObjective
          ? buildObjectiveSessionState({
              session: {
                ...session,
                unlockedTapeAreas: session.unlockedTapeAreas
              },
              currentArea: nextArea,
              objective: nextObjective,
              now: endedAt,
              usedObjectiveIds: [...session.usedObjectiveIds, nextObjective.id],
              drillSettings: session.drillSettings ?? previousValue.settings.drillSettings
            })
          : null
      };
    });
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
    setAppState(createDefaultAppState());
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
    goToModeSelect,
    goToDrills,
    goToLearn,
    goToSettings,
    updateSettings,
    updateHotkey,
    clearHotkey,
    resetAllData
  };
}
