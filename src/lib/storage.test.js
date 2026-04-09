import assert from "node:assert/strict";
import test from "node:test";

import { buildSessionConfig, buildSessionSpecFromConfig, encodeSessionSeed } from "./seed/sessionSeed.js";
import { createDefaultAppState, normalizeAppState } from "./storage.js";

test("createDefaultAppState initializes pendingCompletion as null", () => {
  const state = createDefaultAppState();
  assert.equal(state.settings.autoOpenPopout, false);
  assert.equal(state.startCountdown, null);
  assert.equal(state.pendingCompletion, null);
});

test("normalizeAppState preserves autoOpenPopout setting", () => {
  const state = normalizeAppState({
    settings: {
      autoOpenPopout: true
    }
  });

  assert.equal(state.settings.autoOpenPopout, true);
});

test("normalizeAppState preserves a valid shared startCountdown payload", () => {
  const { sessionSpec, exportSeed } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 2
    }),
    "89abcdef01234567fedcba9876543210"
  );
  const state = normalizeAppState({
    selectedMode: "practice",
    startCountdown: {
      id: "countdown_1234",
      sessionId: "session_1234",
      startedAt: 1234,
      exportSeed,
      sessionSpec
    }
  });

  assert.ok(state.startCountdown);
  assert.equal(state.startCountdown.id, "countdown_1234");
  assert.equal(state.startCountdown.sessionId, "session_1234");
  assert.equal(state.startCountdown.startedAt, 1234);
  assert.equal(state.startCountdown.exportSeed, exportSeed);
  assert.deepEqual(state.startCountdown.sessionSpec.objectiveIds, sessionSpec.objectiveIds);
});

test("normalizeAppState drops invalid startCountdown payloads", () => {
  const state = normalizeAppState({
    selectedMode: "practice",
    startCountdown: {
      id: "broken_countdown",
      startedAt: 1234
    }
  });

  assert.equal(state.startCountdown, null);
});

test("normalizeAppState preserves a valid pendingCompletion payload", () => {
  const { sessionSpec, exportSeed } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 2
    }),
    "0123456789abcdeffedcba9876543210"
  );
  const state = normalizeAppState({
    selectedMode: "practice",
    pendingCompletion: {
      sessionId: "session_complete",
      finishedAt: 4500,
      objectiveCount: 2,
      squaresCleared: 1,
      totalDurationMs: 3900,
      exportSeed,
      sessionSpec
    }
  });

  assert.ok(state.pendingCompletion);
  assert.equal(state.pendingCompletion.sessionId, "session_complete");
  assert.equal(state.pendingCompletion.finishedAt, 4500);
  assert.equal(state.pendingCompletion.objectiveCount, 2);
  assert.equal(state.pendingCompletion.squaresCleared, 1);
  assert.equal(state.pendingCompletion.totalDurationMs, 3900);
  assert.equal(state.pendingCompletion.exportSeed, exportSeed);
  assert.deepEqual(state.pendingCompletion.sessionSpec.objectiveIds, sessionSpec.objectiveIds);
});

test("normalizeAppState computes missing pendingCompletion export seed from sessionSpec", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 1
    }),
    "fedcba98765432100123456789abcdef"
  );
  const state = normalizeAppState({
    selectedMode: "practice",
    pendingCompletion: {
      sessionId: "seedless_completion",
      finishedAt: 2000,
      objectiveCount: 1,
      squaresCleared: 1,
      totalDurationMs: 1337,
      sessionSpec
    }
  });

  assert.ok(state.pendingCompletion);
  assert.equal(state.pendingCompletion.squaresCleared, 1);
  assert.equal(state.pendingCompletion.exportSeed, encodeSessionSeed(sessionSpec));
});

test("normalizeAppState drops invalid pendingCompletion payloads", () => {
  const state = normalizeAppState({
    selectedMode: "practice",
    pendingCompletion: {
      sessionId: "broken_completion",
      exportSeed: "BNGSD2.invalid"
    }
  });

  assert.equal(state.pendingCompletion, null);
});
