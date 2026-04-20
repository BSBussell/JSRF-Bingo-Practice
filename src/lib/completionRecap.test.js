import assert from "node:assert/strict";
import test from "node:test";

import { buildCompletionRecap } from "./session/completionRecap.js";

test("buildCompletionRecap derives practice seed PB and split facts from session history", () => {
  const completionSummary = {
    sessionId: "practice_1",
    sessionType: "practice",
    exportSeed: "BNGSD3.practice",
    totalDurationMs: 20000
  };
  const history = [
    {
      sessionId: "practice_prior",
      sessionType: "practice",
      objectiveId: "prior_final",
      label: "Garage - Prior final",
      result: "complete",
      challengeDurationMs: 7000,
      durationMs: 7000,
      previousBestMs: 8000,
      exportSeed: "BNGSD3.practice",
      sessionCompleted: true,
      sessionTotalDurationMs: 22000
    },
    {
      sessionId: "practice_1",
      sessionType: "practice",
      objectiveId: "a",
      label: "RDH - Fast clear",
      area: "RDH",
      district: "Kogane",
      result: "complete",
      challengeDurationMs: 5000,
      durationMs: 5000,
      previousBestMs: 6000
    },
    {
      sessionId: "practice_1",
      sessionType: "practice",
      objectiveId: "b",
      label: "Dogen - Missed clear",
      area: "Dogen",
      district: "ShibuyaCho",
      result: "complete",
      challengeDurationMs: 3400,
      durationMs: 3400,
      previousBestMs: 3000
    },
    {
      sessionId: "practice_1",
      sessionType: "practice",
      objectiveId: "c",
      label: "99th - First clear",
      area: "_99th",
      district: "Benten",
      result: "complete",
      challengeDurationMs: 2000,
      durationMs: 2000,
      previousBestMs: null,
      exportSeed: "BNGSD3.practice",
      sessionCompleted: true,
      sessionTotalDurationMs: 20000
    },
    {
      sessionId: "practice_1",
      sessionType: "practice",
      objectiveId: "d",
      label: "Garage - Skipped clear",
      result: "skip",
      challengeDurationMs: 1000,
      durationMs: 1000,
      previousBestMs: 1200
    }
  ];

  const recap = buildCompletionRecap({ completionSummary, history });
  const facts = Object.fromEntries(recap.facts.map((fact) => [fact.key, fact]));

  assert.equal(recap.sessionType, "practice");
  assert.equal(facts.totalTime.durationMs, 20000);
  assert.equal(facts.practiceSeedPbStatus.status, "new-pb");
  assert.equal(facts.practiceSeedPbStatus.pbDurationMs, 22000);
  assert.equal(facts.practiceSeedPbStatus.deltaMs, -2000);
  assert.equal(recap.attempts.key, "practiceSeedAttempts");
  assert.equal(recap.attempts.count, 2);
  assert.equal(facts.practiceSeedAttempts, undefined);
  assert.equal(facts.practicePbStatus, undefined);
  assert.equal(facts.practicePbCount, undefined);
  assert.equal(facts.fastestObjective.durationMs, 2000);
  assert.deepEqual(facts.fastestObjective.detailSegments, [
    {
      label: "99th",
      district: "Benten"
    },
    {
      label: "-",
      district: "",
      separator: true
    },
    {
      label: "First clear",
      district: ""
    }
  ]);
  assert.equal(facts.slowestObjective.durationMs, 5000);
  assert.deepEqual(facts.slowestObjective.detailSegments, [
    {
      label: "RDH",
      district: "Kogane"
    },
    {
      label: "-",
      district: "",
      separator: true
    },
    {
      label: "Fast clear",
      district: ""
    }
  ]);
});

test("buildCompletionRecap derives route exact-seed and clear-cadence facts", () => {
  const completionSummary = {
    sessionId: "route_current",
    sessionType: "route",
    exportSeed: "BNGSD3.route",
    totalDurationMs: 9000,
    routeClearEvents: [
      {
        objectiveId: "dogen_005",
        slotIndex: 0,
        endedAt: 1000,
        elapsedMs: 1000
      },
      {
        objectiveId: "dogen_034",
        slotIndex: 1,
        endedAt: 2500,
        elapsedMs: 2500
      },
      {
        objectiveId: "rdh_010",
        slotIndex: 0,
        endedAt: 5000,
        elapsedMs: 5000
      },
      {
        objectiveId: "99th_068",
        slotIndex: 2,
        endedAt: 9000,
        elapsedMs: 9000
      }
    ]
  };
  const history = [
    {
      sessionId: "route_prior",
      sessionType: "route",
      result: "complete",
      exportSeed: "BNGSD3.route",
      totalDurationMs: 10000
    },
    {
      sessionId: "route_current",
      sessionType: "route",
      result: "complete",
      exportSeed: "BNGSD3.route",
      totalDurationMs: 9000
    }
  ];

  const recap = buildCompletionRecap({ completionSummary, history });
  const facts = Object.fromEntries(recap.facts.map((fact) => [fact.key, fact]));

  assert.equal(recap.sessionType, "route");
  assert.equal(facts.totalTime.durationMs, 9000);
  assert.equal(facts.routeSeedPbStatus.status, "new-pb");
  assert.equal(facts.routeSeedPbStatus.pbDurationMs, 10000);
  assert.equal(facts.routeSeedPbStatus.deltaMs, -1000);
  assert.equal(recap.attempts.key, "routeSeedAttempts");
  assert.equal(recap.attempts.count, 2);
  assert.equal(facts.routeSeedAttempts, undefined);
  assert.equal(facts.routeTimeToFirstClear, undefined);
  assert.equal(facts.routeAverageGap.durationMs, 2667);
  assert.equal(facts.routeLongestGap.durationMs, 4000);
  assert.deepEqual(facts.routeLongestGap.detailSegments, [
    {
      label: "RDH Top of station",
      district: "Kogane"
    },
    {
      label: ">",
      district: "",
      separator: true
    },
    {
      label: "99th Center of Dark",
      district: "Benten"
    }
  ]);
  assert.equal(facts.routeBestChain, undefined);
  assert.equal(facts.routeDistrictJumps, undefined);
});
