import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRouteSessionState,
  completeRouteSlot
} from "./session/routeSession.js";
import { buildSessionConfig } from "./seed/sessionSeed.js";

function buildRouteSpec(objectiveIds, routeVisibleCount = 3) {
  return {
    version: 3,
    sessionType: "route",
    rngSeed: "00112233445566778899aabbccddeeff",
    config: buildSessionConfig("Garage", {
      numberOfObjectives: objectiveIds.length,
      routeVisibleCount
    }),
    objectiveIds
  };
}

test("buildRouteSessionState fills the initial visible grid", () => {
  const session = buildRouteSessionState({
    sessionId: "route_1",
    now: 1000,
    sessionSpec: buildRouteSpec(["a", "b", "c", "d"], 3),
    exportSeed: "BNGSD3.test"
  });

  assert.deepEqual(session.visibleObjectiveIds, ["a", "b", "c"]);
  assert.equal(session.nextRevealIndex, 3);
  assert.equal(session.completedCount, 0);
});

test("completeRouteSlot reveals the next objective into the cleared slot", () => {
  const session = buildRouteSessionState({
    sessionId: "route_2",
    now: 1000,
    sessionSpec: buildRouteSpec(["a", "b", "c", "d"], 3),
    exportSeed: "BNGSD3.test"
  });

  const resolution = completeRouteSlot({
    session,
    slotIndex: 1,
    endedAt: 1500
  });

  assert.equal(resolution.completedObjectiveId, "b");
  assert.deepEqual(resolution.nextSession.visibleObjectiveIds, ["a", "d", "c"]);
  assert.equal(resolution.nextSession.nextRevealIndex, 4);
  assert.equal(resolution.nextSession.completedCount, 1);
  assert.equal(resolution.completionResult, null);
});

test("completeRouteSlot ignores paused sessions", () => {
  const session = {
    ...buildRouteSessionState({
      sessionId: "route_paused",
      now: 1000,
      sessionSpec: buildRouteSpec(["a", "b", "c"], 2),
      exportSeed: "BNGSD3.test"
    }),
    pausedAt: 1200
  };

  const resolution = completeRouteSlot({
    session,
    slotIndex: 0,
    endedAt: 2000
  });

  assert.equal(resolution.nextSession, session);
  assert.equal(resolution.completionResult, null);
  assert.equal(resolution.completedObjectiveId, null);
});

test("completeRouteSlot returns a completion summary on the final clear", () => {
  const session = buildRouteSessionState({
    sessionId: "route_3",
    now: 1000,
    sessionSpec: buildRouteSpec(["a", "b"], 2),
    exportSeed: "BNGSD3.test",
    sessionTotalPausedMs: 200
  });

  const firstClear = completeRouteSlot({
    session,
    slotIndex: 0,
    endedAt: 1400
  });
  const secondClear = completeRouteSlot({
    session: firstClear.nextSession,
    slotIndex: 1,
    endedAt: 2200
  });

  assert.equal(secondClear.nextSession, null);
  assert.deepEqual(secondClear.completionResult, {
    sessionId: "route_3",
    sessionType: "route",
    label: "Route x2",
    result: "complete",
    finishedAt: 2200,
    startedAt: 1000,
    endedAt: 2200,
    exportSeed: "BNGSD3.test",
    objectiveCount: 2,
    squaresCleared: 2,
    totalDurationMs: 1000,
    visibleCount: 2
  });
});

test("buildRouteSessionState handles drills equal to the visible count", () => {
  const session = buildRouteSessionState({
    sessionId: "route_4",
    now: 1000,
    sessionSpec: buildRouteSpec(["a", "b"], 2),
    exportSeed: "BNGSD3.test"
  });

  assert.deepEqual(session.visibleObjectiveIds, ["a", "b"]);
  assert.equal(session.nextRevealIndex, 2);
});
