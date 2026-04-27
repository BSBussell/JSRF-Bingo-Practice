import test from "node:test";
import assert from "node:assert/strict";

import { applyMultinodeEvent, createMultinodeWorldState } from "./worldState.js";

const TEST_GRAFFITI_BY_LEVEL_ID = Object.freeze({
  65538: Object.freeze([
    Object.freeze({
      levelId: 65538,
      graffitiId: 100,
      size: "M",
      location: "test room 1",
      requiredTagIds: Object.freeze([-8, -57, -449])
    }),
    Object.freeze({
      levelId: 65538,
      graffitiId: 101,
      size: "S",
      location: "test room 2",
      requiredTagIds: Object.freeze([-8])
    })
  ])
});

function createTestState() {
  return createMultinodeWorldState({ graffitiByLevelId: TEST_GRAFFITI_BY_LEVEL_ID });
}

test("initial state shape", () => {
  const state = createTestState();

  assert.deepEqual(state.players, []);
  assert.equal(state.playerCount, 0);
  assert.deepEqual(state.collectedSoulIds, []);
  assert.deepEqual(state.unlockedSoulIds, []);
  assert.deepEqual(state.collectedTapeIds, []);
  assert.deepEqual(state.unlockedCharacterIds, []);
  assert.equal(state.graffiti.byLevelId[65538].totalCount, 2);
  assert.equal(state.lastUpdatedAt, null);
});

test("player_count_changed creates player slots", () => {
  const { state } = applyMultinodeEvent(createTestState(), {
    type: "player_count_changed",
    count: 3
  });

  assert.equal(state.playerCount, 3);
  assert.equal(state.players.length, 3);
  assert.equal(state.players[2].index, 2);
});

test("player_registered sets names", () => {
  const { state } = applyMultinodeEvent(createTestState(), {
    type: "player_registered",
    playerIndex: 1,
    playerName: "Cube"
  });

  assert.equal(state.players[1].name, "Cube");
});

test("area_changed updates location and emits player_location_changed", () => {
  const { state, events } = applyMultinodeEvent(createTestState(), {
    type: "area_changed",
    playerIndex: 0,
    levelId: 65538
  });

  assert.equal(state.players[0].levelId, 65538);
  assert.equal(state.players[0].levelName, "Dogen");
  assert.equal(typeof state.players[0].enteredAt, "number");
  assert.deepEqual(events, [
    {
      type: "player_location_changed",
      playerIndex: 0,
      levelId: 65538,
      levelName: "Dogen"
    }
  ]);
});

test("soul_collected dedupes", () => {
  const first = applyMultinodeEvent(createTestState(), { type: "soul_collected", soulId: 3 });
  const second = applyMultinodeEvent(first.state, { type: "soul_collected", soulId: 3 });

  assert.deepEqual(second.state.collectedSoulIds, [3]);
});

test("soul_unlocked dedupes", () => {
  const first = applyMultinodeEvent(createTestState(), { type: "soul_unlocked", soulId: 7 });
  const second = applyMultinodeEvent(first.state, { type: "soul_unlocked", soulId: 7 });

  assert.deepEqual(second.state.unlockedSoulIds, [7]);
});

test("tape_collected dedupes", () => {
  const first = applyMultinodeEvent(createTestState(), { type: "tape_collected", tapeId: 2 });
  const second = applyMultinodeEvent(first.state, { type: "tape_collected", tapeId: 2 });

  assert.deepEqual(second.state.collectedTapeIds, [2]);
});

test("character_unlocked dedupes", () => {
  const first = applyMultinodeEvent(createTestState(), { type: "character_unlocked", characterId: 10 });
  const second = applyMultinodeEvent(first.state, { type: "character_unlocked", characterId: 10 });

  assert.deepEqual(second.state.unlockedCharacterIds, [10]);
});

test("tag_sprayed updates graffiti tag progress", () => {
  const { state } = applyMultinodeEvent(createTestState(), {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -8
  });

  assert.deepEqual(state.graffiti.byLevelId[65538].byGraffitiId[100].completedTagIds, [-8]);
  assert.equal(state.graffiti.byLevelId[65538].byGraffitiId[100].completedCount, 1);
});

test("completing all required tags for one graffiti emits graffiti_completed exactly once", () => {
  let result = applyMultinodeEvent(createTestState(), {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -8
  });
  result = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -57
  });
  result = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -449
  });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, "graffiti_completed");

  const duplicate = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -449
  });
  assert.deepEqual(duplicate.events, []);
});

test("completing all graffiti in a tiny fixture level emits graffiti_area_completed exactly once", () => {
  let result = applyMultinodeEvent(createTestState(), {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -8
  });
  result = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -57
  });
  result = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -449
  });
  result = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 101,
    tagId: -8
  });

  assert.equal(result.events.some((entry) => entry.type === "graffiti_area_completed"), true);

  const duplicate = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 101,
    tagId: -8
  });
  assert.deepEqual(duplicate.events, []);
});

test("unknown graffiti is ignored safely", () => {
  const originalState = createTestState();
  const result = applyMultinodeEvent(originalState, {
    type: "tag_sprayed",
    levelId: 999,
    graffitiId: 100,
    tagId: -8
  });

  assert.equal(result.state, originalState);
  assert.deepEqual(result.events, []);
});

test("kill_combo resets volatile collection/progress state and emits world_state_reset", () => {
  let result = applyMultinodeEvent(createTestState(), {
    type: "player_count_changed",
    count: 2
  });
  result = applyMultinodeEvent(result.state, {
    type: "player_registered",
    playerIndex: 0,
    playerName: "Cube"
  });
  result = applyMultinodeEvent(result.state, {
    type: "area_changed",
    playerIndex: 0,
    levelId: 65538
  });
  result = applyMultinodeEvent(result.state, { type: "soul_collected", soulId: 1 });
  result = applyMultinodeEvent(result.state, { type: "soul_unlocked", soulId: 2 });
  result = applyMultinodeEvent(result.state, { type: "tape_collected", tapeId: 3 });
  result = applyMultinodeEvent(result.state, { type: "character_unlocked", characterId: 10 });
  result = applyMultinodeEvent(result.state, {
    type: "tag_sprayed",
    levelId: 65538,
    graffitiId: 100,
    tagId: -8
  });

  const reset = applyMultinodeEvent(result.state, { type: "kill_combo" }, {
    graffitiByLevelId: TEST_GRAFFITI_BY_LEVEL_ID
  });

  assert.deepEqual(reset.events, [{ type: "world_state_reset", reason: "kill_combo" }]);
  assert.equal(reset.state.playerCount, 2);
  assert.equal(reset.state.players[0].name, "Cube");
  assert.equal(reset.state.players[0].levelId, 65538);
  assert.deepEqual(reset.state.collectedSoulIds, []);
  assert.deepEqual(reset.state.unlockedSoulIds, []);
  assert.deepEqual(reset.state.collectedTapeIds, []);
  assert.deepEqual(reset.state.unlockedCharacterIds, []);
  assert.deepEqual(
    reset.state.graffiti.byLevelId[65538].byGraffitiId[100].completedTagIds,
    []
  );
});

test("unknown event does nothing", () => {
  const originalState = createTestState();
  const result = applyMultinodeEvent(originalState, { type: "nope" });

  assert.equal(result.state, originalState);
  assert.deepEqual(result.events, []);
});
