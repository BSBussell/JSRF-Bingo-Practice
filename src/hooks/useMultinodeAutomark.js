import { useCallback, useEffect, useRef } from "react";

import {
  doesEventMatchObjectiveAutomark,
  findFirstObjectiveAutomarkCandidateMatch
} from "../lib/multinode/objectiveAutomark.js";
import {
  applyMultinodeEvent,
  createMultinodeWorldState
} from "../lib/multinode/worldState.js";
import { useMultinodeConnection } from "./useMultinodeConnection.js";

function buildEventKey(event) {
  if (!event || typeof event !== "object") {
    return "event:none";
  }

  return JSON.stringify(event);
}

export function useMultinodeAutomark({
  link,
  enabled,
  currentObjective,
  currentObjectiveMatchOptions = {},
  candidateObjectives = [],
  activeKey = "",
  onObjectiveMatched
}) {
  const currentObjectiveRef = useRef(currentObjective);
  const currentObjectiveMatchOptionsRef = useRef(currentObjectiveMatchOptions);
  const candidateObjectivesRef = useRef(candidateObjectives);
  const activeKeyRef = useRef(activeKey);
  const onObjectiveMatchedRef = useRef(onObjectiveMatched);
  const worldStateRef = useRef(createMultinodeWorldState());
  const dedupeRef = useRef(new Set());
  const previousActiveKeyRef = useRef(activeKey);

  useEffect(() => {
    currentObjectiveRef.current = currentObjective;
  }, [currentObjective]);

  useEffect(() => {
    currentObjectiveMatchOptionsRef.current = currentObjectiveMatchOptions ?? {};
  }, [currentObjectiveMatchOptions]);

  useEffect(() => {
    candidateObjectivesRef.current = Array.isArray(candidateObjectives)
      ? candidateObjectives
      : [];
  }, [candidateObjectives]);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    onObjectiveMatchedRef.current = onObjectiveMatched;
  }, [onObjectiveMatched]);

  useEffect(() => {
    if (previousActiveKeyRef.current !== activeKey) {
      dedupeRef.current.clear();
      previousActiveKeyRef.current = activeKey;
    }
  }, [activeKey]);

  useEffect(() => {
    if (!enabled) {
      worldStateRef.current = createMultinodeWorldState();
      dedupeRef.current.clear();
    }
  }, [enabled]);

  const evaluateMatch = useCallback((event, nextWorldState, candidate, options = {}) => {
    const objective = candidate?.objective ?? candidate;
    if (!objective) {
      return false;
    }

    const matchResult = doesEventMatchObjectiveAutomark(
      event,
      objective,
      nextWorldState,
      options
    );

    if (!matchResult.matched) {
      return false;
    }

    const slotKey =
      candidate?.routeSlotId ??
      (Number.isInteger(candidate?.routeSlotIndex) ? candidate.routeSlotIndex : "current");
    const dedupeKey = `${activeKeyRef.current}:${objective.id}:${slotKey}:${buildEventKey(event)}`;
    if (dedupeRef.current.has(dedupeKey)) {
      return true;
    }

    dedupeRef.current.add(dedupeKey);
    onObjectiveMatchedRef.current?.({
      event,
      matchResult,
      objective,
      worldState: nextWorldState,
      routeSlotId: candidate?.routeSlotId,
      routeSlotIndex: candidate?.routeSlotIndex
    });
    return true;
  }, []);

  const { status, error } = useMultinodeConnection({
    link,
    enabled,
    onRawPacket() {},
    onGameEvent(event) {
      const reduced = applyMultinodeEvent(worldStateRef.current, event);
      worldStateRef.current = reduced.state;

      const eventsToCheck = [event, ...reduced.events];
      for (const eventToCheck of eventsToCheck) {
        const currentObjectiveMatch = evaluateMatch(
          eventToCheck,
          reduced.state,
          currentObjectiveRef.current,
          currentObjectiveMatchOptionsRef.current
        );
        if (currentObjectiveMatch) {
          break;
        }

        if (eventToCheck.type === "area_changed") {
          continue;
        }

        const candidateMatch = findFirstObjectiveAutomarkCandidateMatch(
          eventToCheck,
          candidateObjectivesRef.current,
          reduced.state,
          { allowAreaChange: false }
        );
        const matchedCandidate = candidateMatch
          ? evaluateMatch(eventToCheck, reduced.state, candidateMatch.candidate, {
              allowAreaChange: false
            })
          : false;

        if (matchedCandidate) {
          break;
        }
      }
    }
  });

  return {
    status,
    error
  };
}
