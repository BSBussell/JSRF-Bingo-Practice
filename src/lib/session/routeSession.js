import { ROUTE_SESSION_TYPE } from "./sessionTypes.js";
import {
  ROUTE_REVEAL_MODE_BURST,
  getRouteRevealModeLabel,
  normalizeRouteRevealMode
} from "./routeRevealMode.js";

export function buildInitialRouteVisibleObjectiveIds(objectiveIds, visibleCount) {
  const safeObjectiveIds = Array.isArray(objectiveIds) ? objectiveIds : [];
  const safeVisibleCount = Math.max(1, Number.isInteger(visibleCount) ? visibleCount : 1);

  return Array.from({ length: safeVisibleCount }, (_, index) => safeObjectiveIds[index] ?? null);
}

export function buildRouteSessionState({
  sessionId,
  now,
  sessionSpec,
  exportSeed,
  sessionStartedAt = now,
  sessionTotalPausedMs = 0
}) {
  const objectiveIds = sessionSpec.objectiveIds.slice();
  const visibleObjectiveIds = buildInitialRouteVisibleObjectiveIds(
    objectiveIds,
    sessionSpec.config.routeVisibleCount
  );

  return {
    id: sessionId,
    sessionType: ROUTE_SESSION_TYPE,
    objectiveIds,
    sessionSpec,
    exportSeed,
    visibleObjectiveIds,
    nextRevealIndex: Math.min(sessionSpec.config.routeVisibleCount, objectiveIds.length),
    completedCount: 0,
    routeClearEvents: [],
    sessionStartedAt,
    sessionTotalPausedMs,
    pausedAt: null,
    totalPausedMs: 0
  };
}

export function buildRouteCompletionResult({
  session,
  endedAt
}) {
  const visibleCount = session.sessionSpec?.config?.routeVisibleCount ?? 0;
  const routeRevealMode = normalizeRouteRevealMode(session.sessionSpec?.config?.routeRevealMode);
  const revealModeLabel = getRouteRevealModeLabel(routeRevealMode);

  return {
    sessionId: session.id,
    sessionType: ROUTE_SESSION_TYPE,
    label: `${revealModeLabel} Route x${visibleCount}`,
    result: "complete",
    finishedAt: endedAt,
    startedAt: session.sessionStartedAt,
    endedAt,
    exportSeed: session.exportSeed ?? "",
    objectiveCount: Array.isArray(session.objectiveIds) ? session.objectiveIds.length : 0,
    squaresCleared: session.completedCount ?? 0,
    pauseDurationMs: Math.max(0, session.sessionTotalPausedMs ?? 0),
    totalDurationMs: Math.max(
      0,
      endedAt - session.sessionStartedAt - (session.sessionTotalPausedMs ?? 0)
    ),
    visibleCount,
    routeRevealMode,
    routeClearEvents: Array.isArray(session.routeClearEvents)
      ? session.routeClearEvents.slice()
      : []
  };
}

export function buildRouteHistoryEntry(routeResult) {
  return {
    sessionType: ROUTE_SESSION_TYPE,
    sessionId: routeResult.sessionId,
    label: routeResult.label,
    result: routeResult.result,
    visibleCount: routeResult.visibleCount,
    routeRevealMode: routeResult.routeRevealMode,
    objectiveCount: routeResult.objectiveCount,
    squaresCleared: routeResult.squaresCleared,
    pauseDurationMs: routeResult.pauseDurationMs ?? 0,
    totalDurationMs: routeResult.totalDurationMs,
    startedAt: routeResult.startedAt,
    endedAt: routeResult.endedAt,
    exportSeed: routeResult.exportSeed ?? "",
    routeClearEvents: Array.isArray(routeResult.routeClearEvents)
      ? routeResult.routeClearEvents.slice()
      : []
  };
}

export function resolveRouteVisibleSlots(currentSession, objectiveLookup) {
  if (!currentSession || currentSession.sessionType !== ROUTE_SESSION_TYPE) {
    return [];
  }

  return (currentSession.visibleObjectiveIds ?? []).map((objectiveId, slotIndex) => ({
    slotIndex,
    slotLabel: slotIndex === 9 ? "0" : String(slotIndex + 1),
    objectiveId,
    objective: objectiveId ? objectiveLookup(objectiveId) ?? null : null
  }));
}

export function completeRouteSlot({
  session,
  slotIndex,
  endedAt
}) {
  if (
    !session ||
    session.sessionType !== ROUTE_SESSION_TYPE ||
    session.pausedAt ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= (session.visibleObjectiveIds?.length ?? 0)
  ) {
    return {
      nextSession: session,
      completionResult: null,
      completedObjectiveId: null
    };
  }

  const completedObjectiveId = session.visibleObjectiveIds[slotIndex] ?? null;
  if (!completedObjectiveId) {
    return {
      nextSession: session,
      completionResult: null,
      completedObjectiveId: null
    };
  }

  const visibleObjectiveIds = session.visibleObjectiveIds.slice();
  visibleObjectiveIds[slotIndex] = null;
  const routeRevealMode = normalizeRouteRevealMode(session.sessionSpec?.config?.routeRevealMode);
  let nextRevealIndex = session.nextRevealIndex ?? 0;
  const routeClearEvents = Array.isArray(session.routeClearEvents)
    ? session.routeClearEvents.slice()
    : [];
  routeClearEvents.push({
    objectiveId: completedObjectiveId,
    slotIndex,
    endedAt,
    elapsedMs: Math.max(
      0,
      endedAt - session.sessionStartedAt - (session.sessionTotalPausedMs ?? 0)
    )
  });

  if (routeRevealMode === ROUTE_REVEAL_MODE_BURST) {
    if (!visibleObjectiveIds.some(Boolean) && nextRevealIndex < session.objectiveIds.length) {
      const nextBurstObjectiveIds = buildInitialRouteVisibleObjectiveIds(
        session.objectiveIds.slice(nextRevealIndex),
        session.sessionSpec?.config?.routeVisibleCount
      );
      visibleObjectiveIds.splice(0, visibleObjectiveIds.length, ...nextBurstObjectiveIds);
      nextRevealIndex = Math.min(
        session.objectiveIds.length,
        nextRevealIndex + (session.sessionSpec?.config?.routeVisibleCount ?? 0)
      );
    }
  } else {
    const revealedObjectiveId = session.objectiveIds[nextRevealIndex] ?? null;
    visibleObjectiveIds[slotIndex] = revealedObjectiveId;
    if (revealedObjectiveId) {
      nextRevealIndex += 1;
    }
  }

  const nextSession = {
    ...session,
    visibleObjectiveIds,
    nextRevealIndex,
    completedCount: (session.completedCount ?? 0) + 1,
    routeClearEvents
  };
  const hasVisibleObjectivesRemaining = visibleObjectiveIds.some(Boolean);

  return {
    nextSession: hasVisibleObjectivesRemaining ? nextSession : null,
    completionResult: hasVisibleObjectivesRemaining
      ? null
      : buildRouteCompletionResult({
          session: nextSession,
          endedAt
        }),
    completedObjectiveId
  };
}
