import test from "node:test";
import assert from "node:assert/strict";

import { objectivesById } from "../data/objectives.js";
import {
  buildSessionCompletionSummary,
  buildSeededSessionState,
  resolveSeededSessionTransition
} from "./session/drillSession.js";
import { getAvailableObjectiveCount } from "./drill/drillSettings.js";
import {
  CORRUPTED_FORMAL_SEED_WARNING,
  LEGACY_SESSION_SEED_PREFIX,
  LEGACY_SESSION_SEED_V2_PREFIX,
  SESSION_SEED_PREFIX,
  buildSessionConfig,
  buildSessionSpecFromConfig,
  buildSessionSpecFromPhrase,
  decodeSessionSeed,
  encodeSessionSeed,
  hashSeedPhrase,
  normalizeSeedPhrase,
  resolveSeedInput
} from "./seed/sessionSeed.js";

function encodeRawSeedPayload(payload) {
  return `${LEGACY_SESSION_SEED_PREFIX}${Buffer.from(JSON.stringify(payload), "utf8")
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

test("exported seeds round-trip canonically", () => {
  const config = buildSessionConfig("Garage", {
    numberOfObjectives: 4,
    excludedAreas: ["Kibo", "Dogen"],
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
  const { exportSeed } = buildSessionSpecFromConfig(
    buildSessionConfig("Garage", {
      numberOfObjectives: 2
    }),
    "00112233445566778899aabbccddeeff"
  );
  const legacyCompactSeed = `${LEGACY_SESSION_SEED_V2_PREFIX}${exportSeed.slice(SESSION_SEED_PREFIX.length)}`;

  assert.deepEqual(decodeSessionSeed(legacyCompactSeed), decodeSessionSeed(exportSeed));
});

test("decodeSessionSeed rejects unsupported versions", () => {
  assert.throws(
    () =>
      decodeSessionSeed(
        encodeRawSeedPayload({
          version: 2,
          rngSeed: "00112233445566778899aabbccddeeff",
          config: buildSessionConfig("Garage", {
            numberOfObjectives: 1
          }),
          objectiveIds: ["shibuya_scratch_1"]
        })
      ),
    /Unsupported seed version/
  );
});

test("decodeSessionSeed still accepts legacy JSON seeds", () => {
  const legacySeed = encodeRawSeedPayload({
    version: 1,
    rngSeed: "00112233445566778899aabbccddeeff",
    config: buildSessionConfig("Garage", {
      numberOfObjectives: 1
    }),
    objectiveIds: ["dogen_005"]
  });

  assert.deepEqual(decodeSessionSeed(legacySeed), {
    version: 2,
    rngSeed: "00112233445566778899aabbccddeeff",
    config: buildSessionConfig("Garage", {
      numberOfObjectives: 1
    }),
    objectiveIds: ["dogen_005"]
  });
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


