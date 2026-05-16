import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCompetitionClaim,
  createCompetitionRaceState,
  getCompetitionPlayerName,
  registerCompetitionPlayers,
  setCompetitionLocalPlayer
} from "./competition.js";

test("createCompetitionRaceState dedupes objective ids and stores labels", () => {
  const state = createCompetitionRaceState({
    raceKey: "session-1",
    objectives: [
      { id: "a", label: "Alpha" },
      { id: "a", label: "Alpha Duplicate" },
      { id: "b", label: "Bravo" }
    ]
  });

  assert.equal(state.raceKey, "session-1");
  assert.deepEqual(state.objectiveIds, ["a", "b"]);
  assert.equal(state.objectiveLabelsById.a, "Alpha");
});

test("first claim wins per objective", () => {
  const initialState = createCompetitionRaceState({
    objectives: [{ id: "a", label: "Alpha" }]
  });

  const first = applyCompetitionClaim(initialState, {
    objectiveId: "a",
    playerIndex: 0
  });
  const second = applyCompetitionClaim(first.state, {
    objectiveId: "a",
    playerIndex: 1
  });

  assert.equal(first.claimResult.claimed, true);
  assert.equal(second.claimResult.claimed, false);
  assert.equal(first.state.scoresByPlayerIndex[0], 1);
  assert.equal(first.state.scoresByPlayerIndex[1], undefined);
});

test("claim tone respects local claimed player identity", () => {
  const initialState = setCompetitionLocalPlayer(
    createCompetitionRaceState({
      objectives: [{ id: "a", label: "Alpha" }]
    }),
    0
  );

  const mine = applyCompetitionClaim(initialState, {
    objectiveId: "a",
    playerIndex: 0
  });

  assert.equal(mine.claimResult.tone, "yay");
});

test("winner is null on tie and race completes when all objectives are claimed", () => {
  const initialState = createCompetitionRaceState({
    objectives: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Bravo" }
    ]
  });

  const first = applyCompetitionClaim(initialState, {
    objectiveId: "a",
    playerIndex: 0
  });
  const second = applyCompetitionClaim(first.state, {
    objectiveId: "b",
    playerIndex: 1
  });

  assert.equal(second.state.isComplete, true);
  assert.equal(second.state.winnerPlayerIndex, null);
});

test("registerCompetitionPlayers updates names and fallback labels", () => {
  const initialState = createCompetitionRaceState({
    objectives: [{ id: "a", label: "Alpha" }]
  });
  const withPlayers = registerCompetitionPlayers(initialState, [
    { index: 0, name: "Bee" },
    { index: 1, name: "" }
  ]);

  assert.equal(getCompetitionPlayerName(withPlayers, 0), "Bee");
  assert.equal(getCompetitionPlayerName(withPlayers, 1), "Player 2");
});
