import assert from "node:assert/strict";
import test from "node:test";

import { buildAnalyticsViewModel } from "./stats/analytics.js";

test("buildAnalyticsViewModel derives seed rows and grouped runs from history", () => {
  const history = [
    {
      sessionType: "practice",
      sessionId: "drill_a",
      objectiveId: "dogen_005",
      label: "Dogen - First",
      result: "complete",
      challengeDurationMs: 5000,
      durationMs: 5000,
      exportSeed: "BNGSD3.drill",
      sessionObjectiveIndex: 0,
      endedAt: 1000
    },
    {
      sessionType: "practice",
      sessionId: "drill_a",
      objectiveId: "rdh_010",
      label: "RDH - Final",
      result: "complete",
      challengeDurationMs: 6000,
      durationMs: 6000,
      exportSeed: "BNGSD3.drill",
      sessionObjectiveIndex: 1,
      sessionCompleted: true,
      sessionObjectiveCount: 2,
      sessionTotalDurationMs: 15000,
      endedAt: 2000
    },
    {
      sessionType: "practice",
      sessionId: "drill_b",
      objectiveId: "dogen_005",
      label: "Dogen - First",
      result: "complete",
      challengeDurationMs: 4500,
      durationMs: 4500,
      exportSeed: "BNGSD3.drill",
      sessionObjectiveIndex: 0,
      endedAt: 3000
    },
    {
      sessionType: "practice",
      sessionId: "drill_b",
      objectiveId: "rdh_010",
      label: "RDH - Final",
      result: "complete",
      challengeDurationMs: 5500,
      durationMs: 5500,
      exportSeed: "BNGSD3.drill",
      sessionObjectiveIndex: 1,
      sessionCompleted: true,
      sessionObjectiveCount: 2,
      sessionTotalDurationMs: 13000,
      endedAt: 4000
    },
    {
      sessionType: "route",
      sessionId: "route_a",
      label: "Rolling Route x2",
      result: "complete",
      exportSeed: "BNGSD3.route",
      totalDurationMs: 9000,
      objectiveCount: 2,
      squaresCleared: 2,
      visibleCount: 2,
      routeRevealMode: "rolling",
      endedAt: 5000,
      routeClearEvents: [
        {
          objectiveId: "dogen_005",
          slotIndex: 0,
          elapsedMs: 3000
        },
        {
          objectiveId: "rdh_010",
          slotIndex: 1,
          elapsedMs: 9000
        }
      ]
    }
  ];

  const analytics = buildAnalyticsViewModel(history, {
    seedNamesByExportSeed: {
      "BNGSD3.drill": "Drill opener"
    }
  });

  assert.equal(analytics.overview.drillRuns, 2);
  assert.equal(analytics.overview.routeRuns, 1);
  assert.equal(analytics.overview.squaresMarked, 6);
  assert.equal(analytics.practiceSeeds.length, 1);
  assert.equal(analytics.practiceSeeds[0].customName, "Drill opener");
  assert.equal(analytics.practiceSeeds[0].displayName, "Drill opener");
  assert.equal(analytics.practiceSeeds[0].seedPrefix, "BNGSD3");
  assert.equal(analytics.practiceSeeds[0].seedPreview, "drill");
  assert.equal(analytics.practiceSeeds[0].objectiveCount, 2);
  assert.equal(analytics.practiceSeeds[0].attempts, 2);
  assert.equal(analytics.practiceSeeds[0].pbDurationMs, 13000);
  assert.equal(analytics.practiceSeeds[0].latestDeltaMs, 0);
  assert.equal(analytics.practiceSeeds[0].firstToBestDeltaMs, 2000);
  assert.equal(analytics.routeSeeds.length, 1);
  assert.equal(analytics.routeSeeds[0].objectiveCount, 2);
  assert.equal(analytics.runs.length, 3);
  assert.equal(analytics.runs[0].sessionId, "route_a");
  assert.equal(analytics.runs[0].averageGapMs, 6000);
  assert.equal(analytics.runs[0].longestGapMs, 6000);
});
