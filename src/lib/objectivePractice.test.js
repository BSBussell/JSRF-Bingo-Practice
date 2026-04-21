import assert from "node:assert/strict";
import test from "node:test";

import { decodeSessionSeed } from "./seed/sessionSeed.js";
import { buildObjectivePracticeLaunch } from "./session/objectivePractice.js";

test("buildObjectivePracticeLaunch creates a one-square practice seed", () => {
  const launchState = buildObjectivePracticeLaunch("dogen_graffiti", {
    drillSettings: {
      numberOfObjectives: 25,
      graffitiVariance: -3
    },
    rngSeed: "00112233445566778899aabbccddeeff"
  });
  const decoded = decodeSessionSeed(launchState.exportSeed);

  assert.equal(launchState.sessionSpec.sessionType, "practice");
  assert.equal(launchState.sessionSpec.config.startingArea, "Dogen");
  assert.equal(launchState.sessionSpec.config.numberOfObjectives, 1);
  assert.deepEqual(launchState.sessionSpec.objectiveIds, ["dogen_graffiti"]);
  assert.deepEqual(decoded, launchState.sessionSpec);
});

test("buildObjectivePracticeLaunch rejects unknown objective ids", () => {
  assert.equal(
    buildObjectivePracticeLaunch("not_real", {
      rngSeed: "00112233445566778899aabbccddeeff"
    }),
    null
  );
});
