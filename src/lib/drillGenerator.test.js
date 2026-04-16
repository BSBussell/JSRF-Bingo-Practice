import assert from "node:assert/strict";
import test from "node:test";

import { allObjectives } from "../data/objectives.js";
import { generateNextDrill } from "./drill/drillGenerator.js";
import {
  buildSessionConfig,
  buildSessionSpecFromConfig,
  createSeededRng
} from "./seed/sessionSeed.js";

test("generateNextDrill keeps category-restricted configs out of dead movement buckets", () => {
  const config = buildSessionConfig("Dogen", {
    numberOfObjectives: 13,
    graffitiVariance: 2,
    unlockVariance: -3,
    defaultVariance: -3,
    notebookVariance: -3,
    trueRandom: false
  });

  const objective = generateNextDrill(allObjectives, {
    currentArea: "Dogen",
    usedObjectiveIds: ["dogen_graffiti"],
    history: [
      {
        sessionId: "seeded-session",
        objectiveId: "dogen_graffiti",
        label: "Dogenzaka - Graffiti Route",
        area: "Dogen",
        district: "ShibuyaCho",
        type: "graffiti",
        runClass: "long",
        result: "complete",
        startedAt: 0,
        endedAt: 1
      }
    ],
    sessionId: "seeded-session",
    drillSettings: config,
    rng: createSeededRng("graffiti-only-next")
  });

  assert.ok(objective);
  assert.equal(objective.type, "graffiti");
  assert.notEqual(objective.id, "dogen_graffiti");
});

test("buildSessionSpecFromConfig can precompute a graffiti-only seeded session", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 25,
      graffitiVariance: 2,
      unlockVariance: -3,
      defaultVariance: -3,
      notebookVariance: -3,
      trueRandom: false
    }),
    "00112233445566778899aabbccddeeff"
  );

  assert.equal(sessionSpec.objectiveIds.length, 13);
  assert.equal(new Set(sessionSpec.objectiveIds).size, 13);
  assert.deepEqual(
    sessionSpec.objectiveIds.map(
      (objectiveId) => allObjectives.find((objective) => objective.id === objectiveId)?.type
    ),
    Array(13).fill("graffiti")
  );
});

test("buildSessionSpecFromConfig keeps the full seeded session objective list unique", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 25,
      districtShift: 2,
      districtJumpDistribution: [100, 0, 0],
      trueRandom: false
    }),
    "89abcdef01234567fedcba9876543210"
  );

  assert.equal(sessionSpec.objectiveIds.length, 25);
  assert.equal(new Set(sessionSpec.objectiveIds).size, 25);
});

test("generateNextDrill keeps used objectives excluded even in true random mode", () => {
  const objectives = [
    {
      id: "dogen_default_a",
      area: "Dogen",
      district: "ShibuyaCho",
      type: "default",
      runClass: "short"
    },
    {
      id: "dogen_default_b",
      area: "Dogen",
      district: "ShibuyaCho",
      type: "default",
      runClass: "short"
    }
  ];
  const config = buildSessionConfig("Dogen", {
    numberOfObjectives: 2,
    trueRandom: true
  });

  const objective = generateNextDrill(objectives, {
    currentArea: "Dogen",
    usedObjectiveIds: ["dogen_default_a"],
    history: [],
    sessionId: "true-random-session",
    drillSettings: config,
    rng: createSeededRng("true-random-no-repeat")
  });

  assert.ok(objective);
  assert.equal(objective.id, "dogen_default_b");
});

test("generateNextDrill recovery can pick district changes outside the configured jump distribution when needed", () => {
  const objectives = [
    {
      id: "kogane_depth_2",
      area: "BP",
      district: "Kogane",
      type: "default",
      runClass: "short"
    }
  ];

  const blockedObjective = generateNextDrill(objectives, {
    currentArea: "Garage",
    usedObjectiveIds: [],
    history: [],
    sessionId: "district-jump-blocked",
    drillSettings: buildSessionConfig("Garage", {
      numberOfObjectives: 1,
      districtShift: 2,
      districtJumpDistribution: [100, 0, 0]
    }),
    rng: createSeededRng("district-jump-blocked")
  });
  const allowedObjective = generateNextDrill(objectives, {
    currentArea: "Garage",
    usedObjectiveIds: [],
    history: [],
    sessionId: "district-jump-allowed",
    drillSettings: buildSessionConfig("Garage", {
      numberOfObjectives: 1,
      districtShift: 2,
      districtJumpDistribution: [0, 0, 100]
    }),
    rng: createSeededRng("district-jump-allowed")
  });

  assert.equal(blockedObjective?.id, "kogane_depth_2");
  assert.equal(allowedObjective?.id, "kogane_depth_2");
});

test("generateNextDrill respects level shift distributions within a district", () => {
  const objectives = [
    {
      id: "kogane_shift_1",
      area: "Sewers",
      district: "Kogane",
      type: "default",
      runClass: "short"
    },
    {
      id: "kogane_shift_2",
      area: "RDH",
      district: "Kogane",
      type: "default",
      runClass: "short"
    }
  ];

  const shortShiftObjective = generateNextDrill(objectives, {
    currentArea: "BP",
    usedObjectiveIds: [],
    history: [],
    sessionId: "level-shift-short",
    drillSettings: buildSessionConfig("BP", {
      numberOfObjectives: 1,
      levelShift: 2,
      levelShiftDistribution: [100, 0]
    }),
    rng: createSeededRng("level-shift-short")
  });
  const longShiftObjective = generateNextDrill(objectives, {
    currentArea: "BP",
    usedObjectiveIds: [],
    history: [],
    sessionId: "level-shift-long",
    drillSettings: buildSessionConfig("BP", {
      numberOfObjectives: 1,
      levelShift: 2,
      levelShiftDistribution: [0, 100]
    }),
    rng: createSeededRng("level-shift-long")
  });

  assert.equal(shortShiftObjective?.id, "kogane_shift_1");
  assert.equal(longShiftObjective?.id, "kogane_shift_2");
});

test("generateNextDrill recovery picks a legal candidate when strict bucket selection fails", () => {
  const objectives = [
    {
      id: "kogane_recovery_shift_1",
      area: "Sewers",
      district: "Kogane",
      type: "default",
      runClass: "short"
    }
  ];

  const objective = generateNextDrill(objectives, {
    currentArea: "BP",
    usedObjectiveIds: [],
    history: [],
    sessionId: "recovery-level-shift",
    drillSettings: buildSessionConfig("BP", {
      numberOfObjectives: 1,
      levelShift: 2,
      districtShift: -2,
      levelShiftDistribution: [0, 100]
    }),
    rng: createSeededRng("recovery-level-shift")
  });

  assert.equal(objective?.id, "kogane_recovery_shift_1");
});

test("generateNextDrill recovery still respects used objective exclusion", () => {
  const objectives = [
    {
      id: "kogane_used_shift_1",
      area: "Sewers",
      district: "Kogane",
      type: "default",
      runClass: "short"
    },
    {
      id: "kogane_unused_shift_2",
      area: "RDH",
      district: "Kogane",
      type: "default",
      runClass: "short"
    }
  ];

  const objective = generateNextDrill(objectives, {
    currentArea: "BP",
    usedObjectiveIds: ["kogane_used_shift_1"],
    history: [],
    sessionId: "recovery-used-objective",
    drillSettings: buildSessionConfig("BP", {
      numberOfObjectives: 2,
      levelShift: 2,
      districtShift: -2,
      levelShiftDistribution: [100, 0]
    }),
    rng: createSeededRng("recovery-used-objective")
  });

  assert.equal(objective?.id, "kogane_unused_shift_2");
});

test("generateNextDrill recovery does not bypass unlock locality", () => {
  const objectives = [
    {
      id: "illegal_cross_district_unlock",
      area: "RDH",
      district: "Kogane",
      type: "unlock",
      runClass: "short"
    }
  ];

  const objective = generateNextDrill(objectives, {
    currentArea: "Dogen",
    usedObjectiveIds: [],
    history: [],
    sessionId: "recovery-unlock-locality",
    drillSettings: buildSessionConfig("Dogen", {
      numberOfObjectives: 1,
      graffitiVariance: -3,
      unlockVariance: 2,
      defaultVariance: -3,
      notebookVariance: -3,
      trueRandom: false
    }),
    rng: createSeededRng("recovery-unlock-locality")
  });

  assert.equal(objective, null);
});

test("generateNextDrill recovery still respects category restrictions", () => {
  const objectives = [
    {
      id: "graffiti_recovery_target",
      area: "Sewers",
      district: "Kogane",
      type: "graffiti",
      runClass: "short"
    },
    {
      id: "default_recovery_blocked",
      area: "RDH",
      district: "Kogane",
      type: "default",
      runClass: "short"
    }
  ];

  const objective = generateNextDrill(objectives, {
    currentArea: "BP",
    usedObjectiveIds: [],
    history: [],
    sessionId: "recovery-category-restriction",
    drillSettings: buildSessionConfig("BP", {
      numberOfObjectives: 1,
      graffitiVariance: 2,
      unlockVariance: -3,
      defaultVariance: -3,
      notebookVariance: -3,
      levelShift: 2,
      districtShift: -2,
      levelShiftDistribution: [0, 100]
    }),
    rng: createSeededRng("recovery-category-restriction")
  });

  assert.equal(objective?.id, "graffiti_recovery_target");
});

test("generateNextDrill keeps strict-path output when strict selection already succeeds", () => {
  const objectives = [
    {
      id: "strict_shift_1",
      area: "Sewers",
      district: "Kogane",
      type: "default",
      runClass: "short"
    },
    {
      id: "strict_shift_2",
      area: "RDH",
      district: "Kogane",
      type: "default",
      runClass: "short"
    }
  ];

  const objective = generateNextDrill(objectives, {
    currentArea: "BP",
    usedObjectiveIds: [],
    history: [],
    sessionId: "strict-path-unchanged",
    drillSettings: buildSessionConfig("BP", {
      numberOfObjectives: 2,
      levelShift: 2,
      districtShift: -2,
      levelShiftDistribution: [100, 0]
    }),
    rng: createSeededRng("strict-path-unchanged")
  });

  assert.equal(objective?.id, "strict_shift_1");
});
