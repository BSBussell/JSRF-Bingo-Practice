import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSessionConfig,
  mergeSessionConfigIntoDrillSettings
} from "./session/sessionConfig.js";
import {
  ROUTE_REVEAL_MODE_BURST,
  ROUTE_REVEAL_MODE_ROLLING
} from "./session/routeRevealMode.js";

test("practice launches preserve route-only drill settings", () => {
  const previousSettings = buildSessionConfig("Garage", {
    routeVisibleCount: 7,
    routeRevealMode: ROUTE_REVEAL_MODE_BURST,
    routeVisionTrainingEnabled: true
  });
  const importedPracticeConfig = buildSessionConfig("Dogen", {
    numberOfObjectives: 12,
    routeVisibleCount: 2,
    routeRevealMode: ROUTE_REVEAL_MODE_ROLLING
  });

  const mergedSettings = mergeSessionConfigIntoDrillSettings(
    previousSettings,
    importedPracticeConfig,
    "practice"
  );

  assert.equal(mergedSettings.startingArea, undefined);
  assert.equal(mergedSettings.numberOfObjectives, 12);
  assert.equal(mergedSettings.routeVisibleCount, 7);
  assert.equal(mergedSettings.routeRevealMode, ROUTE_REVEAL_MODE_BURST);
  assert.equal(mergedSettings.routeVisionTrainingEnabled, true);
});

test("route launches persist route-only drill settings", () => {
  const previousSettings = buildSessionConfig("Garage", {
    routeVisibleCount: 7,
    routeRevealMode: ROUTE_REVEAL_MODE_ROLLING,
    routeVisionTrainingEnabled: false
  });
  const routeConfig = buildSessionConfig("Dogen", {
    numberOfObjectives: 12,
    routeVisibleCount: 2,
    routeRevealMode: ROUTE_REVEAL_MODE_BURST,
    routeVisionTrainingEnabled: true
  });

  const mergedSettings = mergeSessionConfigIntoDrillSettings(
    previousSettings,
    routeConfig,
    "route"
  );

  assert.equal(mergedSettings.routeVisibleCount, 2);
  assert.equal(mergedSettings.routeRevealMode, ROUTE_REVEAL_MODE_BURST);
  assert.equal(mergedSettings.routeVisionTrainingEnabled, true);
});

test("route session config preserves visible counts up to twenty-five", () => {
  const routeConfig = buildSessionConfig("Garage", {
    numberOfObjectives: 40,
    routeVisibleCount: 25,
    routeRevealMode: ROUTE_REVEAL_MODE_ROLLING
  });

  assert.equal(routeConfig.routeVisibleCount, 25);
});
