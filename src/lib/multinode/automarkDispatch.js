import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../session/sessionTypes.js";

const PRACTICE_CHALLENGE_EVENT_TYPES = new Set([
  "soul_collected",
  "character_unlocked",
  "graffiti_area_completed"
]);

export function resolveMultinodeAutomarkAction({
  event,
  sessionType,
  phase,
  routeSlotIndex
}) {
  if (!event || typeof event.type !== "string") {
    return {
      type: "none",
      reason: "No MultiNode event was provided."
    };
  }

  if (sessionType === ROUTE_SESSION_TYPE) {
    if (Number.isInteger(routeSlotIndex)) {
      return {
        type: "route-slot",
        routeSlotIndex,
        reason: "Route MultiNode match clears the matched visible route slot."
      };
    }

    return {
      type: "none",
      reason: "Route MultiNode match did not include a visible slot index."
    };
  }

  if (sessionType !== PRACTICE_SESSION_TYPE) {
    return {
      type: "none",
      reason: "No active practice or route session is available."
    };
  }

  if (phase === "travel") {
    return event.type === "area_changed"
      ? {
          type: "practice-travel",
          reason: "Practice travel automark uses the normal travel split action."
        }
      : {
          type: "none",
          reason: "Only area_changed can complete the practice travel phase."
        };
  }

  if (phase === "tape") {
    return event.type === "tape_collected"
      ? {
          type: "practice-tape",
          reason: "Practice tape automark uses the normal tape split action."
        }
      : {
          type: "none",
          reason: "Only tape_collected can complete the practice tape phase."
        };
  }

  if (phase === "challenge") {
    return PRACTICE_CHALLENGE_EVENT_TYPES.has(event.type)
      ? {
          type: "practice-objective",
          reason: "Practice challenge automark uses the normal objective completion action."
        }
      : {
          type: "none",
          reason: "Event is not a supported practice challenge completion event."
        };
  }

  return {
    type: "none",
    reason: "Practice session phase is not automarkable."
  };
}
