import { useCallback, useEffect, useRef, useState } from "react";

import {
  doesEventMatchObjectiveAutomark,
  findFirstObjectiveAutomarkCandidateMatch,
  getObjectiveAutomarkStatus
} from "../lib/multinode/objectiveAutomark.js";
import {
  applyMultinodeEvent,
  createMultinodeWorldState
} from "../lib/multinode/worldState.js";
import { parseMultinodePeerId } from "../lib/multinode/link.js";
import { useMultinodeConnection } from "./useMultinodeConnection.js";


function buildEventKey(event) {
  if (!event || typeof event !== "object") {
    return "event:none";
  }

  return JSON.stringify(event);
}

const DEBUG_MULTINODE_AUTOMARK = true;

function logSoulAutomarkDebug(label, payload) {
  if (!DEBUG_MULTINODE_AUTOMARK) {
    return;
  }

  console.log(`[MultiNode automark:soul] ${label}`, payload);
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
  const [worldState, setWorldState] = useState(() => createMultinodeWorldState());
  const [lastDerivedEvents, setLastDerivedEvents] = useState([]);
  const [lastMatchResult, setLastMatchResult] = useState(null);
  const [manualEnabled, setManualEnabled] = useState(null);

  const currentObjectiveRef = useRef(currentObjective);
  const currentObjectiveMatchOptionsRef = useRef(currentObjectiveMatchOptions);
  const candidateObjectivesRef = useRef(candidateObjectives);
  const activeKeyRef = useRef(activeKey);
  const onObjectiveMatchedRef = useRef(onObjectiveMatched);
  const worldStateRef = useRef(worldState);
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
    worldStateRef.current = worldState;
  }, [worldState]);

  useEffect(() => {
    if (previousActiveKeyRef.current !== activeKey) {
      dedupeRef.current.clear();
      previousActiveKeyRef.current = activeKey;
      setLastMatchResult(null);
    }
  }, [activeKey]);

  const parsedPeerId = parseMultinodePeerId(link);
  const hasLink = typeof parsedPeerId === "string" && parsedPeerId.length > 0;
  const effectiveEnabled = Boolean((manualEnabled ?? enabled) && hasLink);

  useEffect(() => {
    if (!enabled) {
      setManualEnabled(null);
      const resetWorldState = createMultinodeWorldState();
      worldStateRef.current = resetWorldState;
      setWorldState(resetWorldState);
      setLastDerivedEvents([]);
      setLastMatchResult(null);
      dedupeRef.current.clear();
    }
  }, [enabled]);

  const evaluateMatch = useCallback((event, nextWorldState, candidate, options = {}) => {
    const objective = candidate?.objective ?? candidate;
    if (event?.type === "soul_collected") {
      logSoulAutomarkDebug("evaluate", {
        event,
        candidate,
        objective,
        options,
        activeKey: activeKeyRef.current
      });
    }
    if (!objective) {
      return false;
    }

    const matchResult = doesEventMatchObjectiveAutomark(
      event,
      objective,
      nextWorldState,
      options
    );
    if (event?.type === "soul_collected") {
      logSoulAutomarkDebug("match result", {
        event,
        objectiveId: objective?.id,
        objectiveType: objective?.type,
        objectiveSourceGroup: objective?.sourceGroup,
        objectiveCode: objective?.code,
        objectiveArea: objective?.area,
        matchResult
      });
    }
    setLastMatchResult({
      event,
      result: matchResult
    });

    if (!matchResult.matched) {
      if (event?.type === "soul_collected") {
        logSoulAutomarkDebug("not matched", {
          event,
          objectiveId: objective?.id,
          reason: matchResult.reason
        });
      }
      return false;
    }

    const slotKey =
      candidate?.routeSlotId ??
      (Number.isInteger(candidate?.routeSlotIndex) ? candidate.routeSlotIndex : "current");
    const dedupeKey = `${activeKeyRef.current}:${objective.id}:${slotKey}:${buildEventKey(event)}`;
    if (dedupeRef.current.has(dedupeKey)) {
      if (event?.type === "soul_collected") {
        logSoulAutomarkDebug("deduped", {
          event,
          objectiveId: objective?.id,
          dedupeKey
        });
      }
      return true;
    }

    dedupeRef.current.add(dedupeKey);
    if (event?.type === "soul_collected") {
      logSoulAutomarkDebug("dispatch match", {
        event,
        objectiveId: objective?.id,
        dedupeKey,
        routeSlotId: candidate?.routeSlotId,
        routeSlotIndex: candidate?.routeSlotIndex
      });
    }
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

  const { status, error, lastRawPacket, lastGameEvent } = useMultinodeConnection({
    link,
    enabled: effectiveEnabled,
    onRawPacket() {},
    onGameEvent(event) {
      if (event?.type === "soul_collected") {
        logSoulAutomarkDebug("incoming", {
          event,
          currentObjective: currentObjectiveRef.current,
          currentObjectiveMatchOptions: currentObjectiveMatchOptionsRef.current,
          candidateObjectives: candidateObjectivesRef.current,
          activeKey: activeKeyRef.current
        });
      }
      const reduced = applyMultinodeEvent(worldStateRef.current, event);
      worldStateRef.current = reduced.state;
      setWorldState(reduced.state);
      setLastDerivedEvents(reduced.events);

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

        if (eventToCheck?.type === "soul_collected") {
          logSoulAutomarkDebug("checking route candidates", {
            event: eventToCheck,
            candidateCount: candidateObjectivesRef.current.length,
            candidates: candidateObjectivesRef.current
          });
        }

        const candidateMatch = findFirstObjectiveAutomarkCandidateMatch(
          eventToCheck,
          candidateObjectivesRef.current,
          reduced.state,
          { allowAreaChange: false }
        );
        if (eventToCheck?.type === "soul_collected") {
          logSoulAutomarkDebug("route candidate result", {
            event: eventToCheck,
            candidateMatch
          });
        }
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

  const currentObjectiveStatus = getObjectiveAutomarkStatus(currentObjective, worldState);

  return {
    status,
    error,
    worldState,
    lastRawPacket,
    lastGameEvent,
    lastDerivedEvents,
    currentObjectiveStatus,
    lastMatchResult,
    connect: () => setManualEnabled(true),
    disconnect: () => setManualEnabled(false)
  };
}
