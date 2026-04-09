// Central source of truth for drill-session phase rules.
// This file owns the "travel -> tape -> challenge" shape, plus the bits that
// are easy to let drift when the runtime session, timer UI, and offline sampler
// all need to agree on what a square means.

export const TAPE_REQUIRED_OBJECTIVE_TYPES = new Set([
  "grind_count",
  "points_goal",
  "special",
  "trick_count",
  "air_count"
]);

export function objectiveRequiresTape(objectiveType) {
  return TAPE_REQUIRED_OBJECTIVE_TYPES.has(objectiveType);
}

export function objectiveNeedsTape(objective, unlockedTapeAreas = []) {
  return objectiveRequiresTape(objective.type) && !unlockedTapeAreas.includes(objective.area);
}

export function buildObjectivePhaseInfo(currentArea, objective, unlockedTapeAreas = []) {
  const needsTravel = currentArea !== objective.area;
  const requiresTape = objectiveRequiresTape(objective.type);
  const tapeUnlocked = unlockedTapeAreas.includes(objective.area);
  const needsTape = requiresTape && !tapeUnlocked;

  return {
    needsTravel,
    requiresTape,
    tapeUnlocked,
    needsTape
  };
}

export function getInitialSessionPhase(phaseInfo) {
  // The state machine is intentionally tiny: travel gates area changes, tape
  // gates tape-required objectives, and challenge is everything after that.
  if (!phaseInfo.needsTravel && !phaseInfo.needsTape) {
    return "challenge";
  }

  if (!phaseInfo.needsTravel && phaseInfo.needsTape) {
    return "tape";
  }

  return "travel";
}

export function buildObjectiveSessionState({
  session,
  currentArea,
  objective,
  now,
  currentObjectiveIndex,
  drillSettings
}) {
  const phaseInfo = buildObjectivePhaseInfo(
    currentArea,
    objective,
    session.unlockedTapeAreas
  );
  const phase = getInitialSessionPhase(phaseInfo);

  return {
    ...session,
    currentArea,
    currentObjectiveId: objective.id,
    currentObjectiveIndex,
    currentObjectiveGeneratedAt: now,
    objectiveStartedAt: now,
    phaseStartedAt: now,
    phase,
    enteredLevelAt: phaseInfo.needsTravel ? null : now,
    tapeStartedAt: phase === "tape" ? now : null,
    tapeUnlockedAt: null,
    challengeStartedAt: phase === "challenge" ? now : null,
    drillSettings,
    unlockedTapeAreas: session.unlockedTapeAreas,
    pausedAt: null,
    totalPausedMs: 0,
    travelPausedMs: 0,
    tapePausedMs: 0,
    challengePausedMs: 0
  };
}

export function buildSeededSessionState({
  sessionId,
  now,
  currentArea,
  objective,
  currentObjectiveIndex,
  sessionSpec,
  exportSeed,
  unlockedTapeAreas = [],
  sessionStartedAt = now,
  sessionTotalPausedMs = 0
}) {
  return buildObjectiveSessionState({
    session: {
      id: sessionId,
      unlockedTapeAreas,
      objectiveIds: sessionSpec.objectiveIds.slice(),
      sessionSpec,
      exportSeed,
      sessionStartedAt,
      sessionTotalPausedMs
    },
    currentArea,
    objective,
    now,
    currentObjectiveIndex,
    drillSettings: sessionSpec.config
  });
}

export function buildSessionCompletionSummary({
  session,
  endedAt
}) {
  return {
    sessionId: session.id,
    finishedAt: endedAt,
    exportSeed: session.exportSeed ?? "",
    objectiveCount: Array.isArray(session.objectiveIds) ? session.objectiveIds.length : 0,
    totalDurationMs: Math.max(
      0,
      endedAt - session.sessionStartedAt - (session.sessionTotalPausedMs ?? 0)
    )
  };
}

export function resolveSeededSessionTransition({
  session,
  currentObjective,
  result,
  endedAt,
  objectiveLookup
}) {
  const nextArea =
    result === "skip"
      ? session.currentArea
      : currentObjective.area ?? session.currentArea;
  const nextObjectiveIndex = session.currentObjectiveIndex + 1;
  const nextObjectiveId = session.objectiveIds[nextObjectiveIndex] ?? null;
  const nextObjective = nextObjectiveId ? objectiveLookup(nextObjectiveId) ?? null : null;

  return {
    nextArea,
    nextObjectiveIndex,
    nextObjectiveId,
    nextObjective,
    completionSummary: nextObjective
      ? null
      : buildSessionCompletionSummary({
          session,
          endedAt
        })
  };
}

export function buildSessionPhaseViewModel({
  currentSession,
  currentObjective,
  aggregateStats,
  bestTimesByObjective
}) {
  if (!currentSession || !currentObjective) {
    return null;
  }

  const phaseInfo = buildObjectivePhaseInfo(
    currentSession.currentArea,
    currentObjective,
    currentSession.unlockedTapeAreas
  );

  return {
    ...phaseInfo,
    phase: currentSession.phase,
    isPaused: Boolean(currentSession.pausedAt),
    // Split times are derived from timestamps instead of persisted directly so
    // pause bookkeeping has one source of truth.
    travelSplitMs:
      typeof currentSession.enteredLevelAt === "number"
        ? Math.max(
            0,
            currentSession.enteredLevelAt -
              currentSession.objectiveStartedAt -
              currentSession.travelPausedMs
          )
        : null,
    tapeSplitMs:
      typeof currentSession.tapeUnlockedAt === "number" &&
      typeof currentSession.tapeStartedAt === "number"
        ? Math.max(
            0,
            currentSession.tapeUnlockedAt -
              currentSession.tapeStartedAt -
              currentSession.tapePausedMs
          )
        : null,
    tapePbMs: aggregateStats?.tapeByArea?.[currentObjective.area]?.bestMs ?? null,
    challengePbMs:
      bestTimesByObjective?.[currentObjective.id]?.durationMs ?? null
  };
}

export function getPhasePausedDuration(session) {
  if (!session) {
    return 0;
  }

  const pausedKey = getPhasePausedKey(session.phase);
  return session[pausedKey] ?? 0;
}

export function getPhasePausedKey(phase) {
  // Unknown phases intentionally fall through to challenge; that keeps timer
  // math from exploding if persisted state ever arrives partially migrated.
  if (phase === "travel") {
    return "travelPausedMs";
  }

  if (phase === "tape") {
    return "tapePausedMs";
  }

  return "challengePausedMs";
}

export function getPhaseActionLabel(phase) {
  if (phase === "travel") {
    return "Enter Level";
  }

  if (phase === "tape") {
    return "Tape Unlocked";
  }

  return "Complete";
}
