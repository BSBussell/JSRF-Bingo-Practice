import assert from "node:assert/strict";
import test from "node:test";

import { buildSessionConfig, buildSessionSpecFromConfig, encodeSessionSeed } from "./seed/sessionSeed.js";
import { createDefaultAppState, normalizeAppState } from "./storage.js";
import { ROUTE_REVEAL_MODE_BURST } from "./session/routeRevealMode.js";

test("createDefaultAppState initializes pendingCompletion as null", () => {
  const state = createDefaultAppState();
  assert.equal(state.settings.multinodeLink, "");
  assert.equal(state.settings.autoOpenPopout, false);
  assert.equal(state.settings.routeDistrictColorsEnabled, true);
  assert.deepEqual(state.settings.hotkeys.split, {
    code: "Space",
    modifiers: {
      ctrl: true,
      alt: false,
      shift: true,
      meta: false
    }
  });
  assert.deepEqual(state.settings.hotkeys.skip, {
    code: "ArrowRight",
    modifiers: {
      ctrl: true,
      alt: false,
      shift: true,
      meta: false
    }
  });
  assert.deepEqual(state.settings.hotkeys.pause, {
    code: "ArrowDown",
    modifiers: {
      ctrl: true,
      alt: false,
      shift: true,
      meta: false
    }
  });
  assert.deepEqual(state.settings.hotkeys.runBack, {
    code: "ArrowUp",
    modifiers: {
      ctrl: true,
      alt: false,
      shift: true,
      meta: false
    }
  });
  assert.equal(state.settings.hotkeys.skipSplit, null);
  assert.equal(state.settings.hotkeys.toggleGuide, null);
  assert.equal(state.settings.hotkeys.startCountdown, null);
  assert.equal(state.startCountdown, null);
  assert.equal(state.pendingCompletion, null);
});

test("normalizeAppState preserves explicitly unbound hotkeys", () => {
  const state = normalizeAppState({
    settings: {
      hotkeys: {
        split: null,
        skip: "KeyS",
        pause: "KeyP",
        end: "KeyE"
      }
    }
  });

  assert.equal(state.settings.hotkeys.split, null);
});

test("normalizeAppState preserves stats mode selection", () => {
  const state = normalizeAppState({
    selectedMode: "stats"
  });

  assert.equal(state.selectedMode, "stats");
});

test("normalizeAppState preserves bingopedia mode selection", () => {
  const state = normalizeAppState({
    selectedMode: "bingopedia"
  });

  assert.equal(state.selectedMode, "bingopedia");
});

test("normalizeAppState preserves seed builder mode selection", () => {
  const state = normalizeAppState({
    selectedMode: "seed-builder"
  });

  assert.equal(state.selectedMode, "seed-builder");
});

test("createDefaultAppState initializes a seed builder draft", () => {
  const state = createDefaultAppState();

  assert.equal(state.seedBuilderDraft.sessionType, "practice");
  assert.deepEqual(state.seedBuilderDraft.objectiveIds, []);
  assert.equal(state.seedBuilderDraft.startingArea, "Garage");
  assert.equal(typeof state.seedBuilderDraft.rngSeed, "string");
});

test("normalizeAppState backfills a missing seed builder draft", () => {
  const state = normalizeAppState({});

  assert.equal(state.seedBuilderDraft.sessionType, "practice");
  assert.deepEqual(state.seedBuilderDraft.objectiveIds, []);
  assert.equal(state.seedBuilderDraft.startingArea, "Garage");
  assert.equal(typeof state.seedBuilderDraft.rngSeed, "string");
});

test("normalizeAppState normalizes malformed seed builder drafts", () => {
  const state = normalizeAppState({
    seedBuilderDraft: {
      sessionType: "route",
      objectiveIds: ["dogen_graffiti", "not-real", "dogen_graffiti", "rdh_010"],
      selectedArea: "not-real-area",
      routeVisibleCount: 20,
      routeRevealMode: "burst",
      seedInputDraft: 42,
      rngSeed: "00112233445566778899aabbccddeeff"
    }
  });

  assert.equal(state.seedBuilderDraft.sessionType, "route");
  assert.deepEqual(state.seedBuilderDraft.objectiveIds, ["dogen_graffiti", "rdh_010"]);
  assert.equal(state.seedBuilderDraft.startingArea, "Garage");
  assert.equal(state.seedBuilderDraft.selectedArea, "Dogen");
  assert.equal(state.seedBuilderDraft.routeVisibleCount, 2);
  assert.equal(state.seedBuilderDraft.routeRevealMode, "burst");
  assert.equal(state.seedBuilderDraft.seedInputDraft, undefined);
});

test("normalizeAppState preserves trimmed custom seed names", () => {
  const state = normalizeAppState({
    seedNamesByExportSeed: {
      "BNGSD3.abcdefg123": "  Route practice  ",
      "BNGSD3.blank": "   ",
      "": "Missing seed"
    }
  });

  assert.deepEqual(state.seedNamesByExportSeed, {
    "BNGSD3.abcdefg123": "Route practice"
  });
});

test("normalizeAppState preserves autoOpenPopout setting", () => {
  const state = normalizeAppState({
    settings: {
      autoOpenPopout: true
    }
  });

  assert.equal(state.settings.autoOpenPopout, true);
});

test("normalizeAppState preserves trimmed multinodeLink setting", () => {
  const state = normalizeAppState({
    settings: {
      multinodeLink: "  https://jsrfmulti.surge.sh/bingo/?connect=abc123  "
    }
  });

  assert.equal(state.settings.multinodeLink, "https://jsrfmulti.surge.sh/bingo/?connect=abc123");
});

test("normalizeAppState backfills missing hotkey actions to current defaults", () => {
  const state = normalizeAppState({
    settings: {
      hotkeys: {
        split: "Enter",
        skip: "KeyS",
        pause: "KeyP",
        end: "KeyE"
      }
    }
  });

  assert.deepEqual(state.settings.hotkeys.runBack, {
    code: "ArrowUp",
    modifiers: {
      ctrl: true,
      alt: false,
      shift: true,
      meta: false
    }
  });
  assert.equal(state.settings.hotkeys.skipSplit, null);
  assert.equal(state.settings.hotkeys.toggleGuide, null);
  assert.equal(state.settings.hotkeys.startCountdown, null);
});

test("normalizeAppState preserves route district color setting", () => {
  const state = normalizeAppState({
    settings: {
      routeDistrictColorsEnabled: false
    }
  });

  assert.equal(state.settings.routeDistrictColorsEnabled, false);
});

test("normalizeAppState migrates legacy district jump tendency settings to explicit distributions", () => {
  const state = normalizeAppState({
    settings: {
      drillSettings: {
        districtJumpTendency: 2
      }
    }
  });

  assert.deepEqual(state.settings.drillSettings.districtJumpDistribution, [50, 30, 20]);
});

test("normalizeAppState preserves explicit level shift distributions", () => {
  const state = normalizeAppState({
    settings: {
      drillSettings: {
        levelShiftDistribution: [35, 65]
      }
    }
  });

  assert.deepEqual(state.settings.drillSettings.levelShiftDistribution, [35, 65]);
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

test("normalizeAppState preserves a pending startCountdown waiting for Ready", () => {
  const { sessionSpec, exportSeed } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 2
    }),
    "0f1e2d3c4b5a69788796a5b4c3d2e1f0"
  );
  const state = normalizeAppState({
    selectedMode: "practice",
    startCountdown: {
      id: "countdown_pending",
      sessionId: "session_pending",
      startedAt: null,
      exportSeed,
      sessionSpec
    }
  });

  assert.ok(state.startCountdown);
  assert.equal(state.startCountdown.startedAt, null);
  assert.equal(state.startCountdown.sessionId, "session_pending");
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

test("normalizeAppState preserves route mode payloads", () => {
  const { sessionSpec, exportSeed } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 3,
      routeVisibleCount: 2,
      routeRevealMode: ROUTE_REVEAL_MODE_BURST
    }),
    "89abcdef01234567fedcba9876543210",
    "route"
  );
  const state = normalizeAppState({
    selectedMode: "route",
    currentSession: {
      id: "route_session",
      sessionType: "route",
      objectiveIds: sessionSpec.objectiveIds,
      sessionSpec,
      exportSeed,
      visibleObjectiveIds: [sessionSpec.objectiveIds[0], sessionSpec.objectiveIds[1]],
      nextRevealIndex: 2,
      completedCount: 0,
      routeClearEvents: [
        {
          objectiveId: sessionSpec.objectiveIds[0],
          slotIndex: 0,
          endedAt: 1000,
          elapsedMs: 877
        }
      ],
      sessionStartedAt: 123,
      sessionTotalPausedMs: 50
    },
    pendingCompletion: {
      sessionId: "route_complete",
      sessionType: "route",
      finishedAt: 4500,
      objectiveCount: 3,
      squaresCleared: 3,
      totalDurationMs: 3900,
      visibleCount: 2,
      routeRevealMode: ROUTE_REVEAL_MODE_BURST,
      routeClearEvents: [
        {
          objectiveId: sessionSpec.objectiveIds[0],
          slotIndex: 0,
          endedAt: 1000,
          elapsedMs: 877
        }
      ],
      exportSeed,
      sessionSpec
    }
  });

  assert.equal(state.selectedMode, "route");
  assert.equal(state.currentSession.sessionType, "route");
  assert.deepEqual(state.currentSession.visibleObjectiveIds, [
    sessionSpec.objectiveIds[0],
    sessionSpec.objectiveIds[1]
  ]);
  assert.deepEqual(state.currentSession.routeClearEvents, [
    {
      objectiveId: sessionSpec.objectiveIds[0],
      slotIndex: 0,
      endedAt: 1000,
      elapsedMs: 877
    }
  ]);
  assert.equal(state.pendingCompletion.sessionType, "route");
  assert.equal(state.pendingCompletion.visibleCount, 2);
  assert.equal(state.pendingCompletion.routeRevealMode, ROUTE_REVEAL_MODE_BURST);
  assert.deepEqual(state.pendingCompletion.routeClearEvents, [
    {
      objectiveId: sessionSpec.objectiveIds[0],
      slotIndex: 0,
      endedAt: 1000,
      elapsedMs: 877
    }
  ]);
  assert.deepEqual(state.aggregateStats, {
    squareByArea: {},
    tapeByArea: {},
    graffitiByArea: {}
  });
});

test("normalizeAppState migrates legacy Jazz objective ids to 99th Street", () => {
  const legacyObjectiveId = "sdpp_unlock_jazz";
  const migratedObjectiveId = "99th_unlock_jazz";
  const sessionSpec = {
    version: 3,
    sessionType: "practice",
    rngSeed: "00112233445566778899aabbccddeeff",
    config: buildSessionConfig("Garage", {
      numberOfObjectives: 1
    }),
    objectiveIds: [legacyObjectiveId]
  };
  const state = normalizeAppState({
    selectedMode: "practice",
    currentSession: {
      id: "jazz_session",
      sessionType: "practice",
      currentArea: "Garage",
      currentObjectiveIndex: 0,
      objectiveIds: [legacyObjectiveId],
      sessionSpec
    },
    startCountdown: {
      sessionSpec
    },
    pendingCompletion: {
      sessionSpec
    },
    history: [
      {
        sessionId: "jazz_session",
        objectiveId: legacyObjectiveId,
        type: "unlock",
        result: "complete"
      }
    ],
    bestTimesByObjective: {
      [legacyObjectiveId]: {
        durationMs: 1000,
        type: "unlock"
      }
    }
  });

  assert.equal(state.currentSession.currentObjectiveId, migratedObjectiveId);
  assert.deepEqual(state.currentSession.sessionSpec.objectiveIds, [migratedObjectiveId]);
  assert.deepEqual(state.startCountdown.sessionSpec.objectiveIds, [migratedObjectiveId]);
  assert.deepEqual(state.pendingCompletion.sessionSpec.objectiveIds, [migratedObjectiveId]);
  assert.equal(state.history[0].objectiveId, migratedObjectiveId);
  assert.deepEqual(Object.keys(state.bestTimesByObjective), [migratedObjectiveId]);
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

test("normalizeAppState preserves practice seed completion timing fields", () => {
  const state = normalizeAppState({
    history: [
      {
        sessionType: "practice",
        sessionId: "practice_seed",
        objectiveId: "dogen_005",
        result: "complete",
        exportSeed: "BNGSD3.practice",
        sessionObjectiveIndex: 2,
        sessionElapsedAtCompleteMs: 12345,
        sessionCompleted: true,
        sessionObjectiveCount: 3,
        sessionTotalDurationMs: 23456
      }
    ]
  });

  assert.equal(state.history[0].exportSeed, "BNGSD3.practice");
  assert.equal(state.history[0].sessionObjectiveIndex, 2);
  assert.equal(state.history[0].sessionElapsedAtCompleteMs, 12345);
  assert.equal(state.history[0].sessionCompleted, true);
  assert.equal(state.history[0].sessionObjectiveCount, 3);
  assert.equal(state.history[0].sessionTotalDurationMs, 23456);
});

test("normalizeAppState drops legacy route stats buckets", () => {
  const state = normalizeAppState({
    aggregateStats: {
      routeByVisibleCount: {
        4: {
          attempts: 2,
          completions: 2,
          totalDurationMs: 10000,
          bestMs: 4500
        }
      }
    }
  });

  assert.deepEqual(state.aggregateStats, {
    squareByArea: {},
    tapeByArea: {},
    graffitiByArea: {}
  });
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
