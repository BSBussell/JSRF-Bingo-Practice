import test from "node:test";
import assert from "node:assert/strict";

import { objectivesById } from "../../data/objectives.js";
import { applyMultinodeEvent, createMultinodeWorldState } from "./worldState.js";
import {
  doesEventMatchObjectiveAutomark,
  findFirstObjectiveAutomarkCandidateMatch,
  getObjectiveAutomarkRule,
  getObjectiveAutomarkStatus
} from "./objectiveAutomark.js";

function objectiveById(id) {
  const objective = objectivesById[id];
  assert.ok(objective, `expected objective ${id} to exist`);
  return objective;
}

test("unsupported objective returns supported false with a reason", () => {
  const objective = objectiveById("dogen_092");
  const result = getObjectiveAutomarkRule(objective);

  assert.equal(result.supported, false);
  assert.equal(result.rule, null);
  assert.ok(result.reason.length > 0);
});

test("tape objective returns a tape_collected rule and matches correct tapeId", () => {
  const objective = objectiveById("dogen_062");
  const ruleResult = getObjectiveAutomarkRule(objective);
  assert.deepEqual(ruleResult.rule, { type: "tape_collected", tapeId: 2 });

  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "tape_collected", tapeId: 2 },
    objective
  );
  assert.equal(matchResult.matched, true);
});

test("tape objective does not match wrong tapeId", () => {
  const objective = objectiveById("dogen_062");
  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "tape_collected", tapeId: 7 },
    objective
  );

  assert.equal(matchResult.supported, true);
  assert.equal(matchResult.matched, false);
});

test("tape phase can match the current objective area's tape", () => {
  const objective = objectiveById("dogen_005");
  const ruleResult = getObjectiveAutomarkRule(objective, { phase: "tape" });
  assert.deepEqual(ruleResult.rule, { type: "tape_collected", tapeId: 2 });

  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "tape_collected", tapeId: 2 },
    objective,
    null,
    { phase: "tape" }
  );
  assert.equal(matchResult.matched, true);
});

test("soul objective returns a soul_collected rule and matches correct soulId", () => {
  const objective = objectiveById("dogen_005");
  const ruleResult = getObjectiveAutomarkRule(objective);
  assert.deepEqual(ruleResult.rule, { type: "soul_collected", soulId: 5 });

  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "soul_collected", soulId: 5 },
    objective
  );
  assert.equal(matchResult.matched, true);
});

test("soul objective does not match wrong soulId", () => {
  const objective = objectiveById("dogen_005");
  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "soul_collected", soulId: 6 },
    objective
  );

  assert.equal(matchResult.supported, true);
  assert.equal(matchResult.matched, false);
});

test("travel objective can return an area_changed rule and matches correct levelId", () => {
  const objective = objectiveById("dogen_005");
  const ruleResult = getObjectiveAutomarkRule(objective, { phase: "travel" });
  assert.deepEqual(ruleResult.rule, { type: "area_changed", levelId: 65538 });

  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "area_changed", levelId: 65538 },
    objective
  );
  assert.equal(matchResult.matched, true);
});

test("travel objective rejects wrong area_changed levelId", () => {
  const objective = objectiveById("dogen_005");
  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "area_changed", levelId: 65536 },
    objective
  );

  assert.equal(matchResult.supported, true);
  assert.equal(matchResult.matched, false);
});

test("character objective returns a character_unlocked rule and matches correct characterId", () => {
  const objective = objectiveById("bp_unlock_cube");
  const ruleResult = getObjectiveAutomarkRule(objective);
  assert.deepEqual(ruleResult.rule, { type: "character_unlocked", characterId: 10 });

  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "character_unlocked", characterId: 10 },
    objective
  );
  assert.equal(matchResult.matched, true);
});

test("character objective does not match wrong characterId", () => {
  const objective = objectiveById("bp_unlock_cube");
  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "character_unlocked", characterId: 4 },
    objective
  );

  assert.equal(matchResult.supported, true);
  assert.equal(matchResult.matched, false);
});

test("full-area graffiti objective returns a graffiti_area_completed rule and matches correct levelId", () => {
  const objective = objectiveById("dogen_graffiti");
  const ruleResult = getObjectiveAutomarkRule(objective);
  assert.deepEqual(ruleResult.rule, { type: "graffiti_area_completed", levelId: 65538 });

  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "graffiti_area_completed", levelId: 65538 },
    objective
  );
  assert.equal(matchResult.matched, true);
});

test("full-area graffiti objective does not match wrong levelId", () => {
  const objective = objectiveById("dogen_graffiti");
  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "graffiti_area_completed", levelId: 65536 },
    objective
  );

  assert.equal(matchResult.supported, true);
  assert.equal(matchResult.matched, false);
});

test("unknown event does not match", () => {
  const objective = objectiveById("dogen_005");
  const matchResult = doesEventMatchObjectiveAutomark(
    { type: "player_registered", playerIndex: 0 },
    objective
  );

  assert.equal(matchResult.supported, true);
  assert.equal(matchResult.matched, false);
});

test("route candidate matching returns only the first visible matching slot", () => {
  const objective = objectiveById("dogen_005");
  const result = findFirstObjectiveAutomarkCandidateMatch(
    { type: "soul_collected", soulId: 5 },
    [
      { objective, routeSlotId: "0:dogen_005", routeSlotIndex: 0 },
      { objective, routeSlotId: "1:dogen_005", routeSlotIndex: 1 }
    ],
    null,
    { allowAreaChange: false }
  );

  assert.equal(result?.candidate.routeSlotIndex, 0);
  assert.equal(result?.matchResult.matched, true);
});

test("getObjectiveAutomarkStatus can report already complete from world state", () => {
  const objective = objectiveById("dogen_005");
  let state = createMultinodeWorldState();
  ({ state } = applyMultinodeEvent(state, { type: "soul_collected", soulId: 5 }));

  const status = getObjectiveAutomarkStatus(objective, state);
  assert.equal(status.supported, true);
  assert.equal(status.complete, true);
});

test("smoke test against real data for graffiti objective mapping", () => {
  const objective = objectiveById("shibuya_graffiti");
  const result = getObjectiveAutomarkRule(objective);

  assert.equal(result.supported, true);
  assert.deepEqual(result.rule, { type: "graffiti_area_completed", levelId: 65536 });
});
