import test from "node:test";
import assert from "node:assert/strict";

import { objectivesById } from "../../data/objectives.js";
import {
  buildMultinodeAutomarkContext,
  formatMultinodeConnectionStatus
} from "./appAutomark.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE
} from "../session/sessionTypes.js";

test("buildMultinodeAutomarkContext uses live practice objective and phase", () => {
  const objective = objectivesById.dogen_005;
  const result = buildMultinodeAutomarkContext({
    currentSession: {
      id: "practice-1",
      sessionType: PRACTICE_SESSION_TYPE,
      phase: "travel"
    },
    currentObjective: objective
  });

  assert.equal(result.enabled, true);
  assert.equal(result.currentObjective, objective);
  assert.deepEqual(result.currentObjectiveMatchOptions, {
    phase: "travel",
    allowAreaChange: true
  });
  assert.equal(result.activeKey, "practice-1:practice:travel:dogen_005");
  assert.deepEqual(result.candidateObjectives, []);
});

test("buildMultinodeAutomarkContext uses countdown practice objective before session start", () => {
  const result = buildMultinodeAutomarkContext({
    startCountdown: {
      id: "countdown-1",
      sessionSpec: {
        sessionType: PRACTICE_SESSION_TYPE,
        objectiveIds: ["dogen_005", "dogen_006"]
      }
    }
  });

  assert.equal(result.enabled, true);
  assert.equal(result.currentObjective?.id, "dogen_005");
  assert.deepEqual(result.currentObjectiveMatchOptions, {
    phase: null,
    allowAreaChange: false
  });
  assert.equal(result.activeKey, "countdown-1:countdown:practice:dogen_005");
});

test("buildMultinodeAutomarkContext builds route candidate metadata from visible slots", () => {
  const result = buildMultinodeAutomarkContext({
    currentSession: {
      id: "route-1",
      sessionType: ROUTE_SESSION_TYPE
    },
    routeSlots: [
      { slotIndex: 0, objective: objectivesById.dogen_005 },
      { slotIndex: 1, objective: null },
      { slotIndex: 2, objective: objectivesById.dogen_062 }
    ]
  });

  assert.deepEqual(
    result.candidateObjectives.map((candidate) => ({
      routeSlotId: candidate.routeSlotId,
      routeSlotIndex: candidate.routeSlotIndex,
      objectiveId: candidate.objective.id
    })),
    [
      {
        routeSlotId: "0:dogen_005",
        routeSlotIndex: 0,
        objectiveId: "dogen_005"
      },
      {
        routeSlotId: "2:dogen_062",
        routeSlotIndex: 2,
        objectiveId: "dogen_062"
      }
    ]
  );
  assert.equal(result.activeKey, "route-1:route:0:dogen_005|2:dogen_062");
});

test("formatMultinodeConnectionStatus returns stable UI labels", () => {
  assert.deepEqual(formatMultinodeConnectionStatus("connected"), {
    indicator: "✓",
    label: "Connected"
  });
  assert.deepEqual(formatMultinodeConnectionStatus("error", "boom"), {
    indicator: "✕",
    label: "Failed: boom"
  });
  assert.deepEqual(formatMultinodeConnectionStatus("idle"), {
    indicator: "•",
    label: "Idle"
  });
});
