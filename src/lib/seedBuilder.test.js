import test from "node:test";
import assert from "node:assert/strict";

import { decodeSessionSeed } from "./seed/sessionSeed.js";
import {
  buildSeedBuilderLaunchState,
  createSeedBuilderDraftFromSessionSpec,
  insertSeedBuilderObjective,
  moveSeedBuilderObjective,
  normalizeSeedBuilderDraft,
  normalizeSeedBuilderDraftAfterObjectiveChange,
  removeSeedBuilderObjective
} from "./seedBuilder.js";
import { ROUTE_REVEAL_MODE_BURST } from "./session/routeRevealMode.js";

const TEST_RNG_SEED = "00112233445566778899aabbccddeeff";

test("buildSeedBuilderLaunchState creates an ordered practice replay seed", () => {
  const launchState = buildSeedBuilderLaunchState({
    sessionType: "practice",
    objectiveIds: ["dogen_graffiti", "rdh_010"],
    selectedArea: "Dogen",
    routeVisibleCount: 4,
    routeRevealMode: "rolling",
    rngSeed: TEST_RNG_SEED
  });
  const decoded = decodeSessionSeed(launchState.exportSeed);

  assert.equal(decoded.sessionType, "practice");
  assert.deepEqual(decoded.objectiveIds, ["dogen_graffiti", "rdh_010"]);
  assert.equal(decoded.config.startingArea, "Dogen");
  assert.deepEqual(decoded, launchState.sessionSpec);
});

test("buildSeedBuilderLaunchState preserves route visible count and reveal mode", () => {
  const launchState = buildSeedBuilderLaunchState({
    sessionType: "route",
    objectiveIds: ["dogen_graffiti", "rdh_010", "dogen_005"],
    selectedArea: "Dogen",
    routeVisibleCount: 3,
    routeRevealMode: ROUTE_REVEAL_MODE_BURST,
    rngSeed: TEST_RNG_SEED
  });
  const decoded = decodeSessionSeed(launchState.exportSeed);

  assert.equal(decoded.sessionType, "route");
  assert.deepEqual(decoded.objectiveIds, ["dogen_graffiti", "rdh_010", "dogen_005"]);
  assert.equal(decoded.config.routeVisibleCount, 3);
  assert.equal(decoded.config.routeRevealMode, ROUTE_REVEAL_MODE_BURST);
});

test("normalizeSeedBuilderDraft drops duplicate and invalid objective ids", () => {
  const draft = normalizeSeedBuilderDraft({
    objectiveIds: [
      "dogen_graffiti",
      "not-real",
      "dogen_graffiti",
      "rdh_010"
    ],
    selectedArea: "Dogen",
    rngSeed: TEST_RNG_SEED
  });

  assert.deepEqual(draft.objectiveIds, ["dogen_graffiti", "rdh_010"]);
});

test("buildSeedBuilderLaunchState rejects route drafts with fewer than two squares", () => {
  assert.throws(
    () =>
      buildSeedBuilderLaunchState({
        sessionType: "route",
        objectiveIds: ["dogen_graffiti"],
        selectedArea: "Dogen",
        routeVisibleCount: 4,
        routeRevealMode: "rolling",
        rngSeed: TEST_RNG_SEED
      }),
    /Route seeds need at least two squares/
  );
});

test("buildSeedBuilderLaunchState clamps route visible count to the objective count", () => {
  const launchState = buildSeedBuilderLaunchState({
    sessionType: "route",
    objectiveIds: ["dogen_graffiti", "rdh_010", "dogen_005"],
    selectedArea: "Dogen",
    routeVisibleCount: 10,
    routeRevealMode: "rolling",
    rngSeed: TEST_RNG_SEED
  });

  assert.equal(launchState.sessionSpec.config.routeVisibleCount, 3);
});

test("createSeedBuilderDraftFromSessionSpec normalizes imported seeds into a unique draft", () => {
  const launchState = buildSeedBuilderLaunchState({
    sessionType: "practice",
    objectiveIds: ["dogen_graffiti", "rdh_010"],
    selectedArea: "Dogen",
    routeVisibleCount: 4,
    routeRevealMode: "rolling",
    rngSeed: TEST_RNG_SEED
  });
  const importedDraft = createSeedBuilderDraftFromSessionSpec(
    {
      ...launchState.sessionSpec,
      objectiveIds: ["dogen_graffiti", "dogen_graffiti", "rdh_010"]
    },
    null
  );

  assert.deepEqual(importedDraft.objectiveIds, ["dogen_graffiti", "rdh_010"]);
  assert.equal(importedDraft.selectedArea, "Dogen");
});

test("moveSeedBuilderObjective reorders objective ids without changing membership", () => {
  assert.deepEqual(
    moveSeedBuilderObjective(["dogen_graffiti", "rdh_010", "dogen_005"], 0, 2),
    ["rdh_010", "dogen_005", "dogen_graffiti"]
  );
});

test("insertSeedBuilderObjective inserts a unique objective at the requested index", () => {
  assert.deepEqual(
    insertSeedBuilderObjective(["dogen_graffiti", "dogen_005"], "rdh_010", 1),
    ["dogen_graffiti", "rdh_010", "dogen_005"]
  );
});

test("insertSeedBuilderObjective ignores duplicate picker adds", () => {
  assert.deepEqual(
    insertSeedBuilderObjective(["dogen_graffiti", "rdh_010"], "rdh_010", 1),
    ["dogen_graffiti", "rdh_010"]
  );
});

test("removeSeedBuilderObjective removes an objective by index", () => {
  assert.deepEqual(
    removeSeedBuilderObjective(["dogen_graffiti", "rdh_010", "dogen_005"], 1),
    ["dogen_graffiti", "dogen_005"]
  );
});

test("normalizeSeedBuilderDraftAfterObjectiveChange clamps route visible count after shrink", () => {
  const draft = normalizeSeedBuilderDraftAfterObjectiveChange(
    {
      sessionType: "route",
      objectiveIds: ["dogen_graffiti", "rdh_010", "dogen_005"],
      routeVisibleCount: 3,
      routeRevealMode: "rolling",
      rngSeed: TEST_RNG_SEED
    },
    ["dogen_graffiti", "rdh_010"]
  );

  assert.equal(draft.routeVisibleCount, 2);
});
