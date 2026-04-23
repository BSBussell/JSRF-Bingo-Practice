import { useEffect, useRef, useState } from "react";

import { objectivesById } from "../data/objectives.js";
import { normalizeHotkeyBinding } from "../lib/hotkeys.js";
import {
  buildRouteHistoryEntry,
  buildRouteSessionState,
  completeRouteSlot as resolveRouteSlotCompletion,
  resolveRouteVisibleSlots
} from "../lib/session/routeSession.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE,
  normalizeSessionType
} from "../lib/session/sessionTypes.js";
import {
  buildSeededSessionState,
  buildSessionPhaseViewModel,
  getPhaseActionLabel,
  getPhasePausedKey,
  objectiveNeedsTape,
  resolveSeededSessionTransition,
  skipSessionSplit
} from "../lib/session/drillSession.js";
import { mergeSessionConfigIntoDrillSettings } from "../lib/session/sessionConfig.js";
import { resolveSeedInput } from "../lib/seed/sessionSeed.js";
import {
  SEED_BUILDER_MODE,
  normalizeSeedBuilderDraft
} from "../lib/seedBuilder.js";
import { buildObjectivePracticeLaunch } from "../lib/session/objectivePractice.js";
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
const SESSION_FEEDBACK_VISIBLE_MS = 2850;
const PRACTICE_COMPLETION_RECOGNITION_MS = 1700;

function buildSessionId() {
  return `session_${Date.now()}`;
}

function buildCountdownId() {
  return `countdown_${Date.now()}`;
}

function resolveCurrentObjective(currentSession) {
  if (!currentSession?.objectiveIds?.length || currentSession.sessionType === ROUTE_SESSION_TYPE) {
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
  if (!Number.isFinite(startCountdown?.startedAt)) {
    return null;
  }

  return startCountdown.startedAt + START_COUNTDOWN_DURATION_MS;
}

function resolveStartCountdownLabel(startCountdown, now) {
  if (!startCountdown || !Number.isFinite(startCountdown.startedAt)) {
    return null;
  }

  const elapsedMs = Math.max(0, now - startCountdown.startedAt);
  const stepIndex = Math.min(
    START_COUNTDOWN_SEQUENCE.length - 1,
    Math.floor(elapsedMs / START_COUNTDOWN_STEP_MS)
  );

  return START_COUNTDOWN_SEQUENCE[stepIndex] ?? null;
}

function cloneSessionSpecForLaunch(sessionSpec, sessionType) {
  return {
    ...sessionSpec,
    sessionType: normalizeSessionType(sessionType ?? sessionSpec?.sessionType),
    config: {
      ...sessionSpec.config
    },
    objectiveIds: sessionSpec.objectiveIds.slice()
  };
}

function resolveSelectedMode(previousValue, requestedMode) {
  const activeSessionType = normalizeSessionType(
    previousValue.currentSession?.sessionType ?? previousValue.startCountdown?.sessionSpec?.sessionType
  );

  return previousValue.currentSession || previousValue.startCountdown
    ? activeSessionType
    : requestedMode;
}

function buildPracticeHistoryEntry({
  session,
  objective,
  result,
  endedAt,
  previousBestMs,
  completionSummary = null
}) {
  const travelStartedAt = session.objectiveStartedAt ?? endedAt;
  const levelEnteredAt = session.enteredLevelAt;
  const challengeStartedAt = session.challengeStartedAt;
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
  const scoreDurationMs = challengeDurationMs ?? totalDurationMs;
  const sessionElapsedAtCompleteMs = Math.max(
    0,
    endedAt - session.sessionStartedAt - (session.sessionTotalPausedMs ?? 0)
  );

  return {
    sessionType: PRACTICE_SESSION_TYPE,
    sessionId: session.id,
    objectiveId: objective.id,
    label: objective.label,
    area: objective.area,
    district: objective.district,
    type: objective.type,
    runClass: objective.runClass,
    result,
    durationMs: scoreDurationMs,
    totalDurationMs,
    travelDurationMs,
    tapeDurationMs,
    challengeDurationMs,
    previousBestMs,
    pbDiffMs:
      previousBestMs !== null && challengeDurationMs !== null
        ? challengeDurationMs - previousBestMs
        : null,
    exportSeed: session.exportSeed ?? "",
    sessionObjectiveIndex: session.currentObjectiveIndex ?? 0,
    sessionElapsedAtCompleteMs,
    sessionCompleted: Boolean(completionSummary),
    sessionObjectiveCount: Array.isArray(session.objectiveIds) ? session.objectiveIds.length : 0,
    sessionTotalDurationMs: completionSummary?.totalDurationMs ?? null,
    startedAt: travelStartedAt,
    endedAt
  };
}

function buildPracticeSeedPbFeedback({
  history,
  session,
  currentElapsedMs
}) {
  const exportSeed = session.exportSeed ?? "";
  const objectiveIndex = session.currentObjectiveIndex ?? 0;
  const skippedSessionIds = Array.isArray(history)
    ? history.reduce((sessionIds, entry) => {
        if (
          normalizeSessionType(entry?.sessionType) === PRACTICE_SESSION_TYPE &&
          entry?.result === "skip" &&
          typeof entry.sessionId === "string" &&
          entry.sessionId
        ) {
          sessionIds.add(entry.sessionId);
        }

        return sessionIds;
      }, new Set())
    : new Set();

  if (!exportSeed || !Array.isArray(history)) {
    return {
      seedPbStatus: "no-prior",
      seedPbDiffMs: null
    };
  }

  if (skippedSessionIds.has(session.id)) {
    return {
      seedPbStatus: "incomplete",
      seedPbDiffMs: null
    };
  }

  const bestSeedCompletion = history.reduce((bestEntry, entry) => {
    if (
      entry?.sessionType !== PRACTICE_SESSION_TYPE ||
      entry.result !== "complete" ||
      entry.exportSeed !== exportSeed ||
      entry.sessionId === session.id ||
      skippedSessionIds.has(entry.sessionId) ||
      entry.sessionCompleted !== true ||
      typeof entry.sessionTotalDurationMs !== "number"
    ) {
      return bestEntry;
    }

    if (!bestEntry || entry.sessionTotalDurationMs < bestEntry.sessionTotalDurationMs) {
      return entry;
    }

    return bestEntry;
  }, null);

  if (!bestSeedCompletion) {
    return {
      seedPbStatus: "no-prior",
      seedPbDiffMs: null
    };
  }

  const referenceEntry = history.find((entry) =>
    entry?.sessionId === bestSeedCompletion.sessionId &&
    entry.sessionObjectiveIndex === objectiveIndex &&
    typeof entry.sessionElapsedAtCompleteMs === "number"
  );

  if (!referenceEntry) {
    return {
      seedPbStatus: "no-prior",
      seedPbDiffMs: null
    };
  }

  return {
    seedPbStatus: "delta",
    seedPbDiffMs: currentElapsedMs - referenceEntry.sessionElapsedAtCompleteMs
  };
}

function buildRouteWaveSeedPbFeedback({
  history,
  session,
  completedCount,
  currentElapsedMs
}) {
  const exportSeed = session.exportSeed ?? "";

  if (!exportSeed || !Array.isArray(history)) {
    return {
      seedPbStatus: "no-prior",
      seedPbDiffMs: null
    };
  }

  const bestSeedCompletion = history.reduce((bestEntry, entry) => {
    if (
      entry?.sessionType !== ROUTE_SESSION_TYPE ||
      entry.result !== "complete" ||
      entry.exportSeed !== exportSeed ||
      entry.sessionId === session.id ||
      typeof entry.totalDurationMs !== "number" ||
      !Array.isArray(entry.routeClearEvents)
    ) {
      return bestEntry;
    }

    if (!bestEntry || entry.totalDurationMs < bestEntry.totalDurationMs) {
      return entry;
    }

    return bestEntry;
  }, null);

  if (!bestSeedCompletion) {
    return {
      seedPbStatus: "no-prior",
      seedPbDiffMs: null
    };
  }

  const referenceEvent = bestSeedCompletion.routeClearEvents[completedCount - 1];
  if (!referenceEvent || typeof referenceEvent.elapsedMs !== "number") {
    return {
      seedPbStatus: "no-prior",
      seedPbDiffMs: null
    };
  }

  return {
    seedPbStatus: "delta",
    seedPbDiffMs: currentElapsedMs - referenceEvent.elapsedMs
  };
}

function buildRouteSlotCompletionFeedback({
  history,
  session,
  routeClearEvent,
  eventIndex
}) {
  const completedCount = eventIndex + 1;
  const visibleCount = Math.max(
    1,
    session.sessionSpec?.config?.routeVisibleCount ?? session.visibleCount ?? 1
  );
  const waveComplete = completedCount % visibleCount === 0;
  const seedPbFeedback = waveComplete
    ? buildRouteWaveSeedPbFeedback({
        history,
        session: {
          ...session,
          id: session.id ?? session.sessionId
        },
        completedCount,
        currentElapsedMs: routeClearEvent.elapsedMs
      })
    : {};

  return {
    id: `route_complete_${routeClearEvent.endedAt}_${routeClearEvent.slotIndex}`,
    type: "route-square-complete",
    slotIndex: routeClearEvent.slotIndex,
    objectiveId: routeClearEvent.objectiveId,
    waveComplete,
    visibleCount,
    completedCount,
    objectiveCount: session.objectiveIds?.length ?? session.objectiveCount ?? completedCount,
    elapsedMs: routeClearEvent.elapsedMs,
    ...seedPbFeedback
  };
}

function buildPracticeCompletionFeedback(historyEntry) {
  const durationMs = historyEntry.challengeDurationMs ?? historyEntry.durationMs ?? null;
  const previousBestMs = historyEntry.previousBestMs;

  if (previousBestMs === null || typeof previousBestMs !== "number") {
    return {
      durationMs,
      pbStatus: "no-prior",
      pbDiffMs: null
    };
  }

  const pbDiffMs = typeof historyEntry.pbDiffMs === "number"
    ? historyEntry.pbDiffMs
    : null;

  return {
    durationMs,
    pbStatus:
      pbDiffMs === null
        ? "no-prior"
        : pbDiffMs < 0
          ? "new-pb"
          : pbDiffMs === 0
            ? "tied-pb"
            : "missed-pb",
    pbDiffMs
  };
}

export function useDrillSession(appState, setAppState) {
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [sessionFeedback, setSessionFeedback] = useState(null);
  const pendingPracticeResolutionRef = useRef(null);
  const pendingRouteFeedbackRef = useRef(null);
  const currentSession = appState.currentSession;
  const startCountdown = appState.startCountdown;
  const pendingCompletion = appState.pendingCompletion;
  const currentObjective = resolveCurrentObjective(currentSession);
  const routeSlots = resolveRouteVisibleSlots(
    currentSession,
    (objectiveId) => objectivesById[objectiveId]
  );
  const history = appState.history;
  const stats = buildStatsViewModel(appState.aggregateStats);
  const phaseInfo =
    currentSession?.sessionType === ROUTE_SESSION_TYPE
      ? null
      : buildSessionPhaseViewModel({
          currentSession,
          currentObjective,
          aggregateStats: appState.aggregateStats,
          bestTimesByObjective: appState.bestTimesByObjective
        });

  function clearPendingPracticeResolution() {
    if (pendingPracticeResolutionRef.current?.timeoutId) {
      window.clearTimeout(pendingPracticeResolutionRef.current.timeoutId);
    }

    pendingPracticeResolutionRef.current = null;
  }

  useEffect(
    () => () => {
      clearPendingPracticeResolution();
    },
    []
  );

  useEffect(
    () => {
      const request = pendingRouteFeedbackRef.current;
      if (!request) {
        return;
      }

      const routeFeedbackSource =
        currentSession?.sessionType === ROUTE_SESSION_TYPE &&
        currentSession.id === request.sessionId
          ? currentSession
          : pendingCompletion?.sessionType === ROUTE_SESSION_TYPE &&
              pendingCompletion.sessionId === request.sessionId
            ? pendingCompletion
            : null;

      if (!routeFeedbackSource) {
        return;
      }

      const routeClearEvents = Array.isArray(routeFeedbackSource.routeClearEvents)
        ? routeFeedbackSource.routeClearEvents
        : [];
      const eventIndex = routeClearEvents.findIndex((event) =>
        event.endedAt === request.endedAt &&
        event.slotIndex === request.slotIndex
      );

      pendingRouteFeedbackRef.current = null;

      if (eventIndex < 0) {
        return;
      }

      setSessionFeedback(buildRouteSlotCompletionFeedback({
        history: appState.history,
        session: routeFeedbackSource,
        routeClearEvent: routeClearEvents[eventIndex],
        eventIndex
      }));
    },
    [appState.history, currentSession, pendingCompletion]
  );

  function updateState(updater) {
    setAppState((previousValue) => normalizeAppState(updater(previousValue)));
  }

  useEffect(
    () => {
      if (!startCountdown || !Number.isFinite(startCountdown.startedAt)) {
        return undefined;
      }

      let timeoutId = null;

      function scheduleCountdownTick() {
        const now = Date.now();
        setCountdownNow(now);

        const launchAt = resolveStartCountdownDeadline(startCountdown);
        if (!launchAt) {
          return;
        }
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
      if (!startCountdown || !Number.isFinite(startCountdown.startedAt)) {
        return undefined;
      }

      const countdownDeadline = resolveStartCountdownDeadline(startCountdown);
      if (!countdownDeadline) {
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
          const launchedAt = resolveStartCountdownDeadline(pendingStartCountdown) ?? Date.now();
          const sessionType = normalizeSessionType(sessionSpec.sessionType);
          const nextSettings = {
            ...previousValue.settings,
            startingArea: sessionSpec.config.startingArea,
            drillSettings: mergeSessionConfigIntoDrillSettings(
              previousValue.settings.drillSettings,
              sessionSpec.config,
              sessionType
            )
          };

          return {
            ...previousValue,
            selectedMode: sessionType,
            settings: nextSettings,
            pendingCompletion: null,
            startCountdown: null,
            currentSession:
              sessionType === ROUTE_SESSION_TYPE
                ? buildRouteSessionState({
                    sessionId: pendingStartCountdown.sessionId,
                    now: launchedAt,
                    sessionSpec,
                    exportSeed
                  })
                : {
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
      }, Math.max(0, countdownDeadline - Date.now()));

      return () => {
        window.clearTimeout(timeoutId);
      };
    },
    [startCountdown, setAppState]
  );

  useEffect(
    () => {
      if (!sessionFeedback) {
        return undefined;
      }

      const timeoutId = window.setTimeout(() => {
        setSessionFeedback((currentFeedback) =>
          currentFeedback?.id === sessionFeedback.id ? null : currentFeedback
        );
      }, SESSION_FEEDBACK_VISIBLE_MS);

      return () => {
        window.clearTimeout(timeoutId);
      };
    },
    [sessionFeedback]
  );

  useEffect(
    () => {
      pendingRouteFeedbackRef.current = null;
      setSessionFeedback(null);
    },
    [appState.selectedMode]
  );

  function startSession(sessionLaunch) {
    if (startCountdown) {
      return;
    }

    setSessionFeedback(null);
    pendingRouteFeedbackRef.current = null;

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
    const sessionType = normalizeSessionType(sessionSpec.sessionType);

    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: sessionType,
      currentSession: null,
      pendingCompletion: null,
      startCountdown: {
        id: countdownId,
        sessionId: buildSessionId(),
        startedAt: null,
        sessionSpec: cloneSessionSpecForLaunch(sessionSpec, sessionType),
        exportSeed
      }
    }));
  }

  function beginStartCountdown() {
    updateState((previousValue) => {
      const pendingStartCountdown = previousValue.startCountdown;
      if (!pendingStartCountdown || Number.isFinite(pendingStartCountdown.startedAt)) {
        return previousValue;
      }

      return {
        ...previousValue,
        startCountdown: {
          ...pendingStartCountdown,
          startedAt: Date.now()
        }
      };
    });
  }

  function restartCurrentSession() {
    const session = currentSession;
    const sessionSpec = session?.sessionSpec;
    if (
      !session ||
      !sessionSpec?.objectiveIds?.length ||
      !objectivesById[sessionSpec.objectiveIds[0]]
    ) {
      return false;
    }

    clearPendingPracticeResolution();
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);

    const sessionType = normalizeSessionType(session.sessionType ?? sessionSpec.sessionType);
    const nextSessionSpec = cloneSessionSpecForLaunch(sessionSpec, sessionType);
    const exportSeed = session.exportSeed ?? "";
    const countdownId = buildCountdownId();
    const restartedSessionId = buildSessionId();

    updateState((previousValue) => {
      return {
        ...previousValue,
        selectedMode: sessionType,
        pendingCompletion: null,
        currentSession: null,
        startCountdown: {
          id: countdownId,
          sessionId: restartedSessionId,
          startedAt: null,
          sessionSpec: nextSessionSpec,
          exportSeed
        }
      };
    });

    return true;
  }

  function markEnteredLevel() {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session || session.sessionType === ROUTE_SESSION_TYPE || session.phase !== "travel") {
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
      if (!session || session.sessionType === ROUTE_SESSION_TYPE || session.phase !== "tape") {
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
    if (pendingPracticeResolutionRef.current) {
      return;
    }

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

      if (session.sessionType === ROUTE_SESSION_TYPE) {
        return {
          ...previousValue,
          currentSession: {
            ...session,
            pausedAt: null,
            totalPausedMs: (session.totalPausedMs ?? 0) + pauseDurationMs,
            sessionTotalPausedMs: (session.sessionTotalPausedMs ?? 0) + pauseDurationMs
          }
        };
      }

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
    clearPendingPracticeResolution();
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      startCountdown: null,
      currentSession: null
    }));
  }

  function completeObjective() {
    if (
      !currentSession ||
      currentSession.sessionType === ROUTE_SESSION_TYPE ||
      !currentObjective ||
      pendingPracticeResolutionRef.current
    ) {
      return;
    }

    const endedAt = Date.now();
    const previousBestMs = appState.bestTimesByObjective[currentObjective.id]?.durationMs ?? null;
    const feedbackEntry = buildPracticeHistoryEntry({
      session: currentSession,
      objective: currentObjective,
      result: "complete",
      endedAt,
      previousBestMs
    });
    const completionFeedback = buildPracticeCompletionFeedback(feedbackEntry);
    const seedPbFeedback = buildPracticeSeedPbFeedback({
      history: appState.history,
      session: currentSession,
      currentElapsedMs: feedbackEntry.sessionElapsedAtCompleteMs
    });

    setSessionFeedback({
      id: `practice_complete_${endedAt}`,
      type: "practice-square-complete",
      objectiveId: currentObjective.id,
      ...completionFeedback,
      ...seedPbFeedback
    });

    const timeoutId = window.setTimeout(() => {
      const pendingResolution = pendingPracticeResolutionRef.current;
      pendingPracticeResolutionRef.current = null;
      resolveObjective("complete", {
        endedAt,
        transitionAt: Date.now(),
        expectedSessionId: pendingResolution?.sessionId,
        expectedObjectiveId: pendingResolution?.objectiveId
      });
    }, PRACTICE_COMPLETION_RECOGNITION_MS);

    pendingPracticeResolutionRef.current = {
      sessionId: currentSession.id,
      objectiveId: currentObjective.id,
      timeoutId
    };
  }

  function skipObjective() {
    if (currentSession?.sessionType === ROUTE_SESSION_TYPE || pendingPracticeResolutionRef.current) {
      return;
    }

    resolveObjective("skip");
  }

  function completeRouteSlot(slotIndex) {
    const completedSlot = routeSlots.find((slot) => slot.slotIndex === slotIndex);

    if (
      !currentSession ||
      currentSession.sessionType !== ROUTE_SESSION_TYPE ||
      currentSession.pausedAt ||
      !completedSlot?.objective
    ) {
      return;
    }

    const endedAt = Date.now();
    pendingRouteFeedbackRef.current = {
      sessionId: currentSession.id,
      slotIndex,
      endedAt
    };

    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (
        !session ||
        session.sessionType !== ROUTE_SESSION_TYPE ||
        session.id !== currentSession.id
      ) {
        return previousValue;
      }

      if (session.pausedAt) {
        return previousValue;
      }

      const routeResolution = resolveRouteSlotCompletion({
        session,
        slotIndex,
        endedAt
      });

      if (routeResolution.completedObjectiveId === null) {
        return previousValue;
      }

      if (routeResolution.nextSession) {
        return {
          ...previousValue,
          currentSession: routeResolution.nextSession
        };
      }

      const routeResult = routeResolution.completionResult;
      if (!routeResult) {
        return previousValue;
      }

      const historyEntry = buildRouteHistoryEntry(routeResult);
      const nextHistory = [...previousValue.history, historyEntry];
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
        aggregateStats: recordCompletionStats(previousValue.aggregateStats, historyEntry),
        pendingCompletion: {
          ...routeResult,
          exportSeed: session.exportSeed ?? routeResult.exportSeed ?? "",
          sessionSpec
        },
        currentSession: null
      };
    });
  }

  function skipCurrentSplit() {
    if (
      !currentSession ||
      currentSession.sessionType === ROUTE_SESSION_TYPE ||
      pendingPracticeResolutionRef.current
    ) {
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

  function resolveObjective(result, options = {}) {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session || session.sessionType === ROUTE_SESSION_TYPE) {
        return previousValue;
      }

      if (options.expectedSessionId && session.id !== options.expectedSessionId) {
        return previousValue;
      }

      const objective = resolveCurrentObjective(session);
      if (!objective) {
        return {
          ...previousValue,
          currentSession: null
        };
      }

      if (options.expectedObjectiveId && objective.id !== options.expectedObjectiveId) {
        return previousValue;
      }

      const endedAt = options.endedAt ?? Date.now();
      const transitionAt =
        typeof options.transitionAt === "number" && Number.isFinite(options.transitionAt)
          ? Math.max(endedAt, options.transitionAt)
          : endedAt;
      const previousBestMs = previousValue.bestTimesByObjective[objective.id]?.durationMs ?? null;
      const nextTransition = resolveSeededSessionTransition({
        session,
        currentObjective: objective,
        result,
        endedAt,
        objectiveLookup: (objectiveId) => objectivesById[objectiveId]
      });
      const completionSummary = nextTransition.completionSummary
        ? {
            ...nextTransition.completionSummary,
            sessionType: PRACTICE_SESSION_TYPE,
            exportSeed: session.exportSeed ?? nextTransition.completionSummary.exportSeed ?? ""
          }
        : null;
      const historyEntry = buildPracticeHistoryEntry({
        session,
        objective,
        result,
        endedAt,
        previousBestMs,
        completionSummary
      });
      const nextHistory = [...previousValue.history, historyEntry];

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
            ...completionSummary,
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
            now: transitionAt,
            currentArea: nextTransition.nextArea,
            objective: nextTransition.nextObjective,
            currentObjectiveIndex: nextTransition.nextObjectiveIndex,
            sessionSpec: session.sessionSpec,
            exportSeed: session.exportSeed,
            unlockedTapeAreas: session.unlockedTapeAreas,
            sessionStartedAt: session.sessionStartedAt,
            sessionTotalPausedMs:
              session.sessionTotalPausedMs + Math.max(0, transitionAt - endedAt)
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
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: null,
      startCountdown: null
    }));
  }

  function goToPractice() {
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: resolveSelectedMode(previousValue, PRACTICE_SESSION_TYPE),
      startCountdown: previousValue.startCountdown
    }));
  }

  function goToRoute() {
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: resolveSelectedMode(previousValue, ROUTE_SESSION_TYPE),
      startCountdown: previousValue.startCountdown
    }));
  }

  function goToStats() {
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: "stats",
      startCountdown: null
    }));
  }

  function goToBingopedia() {
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: "bingopedia",
      startCountdown: null
    }));
  }

  function goToSeedBuilder() {
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: SEED_BUILDER_MODE,
      startCountdown: null
    }));
  }

  function goToSettings() {
    pendingRouteFeedbackRef.current = null;
    setSessionFeedback(null);
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: "settings",
      startCountdown: null
    }));
  }

  function toggleLearnPanelVisibility() {
    updateState((previousValue) => {
      const session = previousValue.currentSession;
      if (!session || session.sessionType === ROUTE_SESSION_TYPE) {
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

  function updateSeedBuilderDraft(draftUpdater) {
    updateState((previousValue) => {
      const nextDraft =
        typeof draftUpdater === "function"
          ? draftUpdater(previousValue.seedBuilderDraft)
          : draftUpdater;

      return {
        ...previousValue,
        seedBuilderDraft: normalizeSeedBuilderDraft(nextDraft)
      };
    });
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
    clearPendingPracticeResolution();
    pendingRouteFeedbackRef.current = null;
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

  function deleteHistoryRun(sessionId) {
    updateState((previousValue) => {
      if (typeof sessionId !== "string" || !sessionId) {
        return previousValue;
      }

      const nextHistory = previousValue.history.filter((entry) => entry?.sessionId !== sessionId);
      if (nextHistory.length === previousValue.history.length) {
        return previousValue;
      }

      const rebuiltPerformance = rebuildPerformanceState(nextHistory);

      return {
        ...previousValue,
        history: nextHistory,
        ...rebuiltPerformance
      };
    });
  }

  function renameSeed(exportSeed, name) {
    updateState((previousValue) => {
      if (typeof exportSeed !== "string" || !exportSeed) {
        return previousValue;
      }

      const normalizedName = typeof name === "string" ? name.trim().slice(0, 60) : "";
      const nextSeedNames = {
        ...previousValue.seedNamesByExportSeed
      };

      if (normalizedName) {
        nextSeedNames[exportSeed] = normalizedName;
      } else {
        delete nextSeedNames[exportSeed];
      }

      return {
        ...previousValue,
        seedNamesByExportSeed: nextSeedNames
      };
    });
  }

  function clearPendingCompletion() {
    updateState((previousValue) => ({
      ...previousValue,
      selectedMode: normalizeSessionType(previousValue.pendingCompletion?.sessionType),
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

  async function copySeed(exportSeed) {
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

  async function copyPendingCompletionSeed() {
    return copySeed(pendingCompletion?.exportSeed);
  }

  function runSeed(exportSeed, sessionType = PRACTICE_SESSION_TYPE) {
    if (typeof exportSeed !== "string" || !exportSeed) {
      return false;
    }

    const resolvedSeed = resolveSeedInput(exportSeed, normalizeSessionType(sessionType));
    if (!resolvedSeed.sessionSpec?.objectiveIds?.length) {
      return false;
    }

    const firstObjectiveId = resolvedSeed.sessionSpec.objectiveIds[0];
    if (!firstObjectiveId || !objectivesById[firstObjectiveId]) {
      return false;
    }

    try {
      startSession({
        sessionSpec: resolvedSeed.sessionSpec,
        exportSeed: resolvedSeed.exportSeed
      });
      return true;
    } catch (error) {
      console.warn("Failed to run seed", error);
      return false;
    }
  }

  function practiceObjective(objectiveId) {
    const objective = objectivesById[objectiveId];
    if (!objective) {
      return false;
    }

    try {
      const launchState = buildObjectivePracticeLaunch(objective.id, {
        drillSettings: appState.settings.drillSettings
      });

      if (!launchState) {
        return false;
      }

      startSession(launchState);
      return true;
    } catch (error) {
      console.warn("Failed to practice objective", error);
      return false;
    }
  }

  function performPhaseAction() {
    if (
      !currentSession ||
      currentSession.sessionType === ROUTE_SESSION_TYPE ||
      pendingPracticeResolutionRef.current
    ) {
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

  const phaseActionLabel =
    currentSession?.sessionType === ROUTE_SESSION_TYPE
      ? null
      : getPhaseActionLabel(currentSession?.phase);
  const startCountdownLabel = resolveStartCountdownLabel(startCountdown, countdownNow);
  const isStartCountdownPendingReady =
    startCountdown !== null && !Number.isFinite(startCountdown.startedAt);

  return {
    startCountdown,
    currentSession,
    currentObjective,
    routeSlots,
    history,
    seedNamesByExportSeed: appState.seedNamesByExportSeed,
    bestTimesByObjective: appState.bestTimesByObjective,
    aggregateStats: appState.aggregateStats,
    stats,
    phaseInfo,
    pendingCompletion,
    seedBuilderDraft: appState.seedBuilderDraft,
    sessionFeedback,
    settings: appState.settings,
    startingArea: appState.settings.startingArea,
    selectedMode: appState.selectedMode,
    startCountdownLabel,
    isStartCountdownActive: startCountdown !== null,
    isStartCountdownPendingReady,
    startSession,
    beginStartCountdown,
    markEnteredLevel,
    unlockTape,
    togglePause,
    phaseActionLabel,
    performPhaseAction,
    completeObjective,
    completeRouteSlot,
    restartCurrentSession,
    skipCurrentSplit,
    skipObjective,
    endSession,
    clearPendingCompletion,
    replayPendingCompletion,
    copyPendingCompletionSeed,
    copySeed,
    runSeed,
    practiceObjective,
    goToModeSelect,
    goToPractice,
    goToRoute,
    goToStats,
    goToBingopedia,
    goToSeedBuilder,
    goToSettings,
    toggleLearnPanelVisibility,
    updateSettings,
    updateSeedBuilderDraft,
    updateHotkey,
    clearHotkey,
    resetAllData,
    deleteHistoryEntry,
    deleteHistoryRun,
    renameSeed
  };
}
