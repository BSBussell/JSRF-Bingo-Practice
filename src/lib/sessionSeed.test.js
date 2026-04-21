import test from "node:test";
import assert from "node:assert/strict";

import { areaOrder, objectiveAreaOrder } from "../data/areaMeta.js";
import { allObjectives } from "../data/objectives.js";
import { objectivesById } from "../data/objectives.js";
import {
  buildSessionCompletionSummary,
  buildSeededSessionState,
  resolveSeededSessionTransition
} from "./session/drillSession.js";
import { getAvailableObjectiveCount } from "./drill/drillSettings.js";
import {
  CORRUPTED_FORMAL_SEED_WARNING,
  LEGACY_COMPACT_SESSION_SEED_PREFIX,
  LEGACY_SESSION_SEED_V2_PREFIX,
  PRACTICE_SEED_IN_ROUTE_WARNING,
  ROUTE_SEED_IN_PRACTICE_WARNING,
  SESSION_SEED_PREFIX,
  buildSessionConfig,
  buildSessionSpecFromObjectiveIds,
  buildSessionSpecFromConfig,
  buildSessionSpecFromPhrase,
  decodeSessionSeed,
  encodeSessionSeed,
  hashSeedPhrase,
  normalizeSeedPhrase,
  resolveSeedInput
} from "./seed/sessionSeed.js";
import { ROUTE_REVEAL_MODE_BURST } from "./session/routeRevealMode.js";

function encodeLegacyCompactSeed(sessionSpec, prefix) {
  const excludedMask = objectiveAreaOrder.reduce(
    (mask, area, index) =>
      sessionSpec.config.excludedAreas.includes(area) ? mask | (1 << index) : mask,
    0
  );
  const fields = [
    { bits: 4, value: areaOrder.indexOf(sessionSpec.config.startingArea) },
    { bits: 8, value: sessionSpec.config.numberOfObjectives },
    { bits: objectiveAreaOrder.length, value: excludedMask },
    { bits: 3, value: sessionSpec.config.graffitiVariance + 3 },
    { bits: 3, value: sessionSpec.config.unlockVariance + 3 },
    { bits: 3, value: sessionSpec.config.defaultVariance + 3 },
    { bits: 3, value: sessionSpec.config.notebookVariance + 3 },
    { bits: 3, value: sessionSpec.config.levelShift + 2 },
    { bits: 3, value: sessionSpec.config.districtShift + 2 },
    { bits: 1, value: sessionSpec.config.trueRandom ? 1 : 0 }
  ];
  const totalBits = fields.reduce((sum, field) => sum + field.bits, 0);
  const paddingBits = 48 - totalBits;
  let packedValue = 0n;

  for (const field of fields) {
    packedValue = (packedValue << BigInt(field.bits)) | BigInt(field.value);
  }

  const configBytes = Buffer.alloc(6);
  let remaining = packedValue << BigInt(paddingBits);
  for (let index = 5; index >= 0; index -= 1) {
    configBytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  const rngBytes = Buffer.from(sessionSpec.rngSeed, "hex");
  const objectiveIndexBytes = Buffer.from(
    sessionSpec.objectiveIds.map((objectiveId) =>
      allObjectives.findIndex((objective) => objective.id === objectiveId)
    )
  );

  return `${prefix}${Buffer.concat([rngBytes, configBytes, objectiveIndexBytes])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;
}

test("normalizeSeedPhrase applies stable trimming, line-ending normalization, NFKC, and lowercase", () => {
  assert.equal(normalizeSeedPhrase("  ＪＥＴ\r\nSET Radio  "), "jet\nset radio");
});

test("hashSeedPhrase is case-insensitive after normalization", () => {
  assert.equal(
    hashSeedPhrase("I love jet set radio"),
    hashSeedPhrase("  i LOVE JET SET RADIO  ")
  );
});

test("phrase seeds are deterministic and exported seeds replay the same session", () => {
  const phraseSession = buildSessionSpecFromPhrase("I love jet set radio");
  const samePhraseSession = buildSessionSpecFromPhrase("  i LOVE jet set radio  ");
  const decodedExport = decodeSessionSeed(phraseSession.exportSeed);

  assert.deepEqual(phraseSession.sessionSpec.config, samePhraseSession.sessionSpec.config);
  assert.deepEqual(phraseSession.sessionSpec.objectiveIds, samePhraseSession.sessionSpec.objectiveIds);
  assert.deepEqual(decodedExport, phraseSession.sessionSpec);
  assert.equal(phraseSession.sessionSpec.config.trueRandom, false);
});

test("route phrase seeds are deterministic and preserve route session type", () => {
  const phraseSession = buildSessionSpecFromPhrase("route me up", "route");
  const decodedExport = decodeSessionSeed(phraseSession.exportSeed);

  assert.equal(phraseSession.sessionSpec.sessionType, "route");
  assert.equal(decodedExport.sessionType, "route");
  assert.equal(decodedExport.config.routeVisibleCount, phraseSession.sessionSpec.config.routeVisibleCount);
  assert.equal(decodedExport.config.routeRevealMode, phraseSession.sessionSpec.config.routeRevealMode);
});

test("phrase seeds derive route visible count from the phrase", () => {
  const firstPhraseSession = buildSessionSpecFromPhrase("route me up", "route");
  const samePhraseSession = buildSessionSpecFromPhrase("  ROUTE me up  ", "route");
  const differentPhraseSession = buildSessionSpecFromPhrase("I love jet set radio", "route");

  assert.equal(
    firstPhraseSession.sessionSpec.config.routeVisibleCount,
    samePhraseSession.sessionSpec.config.routeVisibleCount
  );
  assert.notEqual(
    firstPhraseSession.sessionSpec.config.routeVisibleCount,
    differentPhraseSession.sessionSpec.config.routeVisibleCount
  );
});

test("route session specs keep objective count at least visible square count", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 1,
      routeVisibleCount: 10
    }),
    "00112233445566778899aabbccddeeff",
    "route"
  );

  assert.equal(sessionSpec.config.routeVisibleCount, 10);
  assert.equal(sessionSpec.config.numberOfObjectives, 10);
});

test("explicit objective seeds round-trip a one-square practice session", () => {
  const { sessionSpec, exportSeed } = buildSessionSpecFromObjectiveIds(
    ["dogen_graffiti"],
    {
      startingArea: "Dogen",
      numberOfObjectives: 25
    },
    "00112233445566778899aabbccddeeff"
  );
  const decoded = decodeSessionSeed(exportSeed);

  assert.equal(sessionSpec.sessionType, "practice");
  assert.equal(sessionSpec.config.startingArea, "Dogen");
  assert.equal(sessionSpec.config.numberOfObjectives, 1);
  assert.deepEqual(sessionSpec.objectiveIds, ["dogen_graffiti"]);
  assert.deepEqual(decoded, sessionSpec);
});

test("explicit objective seeds reject unknown objective ids", () => {
  assert.throws(
    () =>
      buildSessionSpecFromObjectiveIds(
        ["not_real"],
        {
          startingArea: "Dogen"
        },
        "00112233445566778899aabbccddeeff"
      ),
    /unknown objective id/
  );
});

test("phrase seeds can use the full available objective pool", () => {
  const phraseSession = buildSessionSpecFromPhrase("route me up", "route");
  const availableObjectives = getAvailableObjectiveCount(phraseSession.sessionSpec.config);

  assert.ok(phraseSession.sessionSpec.config.numberOfObjectives > 40);
  assert.ok(phraseSession.sessionSpec.config.numberOfObjectives <= availableObjectives);
});

test("exported seeds round-trip canonically", () => {
  const config = buildSessionConfig("Garage", {
    numberOfObjectives: 4,
    excludedAreas: ["Kibo", "Dogen"],
    levelShiftDistribution: [35, 65],
    districtJumpDistribution: [50, 30, 20],
    trueRandom: false
  });
  const { sessionSpec, exportSeed } = buildSessionSpecFromConfig(
    config,
    "00112233445566778899aabbccddeeff"
  );

  assert.equal(encodeSessionSeed(decodeSessionSeed(exportSeed)), exportSeed);
  assert.deepEqual(decodeSessionSeed(exportSeed), sessionSpec);
  assert.ok(exportSeed.startsWith(SESSION_SEED_PREFIX));
  assert.ok(exportSeed.length < 100);
});

test("decodeSessionSeed accepts legacy compact JSRF v2 seeds", () => {
  const { sessionSpec, exportSeed } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 2
    }),
    "00112233445566778899aabbccddeeff"
  );
  const legacyCompactSeed = encodeLegacyCompactSeed(sessionSpec, LEGACY_SESSION_SEED_V2_PREFIX);

  assert.deepEqual(decodeSessionSeed(legacyCompactSeed), decodeSessionSeed(exportSeed));
});

test("decodeSessionSeed accepts legacy compact BNGSD2 seeds", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 2
    }),
    "00112233445566778899aabbccddeeff"
  );
  const legacyCompactSeed = encodeLegacyCompactSeed(sessionSpec, LEGACY_COMPACT_SESSION_SEED_PREFIX);

  assert.equal(decodeSessionSeed(legacyCompactSeed).sessionType, "practice");
});

test("decodeSessionSeed rejects legacy JSON v1 seeds", () => {
  const legacyJsonSeed = `JSRFD1.${Buffer.from(
    JSON.stringify({
      version: 1,
      rngSeed: "00112233445566778899aabbccddeeff",
      config: buildSessionConfig("Garage", {
        numberOfObjectives: 1
      }),
      objectiveIds: ["dogen_005"]
    }),
    "utf8"
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;

  assert.throws(() => decodeSessionSeed(legacyJsonSeed), /not a supported exported drill seed/);
});

test("decodeSessionSeed rejects malformed payloads", () => {
  assert.throws(() => decodeSessionSeed(`${SESSION_SEED_PREFIX}not-valid-json`), /decoded/);
});

test("resolveSeedInput warns and deterministically falls back when a formal seed is corrupted", () => {
  const seedState = resolveSeedInput(`${SESSION_SEED_PREFIX}this-is-broken`);

  assert.equal(seedState.mode, "phrase");
  assert.equal(seedState.warning, CORRUPTED_FORMAL_SEED_WARNING);
  assert.ok(seedState.sessionSpec);
  assert.ok(seedState.exportSeed.startsWith(SESSION_SEED_PREFIX));
});

test("resolveSeedInput warns when a route seed is entered on the practice setup", () => {
  const routeSeedState = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 4,
      routeVisibleCount: 6,
      routeRevealMode: ROUTE_REVEAL_MODE_BURST
    }),
    "00112233445566778899aabbccddeeff",
    "route"
  );

  const seedState = resolveSeedInput(routeSeedState.exportSeed, "practice");

  assert.equal(seedState.mode, "exported");
  assert.equal(seedState.sessionSpec.sessionType, "practice");
  assert.deepEqual(seedState.sessionSpec.objectiveIds, routeSeedState.sessionSpec.objectiveIds);
  assert.equal(seedState.warning, ROUTE_SEED_IN_PRACTICE_WARNING);
  assert.equal(decodeSessionSeed(seedState.exportSeed).sessionType, "practice");
});

test("resolveSeedInput warns when a practice seed is entered on the route setup", () => {
  const practiceSeedState = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 4
    }),
    "00112233445566778899aabbccddeeff",
    "practice"
  );

  const seedState = resolveSeedInput(practiceSeedState.exportSeed, "route");

  assert.equal(seedState.mode, "exported");
  assert.equal(seedState.sessionSpec.sessionType, "route");
  assert.deepEqual(seedState.sessionSpec.objectiveIds, practiceSeedState.sessionSpec.objectiveIds);
  assert.equal(
    seedState.sessionSpec.config.numberOfObjectives,
    practiceSeedState.sessionSpec.objectiveIds.length
  );
  assert.equal(seedState.warning, PRACTICE_SEED_IN_ROUTE_WARNING);
  assert.equal(decodeSessionSeed(seedState.exportSeed).sessionType, "route");
});

test("resolveSeedInput does not warn when a route seed is entered on the route setup", () => {
  const { exportSeed } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 4,
      routeVisibleCount: 6,
      routeRevealMode: ROUTE_REVEAL_MODE_BURST
    }),
    "00112233445566778899aabbccddeeff",
    "route"
  );

  const seedState = resolveSeedInput(exportSeed, "route");

  assert.equal(seedState.mode, "exported");
  assert.equal(seedState.warning, "");
});

test("route exported seeds round-trip canonically", () => {
  const config = buildSessionConfig("Garage", {
    numberOfObjectives: 4,
    routeVisibleCount: 6,
    routeRevealMode: ROUTE_REVEAL_MODE_BURST,
    levelShiftDistribution: [25, 75],
    districtJumpDistribution: [50, 30, 20],
    excludedAreas: ["Kibo"],
    trueRandom: false
  });
  const { sessionSpec, exportSeed } = buildSessionSpecFromConfig(
    config,
    "00112233445566778899aabbccddeeff",
    "route"
  );

  assert.equal(sessionSpec.sessionType, "route");
  assert.ok(sessionSpec.config.numberOfObjectives >= sessionSpec.config.routeVisibleCount);
  assert.equal(sessionSpec.config.routeRevealMode, ROUTE_REVEAL_MODE_BURST);
  assert.equal(encodeSessionSeed(decodeSessionSeed(exportSeed)), exportSeed);
  assert.deepEqual(decodeSessionSeed(exportSeed), sessionSpec);
});

test("encodeSessionSeed rejects objective counts that exceed serialization bounds", () => {
  const config = {
    ...buildSessionConfig("Garage", {
      numberOfObjectives: 1
    }),
    numberOfObjectives: 256
  };
  const objectiveIds = Array.from({ length: 256 }, () => "dogen_005");

  assert.throws(
    () =>
      encodeSessionSeed({
        version: 2,
        rngSeed: "00112233445566778899aabbccddeeff",
        config,
        objectiveIds
      }),
    /cannot encode more than 255 objectives/
  );
});


test("buildSessionConfig caps objective count to available pool after exclusions and none-variance", () => {
  const requestedObjectives = 999;
  const config = buildSessionConfig("Garage", {
    numberOfObjectives: requestedObjectives,
    excludedAreas: ["99th", "Kibo", "Dogen", "Skyscraper", "Pharaoh Park"],
    graffitiVariance: -3,
    unlockVariance: -3,
    defaultVariance: -3,
    notebookVariance: 0,
    trueRandom: false
  });

  const availableObjectives = getAvailableObjectiveCount(config);
  assert.equal(config.numberOfObjectives, availableObjectives);
  assert.ok(config.numberOfObjectives < requestedObjectives);
});
test("seeded session specs honor numberOfObjectives", () => {
  const config = buildSessionConfig("Shibuya", {
    numberOfObjectives: 3,
    excludedAreas: [],
    trueRandom: false
  });
  const { sessionSpec } = buildSessionSpecFromConfig(
    config,
    "cafebabedeadbeef0011223344556677"
  );

  assert.equal(sessionSpec.objectiveIds.length, 3);
});

test("buildSessionSpecFromConfig recovers seeded pre-generation when strict selection would dead-end", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Dogen", {
      numberOfObjectives: 58,
      excludedAreas: [],
      graffitiVariance: 0,
      unlockVariance: 0,
      defaultVariance: 0,
      notebookVariance: -3,
      levelShift: 2,
      districtShift: 1,
      levelShiftDistribution: [63, 37],
      districtJumpDistribution: [43, 57, 0],
      trueRandom: false
    }),
    "0000000000000000000000000000000a"
  );

  assert.equal(sessionSpec.objectiveIds.length, 58);
  assert.equal(new Set(sessionSpec.objectiveIds).size, 58);
});

test("buildSessionSpecFromConfig still fails for truly impossible seeded configs", () => {
  assert.throws(
    () =>
      buildSessionSpecFromConfig(
        buildSessionConfig("Garage", {
          numberOfObjectives: 25,
          graffitiVariance: -3,
          unlockVariance: 2,
          defaultVariance: -3,
          notebookVariance: -3,
          trueRandom: false
        }),
        "0000000000000000000000000000000b"
      ),
    /could not generate the requested objective sequence/
  );
});

test("seeded session progression consumes the precomputed objective list without regeneration", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 3,
      excludedAreas: [],
      trueRandom: false
    }),
    "0123456789abcdeffedcba9876543210"
  );
  const firstObjective = objectivesById[sessionSpec.objectiveIds[0]];
  const session = buildSeededSessionState({
    sessionId: "session_test",
    now: 1000,
    currentArea: sessionSpec.config.startingArea,
    objective: firstObjective,
    currentObjectiveIndex: 0,
    sessionSpec,
    exportSeed: encodeSessionSeed(sessionSpec)
  });

  const completeTransition = resolveSeededSessionTransition({
    session,
    currentObjective: firstObjective,
    result: "complete",
    endedAt: 2000,
    objectiveLookup: (objectiveId) => objectivesById[objectiveId]
  });
  const skipTransition = resolveSeededSessionTransition({
    session,
    currentObjective: firstObjective,
    result: "skip",
    endedAt: 2000,
    objectiveLookup: (objectiveId) => objectivesById[objectiveId]
  });

  assert.equal(completeTransition.nextObjectiveId, sessionSpec.objectiveIds[1]);
  assert.equal(skipTransition.nextObjectiveId, sessionSpec.objectiveIds[1]);
  assert.equal(skipTransition.nextArea, session.currentArea);
  assert.equal(completeTransition.nextArea, firstObjective.area);
});

test("completion summaries use session-level timing", () => {
  const { sessionSpec } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 1
    }),
    "fedcba98765432100123456789abcdef"
  );
  const session = buildSeededSessionState({
    sessionId: "session_complete",
    now: 500,
    currentArea: sessionSpec.config.startingArea,
    objective: objectivesById[sessionSpec.objectiveIds[0]],
    currentObjectiveIndex: 0,
    sessionSpec,
    exportSeed: encodeSessionSeed(sessionSpec),
    sessionStartedAt: 500,
    sessionTotalPausedMs: 250
  });

  assert.deepEqual(buildSessionCompletionSummary({ session, endedAt: 2750 }), {
    sessionId: "session_complete",
    finishedAt: 2750,
    exportSeed: encodeSessionSeed(sessionSpec),
    objectiveCount: 1,
    totalDurationMs: 2000
  });
});
