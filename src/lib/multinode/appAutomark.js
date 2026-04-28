import { objectivesById } from "../../data/objectives.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../session/sessionTypes.js";

export function buildMultinodeAutomarkContext({
  currentSession,
  startCountdown,
  currentObjective,
  routeSlots = []
}) {
  const startCountdownSessionType = startCountdown?.sessionSpec?.sessionType ?? null;
  const countdownObjectiveId = startCountdown?.sessionSpec?.objectiveIds?.[0] ?? null;
  const countdownObjective = countdownObjectiveId
    ? objectivesById[countdownObjectiveId] ?? null
    : null;
  const practiceObjective =
    currentSession?.sessionType === PRACTICE_SESSION_TYPE
      ? currentObjective ?? null
      : startCountdownSessionType === PRACTICE_SESSION_TYPE
        ? countdownObjective
        : null;
  const practicePhase =
    currentSession?.sessionType === PRACTICE_SESSION_TYPE
      ? currentSession.phase ?? null
      : null;
  const candidateObjectives =
    currentSession?.sessionType === ROUTE_SESSION_TYPE
      ? routeSlots
          .filter((slot) => slot?.objective)
          .map((slot) => ({
            objective: slot.objective,
            routeSlotId: `${slot.slotIndex}:${slot.objective.id}`,
            routeSlotIndex: slot.slotIndex
          }))
      : [];
  const routeAutomarkSignature = candidateObjectives
    .map((candidate) => candidate.routeSlotId)
    .join("|");
  const activeKey = currentSession
    ? currentSession.sessionType === ROUTE_SESSION_TYPE
      ? `${currentSession.id}:route:${routeAutomarkSignature}`
      : `${currentSession.id}:practice:${currentSession.phase}:${currentObjective?.id ?? ""}`
    : startCountdown
      ? `${startCountdown.id}:countdown:${startCountdownSessionType ?? ""}:${countdownObjectiveId ?? ""}`
      : "idle";

  return {
    enabled: Boolean(currentSession || startCountdown),
    currentObjective: practiceObjective,
    currentObjectiveMatchOptions: {
      phase: practicePhase,
      allowAreaChange: practicePhase === "travel"
    },
    candidateObjectives,
    activeKey
  };
}

export function formatMultinodeConnectionStatus(status, error) {
  if (status === "connected") {
    return {
      indicator: "✓",
      label: "Connected"
    };
  }

  if (status === "connecting") {
    return {
      indicator: "•",
      label: "Connecting..."
    };
  }

  if (status === "error") {
    return {
      indicator: "✕",
      label: error ? `Failed: ${error}` : "Failed"
    };
  }

  if (status === "closed") {
    return {
      indicator: "•",
      label: "Disconnected"
    };
  }

  return {
    indicator: "•",
    label: "Idle"
  };
}
