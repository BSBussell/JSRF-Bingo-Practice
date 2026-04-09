import assert from "node:assert/strict";
import test from "node:test";

import { rebuildPerformanceState } from "./stats/stats.js";

function buildEntry({
  sessionType = "practice",
  objectiveId,
  label,
  area = "Garage",
  type = "score",
  result = "complete",
  challengeDurationMs,
  totalDurationMs,
  tapeDurationMs = null,
  endedAt,
  visibleCount = null,
  objectiveCount = null,
  squaresCleared = null
}) {
  return {
    sessionType,
    objectiveId,
    label,
    area,
    type,
    result,
    durationMs: challengeDurationMs ?? totalDurationMs,
    challengeDurationMs,
    totalDurationMs,
    tapeDurationMs,
    endedAt,
    visibleCount,
    objectiveCount,
    squaresCleared
  };
}

test("rebuildPerformanceState recomputes PBs and area stats from remaining history", () => {
  const history = [
    buildEntry({
      objectiveId: "garage_square",
      label: "Garage Square",
      challengeDurationMs: 5000,
      totalDurationMs: 6200,
      tapeDurationMs: 1200,
      endedAt: 100
    }),
    buildEntry({
      objectiveId: "garage_square",
      label: "Garage Square",
      challengeDurationMs: 3000,
      totalDurationMs: 4100,
      tapeDurationMs: 800,
      endedAt: 200
    }),
    buildEntry({
      objectiveId: "garage_graffiti",
      label: "Garage Graffiti",
      type: "graffiti",
      challengeDurationMs: 7000,
      totalDurationMs: 7600,
      endedAt: 300
    }),
    buildEntry({
      objectiveId: "ignored_skip",
      label: "Ignored Skip",
      result: "skip",
      challengeDurationMs: 2000,
      totalDurationMs: 2100,
      endedAt: 400
    })
  ];

  const rebuilt = rebuildPerformanceState(history.filter((_, index) => index !== 1));

  assert.deepEqual(rebuilt.bestTimesByObjective, {
    garage_square: {
      durationMs: 5000,
      totalDurationMs: 6200,
      label: "Garage Square",
      area: "Garage",
      type: "score",
      updatedAt: 100
    },
    garage_graffiti: {
      durationMs: 7000,
      totalDurationMs: 7600,
      label: "Garage Graffiti",
      area: "Garage",
      type: "graffiti",
      updatedAt: 300
    }
  });
  assert.deepEqual(rebuilt.aggregateStats, {
    squareByArea: {
      Garage: {
        attempts: 1,
        completions: 1,
        totalDurationMs: 5000,
        bestMs: 5000
      }
    },
    tapeByArea: {
      Garage: {
        attempts: 1,
        completions: 1,
        totalDurationMs: 1200,
        bestMs: 1200
      }
    },
    graffitiByArea: {
      Garage: {
        attempts: 1,
        completions: 1,
        totalDurationMs: 7000,
        bestMs: 7000
      }
    },
    routeByVisibleCount: {}
  });
});

test("rebuildPerformanceState tracks route runs separately from practice PBs", () => {
  const history = [
    buildEntry({
      sessionType: "route",
      objectiveId: null,
      label: "Route x4",
      totalDurationMs: 9000,
      endedAt: 100,
      visibleCount: 4,
      objectiveCount: 12,
      squaresCleared: 12
    }),
    buildEntry({
      objectiveId: "garage_square",
      label: "Garage Square",
      challengeDurationMs: 3000,
      totalDurationMs: 4100,
      endedAt: 200
    })
  ];

  const rebuilt = rebuildPerformanceState(history);

  assert.deepEqual(rebuilt.bestTimesByObjective, {
    garage_square: {
      durationMs: 3000,
      totalDurationMs: 4100,
      label: "Garage Square",
      area: "Garage",
      type: "score",
      updatedAt: 200
    }
  });
  assert.deepEqual(rebuilt.aggregateStats.routeByVisibleCount, {
    4: {
      attempts: 1,
      completions: 1,
      totalDurationMs: 9000,
      bestMs: 9000
    }
  });
});
