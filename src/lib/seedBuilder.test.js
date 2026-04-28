import test from "node:test";
import assert from "node:assert/strict";

import { allObjectives } from "../data/objectives.js";
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
    startingArea: "Garage",
    selectedArea: "Dogen",
    routeVisibleCount: 4,
    routeRevealMode: "rolling",
    rngSeed: TEST_RNG_SEED
  });
  const decoded = decodeSessionSeed(launchState.exportSeed);

  assert.equal(decoded.sessionType, "practice");
  assert.deepEqual(decoded.objectiveIds, ["dogen_graffiti", "rdh_010"]);
  assert.equal(decoded.config.startingArea, "Garage");
  assert.deepEqual(decoded, launchState.sessionSpec);
});

test("buildSeedBuilderLaunchState preserves route visible count and reveal mode", () => {
  const launchState = buildSeedBuilderLaunchState({
    sessionType: "route",
    objectiveIds: ["dogen_graffiti", "rdh_010", "dogen_005"],
    startingArea: "Garage",
    selectedArea: "Dogen",
    routeVisibleCount: 3,
    routeRevealMode: ROUTE_REVEAL_MODE_BURST,
    routeVisionTrainingEnabled: true,
    rngSeed: TEST_RNG_SEED
  });
  const decoded = decodeSessionSeed(launchState.exportSeed);

  assert.equal(decoded.sessionType, "route");
  assert.deepEqual(decoded.objectiveIds, ["dogen_graffiti", "rdh_010", "dogen_005"]);
  assert.equal(decoded.config.routeVisibleCount, 3);
  assert.equal(decoded.config.routeRevealMode, ROUTE_REVEAL_MODE_BURST);
  assert.equal(decoded.config.routeVisionTrainingEnabled, true);
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
  assert.equal(draft.startingArea, "Garage");
});

test("normalizeSeedBuilderDraft defaults starting area to Garage", () => {
  const draft = normalizeSeedBuilderDraft({
    objectiveIds: ["dogen_graffiti"]
  });

  assert.equal(draft.startingArea, "Garage");
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

test("buildSeedBuilderLaunchState preserves a twenty-five square route board", () => {
  const validObjectiveIds = allObjectives.slice(0, 25).map((objective) => objective.id);
  const launchState = buildSeedBuilderLaunchState({
    sessionType: "route",
    objectiveIds: validObjectiveIds,
    selectedArea: "Dogen",
    routeVisibleCount: 25,
    routeRevealMode: "rolling",
    routeVisionTrainingEnabled: true,
    rngSeed: TEST_RNG_SEED
  });

  assert.equal(launchState.sessionSpec.config.routeVisibleCount, 25);
  assert.equal(launchState.sessionSpec.config.routeVisionTrainingEnabled, true);
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
