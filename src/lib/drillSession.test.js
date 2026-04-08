import assert from "node:assert/strict";
import test from "node:test";

import { skipSessionSplit } from "./session/drillSession.js";

function buildSession(phase, overrides = {}) {
  return {
    phase,
    unlockedTapeAreas: [],
    enteredLevelAt: null,
    tapeStartedAt: null,
    tapeUnlockedAt: null,
    challengeStartedAt: null,
    phaseStartedAt: 1000,
    ...overrides
  };
}

test("skipSessionSplit skips travel into tape when the objective still needs tape", () => {
  const objective = {
    id: "dogen_092",
    area: "Dogen",
    type: "grind_count"
  };
  const now = 2500;
  const session = buildSession("travel");

  const nextSession = skipSessionSplit({
    session,
    objective,
    now
  });

  assert.equal(nextSession.phase, "tape");
  assert.equal(nextSession.phaseStartedAt, now);
  assert.equal(nextSession.tapeStartedAt, now);
  assert.equal(nextSession.challengeStartedAt, null);
  assert.equal(nextSession.tapeUnlockedAt, null);
});

test("skipSessionSplit skips travel directly into challenge when tape is not required", () => {
  const objective = {
    id: "dogen_005",
    area: "Dogen",
    type: "default"
  };
  const now = 4200;
  const session = buildSession("travel");

  const nextSession = skipSessionSplit({
    session,
    objective,
    now
  });

  assert.equal(nextSession.phase, "challenge");
  assert.equal(nextSession.phaseStartedAt, now);
  assert.equal(nextSession.tapeStartedAt, null);
  assert.equal(nextSession.challengeStartedAt, now);
  assert.equal(nextSession.tapeUnlockedAt, null);
});

test("skipSessionSplit skips tape into challenge without unlocking tape", () => {
  const objective = {
    id: "dogen_092",
    area: "Dogen",
    type: "grind_count"
  };
  const now = 5100;
  const session = buildSession("tape", {
    tapeStartedAt: 4500,
    tapeUnlockedAt: null
  });

  const nextSession = skipSessionSplit({
    session,
    objective,
    now
  });

  assert.equal(nextSession.phase, "challenge");
  assert.equal(nextSession.phaseStartedAt, now);
  assert.equal(nextSession.challengeStartedAt, now);
  assert.equal(nextSession.tapeUnlockedAt, null);
});

test("skipSessionSplit leaves challenge phase unchanged", () => {
  const objective = {
    id: "dogen_092",
    area: "Dogen",
    type: "grind_count"
  };
  const session = buildSession("challenge", {
    challengeStartedAt: 6000,
    phaseStartedAt: 6000
  });

  const nextSession = skipSessionSplit({
    session,
    objective,
    now: 9000
  });

  assert.equal(nextSession, session);
});
