import { areaOrder, objectiveAreaOrder } from "../../data/areaMeta.js";
import { allObjectives } from "../../data/objectives.js";
import { generateNextDrill } from "../drill/drillGenerator.js";
import {
  DISTRICT_JUMP_DISTRIBUTION_TOTAL,
  CATEGORY_VARIANCE_MAX,
  CATEGORY_VARIANCE_MIN,
  DEFAULT_DRILL_SETTINGS,
  DEFAULT_DISTRICT_JUMP_DISTRIBUTION,
  DEFAULT_LEVEL_SHIFT_DISTRIBUTION,
  LEVEL_SHIFT_DISTRIBUTION_TOTAL,
  MOVEMENT_VARIANCE_MAX,
  MOVEMENT_VARIANCE_MIN,
  ROUTE_VISIBLE_COUNT_MAX,
  ROUTE_VISIBLE_COUNT_MIN,
  buildDistrictJumpBoundaries,
  buildDistrictJumpDistributionFromBoundaries,
  buildLevelShiftBoundaries,
  buildLevelShiftDistributionFromBoundaries,
  getAvailableObjectiveCount
} from "../drill/drillSettings.js";
import {
  buildSessionConfig,
  normalizeSessionConfig,
  normalizeSessionConfigForType
} from "../session/sessionConfig.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE,
  normalizeSessionType
} from "../session/sessionTypes.js";
import {
  DEFAULT_ROUTE_REVEAL_MODE,
  ROUTE_REVEAL_MODE_BURST,
  normalizeRouteRevealMode
} from "../session/routeRevealMode.js";

export { buildSessionConfig, normalizeSessionConfig } from "../session/sessionConfig.js";

export const SESSION_SEED_PREFIX = "BNGSD3.";
export const LEGACY_SESSION_SEED_V2_PREFIX = "JSRFD2.";
export const LEGACY_COMPACT_SESSION_SEED_PREFIX = "BNGSD2.";
export const SESSION_SEED_VERSION = 3;
export const PHRASE_OBJECTIVE_MIN = 1;
export const CORRUPTED_FORMAL_SEED_WARNING =
  "This looks like a formal seed, but parts of it appear corrupted. It'll read it as-is, but double-check the source if this wasn't expected.";
export const ROUTE_SEED_IN_PRACTICE_WARNING =
  "This seed was exported from Route Mode. Practice mode will ignore route-specific settings.";
export const PRACTICE_SEED_IN_ROUTE_WARNING =
  "This seed was exported from Practice Mode. Route mode will convert it into a route while preserving the square order.";

const OBJECTIVE_INDEX_BY_ID = Object.fromEntries(
  allObjectives.map((objective, index) => [objective.id, index])
);
const SEED_RNG_BYTES = 16;
const MAX_SEQUENCE_GENERATION_ATTEMPTS = 64;
const PACKED_CONFIG_BYTES = 9;
const PACKED_CONFIG_BITS = 71;
const LEGACY_PACKED_CONFIG_BYTES = 6;
const LEGACY_PACKED_CONFIG_BITS = 44;
const MAX_SERIALIZED_OBJECTIVE_COUNT = 255;
const MAX_SERIALIZED_OBJECTIVE_INDEX = 255;

function encodeUtf8(value) {
  return new TextEncoder().encode(value);
}

function bytesToBigInt(bytes) {
  let value = 0n;

  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  return value;
}

function bigIntToBytes(value, byteCount) {
  const bytes = new Uint8Array(byteCount);
  let remaining = value;

  for (let index = byteCount - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return bytes;
}

function hexToBytes(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{32}$/i.test(value)) {
    throw new Error("Seed payload is missing a valid RNG seed.");
  }

  return Uint8Array.from(
    value.match(/.{2}/g) ?? [],
    (segment) => Number.parseInt(segment, 16)
  );
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function concatenateBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function mixHashState(state, byte) {
  let nextState = (state ^ byte) >>> 0;
  nextState = Math.imul(nextState, 0x01000193) >>> 0;
  nextState ^= nextState >>> 13;
  nextState = Math.imul(nextState, 0x85ebca6b) >>> 0;
  nextState ^= nextState >>> 16;
  return nextState >>> 0;
}

function hashBytesToSeed(bytes) {
  let stateA = 0x811c9dc5;
  let stateB = 0x9e3779b9;
  let stateC = 0x243f6a88;
  let stateD = 0xb7e15162;

  for (const byte of bytes) {
    stateA = mixHashState(stateA, byte);
    stateB = mixHashState(stateB, byte ^ 0x5a);
    stateC = mixHashState(stateC, byte ^ 0xa5);
    stateD = mixHashState(stateD, byte ^ 0x3c);
  }

  return [stateA, stateB, stateC, stateD]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
}

function createSeedState(seed) {
  const normalizedSeed = String(seed ?? "");
  const segments =
    /^[0-9a-f]{32}$/i.test(normalizedSeed)
      ? normalizedSeed.match(/.{8}/g)?.map((segment) => Number.parseInt(segment, 16)) ?? []
      : [];

  if (segments.length === 4) {
    return segments.map((value, index) =>
      value === 0 ? ((index + 1) * 0x9e3779b9) >>> 0 : value >>> 0
    );
  }

  const bytes = encodeUtf8(normalizedSeed);
  return hashBytesToSeed(bytes)
    .match(/.{8}/g)
    .map((segment, index) => {
      const value = Number.parseInt(segment, 16);
      return value === 0 ? ((index + 1) * 0x9e3779b9) >>> 0 : value >>> 0;
    });
}

function base64UrlEncode(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalizedValue.length % 4 || 4)) % 4;
  const paddedValue = `${normalizedValue}${"=".repeat(padding)}`;

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(paddedValue, "base64"));
  }

  const binary = atob(paddedValue);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomInteger(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffleWithRng(items, rng) {
  const nextItems = items.slice();

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const temporary = nextItems[index];
    nextItems[index] = nextItems[swapIndex];
    nextItems[swapIndex] = temporary;
  }

  return nextItems;
}

function createSessionSeedPayload({
  rngSeed,
  config,
  objectiveIds,
  sessionType = PRACTICE_SESSION_TYPE
}) {
  return {
    version: SESSION_SEED_VERSION,
    sessionType: normalizeSessionType(sessionType),
    rngSeed,
    config: normalizeSessionConfig(config),
    objectiveIds: objectiveIds.slice()
  };
}

function packConfig(configInput, sessionType) {
  const config = normalizeSessionConfig(configInput);
  if (config.numberOfObjectives > MAX_SERIALIZED_OBJECTIVE_COUNT) {
    throw new Error(
      `Seed payload cannot encode more than ${MAX_SERIALIZED_OBJECTIVE_COUNT} objectives.`
    );
  }

  const excludedMask = objectiveAreaOrder.reduce(
    (mask, area, index) =>
      config.excludedAreas.includes(area) ? mask | (1 << index) : mask,
    0
  );
  const startAreaIndex = areaOrder.indexOf(config.startingArea);
  const levelShiftBoundaries = buildLevelShiftBoundaries(config.levelShiftDistribution);
  const districtJumpBoundaries = buildDistrictJumpBoundaries(config.districtJumpDistribution);
  const fields = [
    { bits: 4, value: startAreaIndex },
    { bits: 8, value: config.numberOfObjectives },
    { bits: objectiveAreaOrder.length, value: excludedMask },
    { bits: 3, value: config.graffitiVariance - CATEGORY_VARIANCE_MIN },
    { bits: 3, value: config.unlockVariance - CATEGORY_VARIANCE_MIN },
    { bits: 3, value: config.defaultVariance - CATEGORY_VARIANCE_MIN },
    { bits: 3, value: config.notebookVariance - CATEGORY_VARIANCE_MIN },
    { bits: 3, value: config.levelShift - MOVEMENT_VARIANCE_MIN },
    { bits: 3, value: config.districtShift - MOVEMENT_VARIANCE_MIN },
    { bits: 1, value: config.trueRandom ? 1 : 0 },
    { bits: 1, value: normalizeSessionType(sessionType) === ROUTE_SESSION_TYPE ? 1 : 0 },
    { bits: 4, value: config.routeVisibleCount - 1 },
    { bits: 1, value: normalizeRouteRevealMode(config.routeRevealMode) === ROUTE_REVEAL_MODE_BURST ? 1 : 0 },
    { bits: 7, value: levelShiftBoundaries[0] },
    { bits: 7, value: districtJumpBoundaries[0] },
    { bits: 7, value: districtJumpBoundaries[1] }
  ];
  const totalBits = fields.reduce((sum, field) => sum + field.bits, 0);
  const paddingBits = PACKED_CONFIG_BYTES * 8 - totalBits;
  let packedValue = 0n;

  for (const field of fields) {
    packedValue = (packedValue << BigInt(field.bits)) | BigInt(field.value);
  }

  return bigIntToBytes(packedValue << BigInt(paddingBits), PACKED_CONFIG_BYTES);
}

function unpackConfig(bytes) {
  if (bytes.length !== PACKED_CONFIG_BYTES) {
    throw new Error("Seed payload config block is malformed.");
  }

  const paddingBits = PACKED_CONFIG_BYTES * 8 - PACKED_CONFIG_BITS;
  const packedValue = bytesToBigInt(bytes) >> BigInt(paddingBits);
  const fields = [
    { key: "startingAreaIndex", bits: 4 },
    { key: "numberOfObjectives", bits: 8 },
    { key: "excludedMask", bits: objectiveAreaOrder.length },
    { key: "graffitiVariance", bits: 3 },
    { key: "unlockVariance", bits: 3 },
    { key: "defaultVariance", bits: 3 },
    { key: "notebookVariance", bits: 3 },
    { key: "levelShift", bits: 3 },
    { key: "districtShift", bits: 3 },
    { key: "trueRandom", bits: 1 },
    { key: "sessionType", bits: 1 },
    { key: "routeVisibleCount", bits: 4 },
    { key: "routeRevealMode", bits: 1 },
    { key: "levelShiftBoundary0", bits: 7 },
    { key: "districtJumpBoundary0", bits: 7 },
    { key: "districtJumpBoundary1", bits: 7 }
  ];
  const decodedFields = {};
  let remainingBits = PACKED_CONFIG_BITS;

  for (const field of fields) {
    remainingBits -= field.bits;
    decodedFields[field.key] = Number(
      (packedValue >> BigInt(remainingBits)) & ((1n << BigInt(field.bits)) - 1n)
    );
  }

  if (!areaOrder[decodedFields.startingAreaIndex]) {
    throw new Error("Seed payload starting area is invalid.");
  }

  const excludedAreas = objectiveAreaOrder.filter(
    (_, index) => (decodedFields.excludedMask & (1 << index)) !== 0
  );

  return {
    sessionType: decodedFields.sessionType === 1 ? ROUTE_SESSION_TYPE : PRACTICE_SESSION_TYPE,
    config: normalizeSessionConfig({
      startingArea: areaOrder[decodedFields.startingAreaIndex],
      numberOfObjectives: decodedFields.numberOfObjectives,
      excludedAreas,
      graffitiVariance: decodedFields.graffitiVariance + CATEGORY_VARIANCE_MIN,
      unlockVariance: decodedFields.unlockVariance + CATEGORY_VARIANCE_MIN,
      defaultVariance: decodedFields.defaultVariance + CATEGORY_VARIANCE_MIN,
      notebookVariance: decodedFields.notebookVariance + CATEGORY_VARIANCE_MIN,
      levelShift: decodedFields.levelShift + MOVEMENT_VARIANCE_MIN,
      districtShift: decodedFields.districtShift + MOVEMENT_VARIANCE_MIN,
      trueRandom: Boolean(decodedFields.trueRandom),
      routeVisibleCount: decodedFields.routeVisibleCount + 1,
      routeRevealMode:
        decodedFields.routeRevealMode === 1
          ? ROUTE_REVEAL_MODE_BURST
          : DEFAULT_ROUTE_REVEAL_MODE,
      levelShiftDistribution: buildLevelShiftDistributionFromBoundaries([
        decodedFields.levelShiftBoundary0
      ]),
      districtJumpDistribution: buildDistrictJumpDistributionFromBoundaries([
        decodedFields.districtJumpBoundary0,
        decodedFields.districtJumpBoundary1
      ])
    })
  };
}

function unpackLegacyConfig(bytes) {
  if (bytes.length !== LEGACY_PACKED_CONFIG_BYTES) {
    throw new Error("Seed payload config block is malformed.");
  }

  const paddingBits = LEGACY_PACKED_CONFIG_BYTES * 8 - LEGACY_PACKED_CONFIG_BITS;
  const packedValue = bytesToBigInt(bytes) >> BigInt(paddingBits);
  const fields = [
    { key: "startingAreaIndex", bits: 4 },
    { key: "numberOfObjectives", bits: 8 },
    { key: "excludedMask", bits: objectiveAreaOrder.length },
    { key: "graffitiVariance", bits: 3 },
    { key: "unlockVariance", bits: 3 },
    { key: "defaultVariance", bits: 3 },
    { key: "notebookVariance", bits: 3 },
    { key: "levelShift", bits: 3 },
    { key: "districtShift", bits: 3 },
    { key: "trueRandom", bits: 1 }
  ];
  const decodedFields = {};
  let remainingBits = LEGACY_PACKED_CONFIG_BITS;

  for (const field of fields) {
    remainingBits -= field.bits;
    decodedFields[field.key] = Number(
      (packedValue >> BigInt(remainingBits)) & ((1n << BigInt(field.bits)) - 1n)
    );
  }

  if (!areaOrder[decodedFields.startingAreaIndex]) {
    throw new Error("Seed payload starting area is invalid.");
  }

  const excludedAreas = objectiveAreaOrder.filter(
    (_, index) => (decodedFields.excludedMask & (1 << index)) !== 0
  );

  return {
    sessionType: PRACTICE_SESSION_TYPE,
    config: normalizeSessionConfig({
      startingArea: areaOrder[decodedFields.startingAreaIndex],
      numberOfObjectives: decodedFields.numberOfObjectives,
      excludedAreas,
      graffitiVariance: decodedFields.graffitiVariance + CATEGORY_VARIANCE_MIN,
      unlockVariance: decodedFields.unlockVariance + CATEGORY_VARIANCE_MIN,
      defaultVariance: decodedFields.defaultVariance + CATEGORY_VARIANCE_MIN,
      notebookVariance: decodedFields.notebookVariance + CATEGORY_VARIANCE_MIN,
      levelShift: decodedFields.levelShift + MOVEMENT_VARIANCE_MIN,
      districtShift: decodedFields.districtShift + MOVEMENT_VARIANCE_MIN,
      trueRandom: Boolean(decodedFields.trueRandom),
      routeVisibleCount: DEFAULT_DRILL_SETTINGS.routeVisibleCount,
      routeRevealMode: DEFAULT_ROUTE_REVEAL_MODE,
      levelShiftDistribution: DEFAULT_LEVEL_SHIFT_DISTRIBUTION,
      districtJumpDistribution: DEFAULT_DISTRICT_JUMP_DISTRIBUTION
    })
  };
}

function encodeCompactSessionSeedPayload(sessionSpecInput) {
  const sessionSpec = createSessionSeedPayload(sessionSpecInput);
  if (sessionSpec.objectiveIds.length > MAX_SERIALIZED_OBJECTIVE_COUNT) {
    throw new Error(
      `Seed payload cannot encode more than ${MAX_SERIALIZED_OBJECTIVE_COUNT} objectives.`
    );
  }

  if (sessionSpec.objectiveIds.length !== sessionSpec.config.numberOfObjectives) {
    throw new Error("Seed payload objective list does not match the stored objective count.");
  }

  const rngBytes = hexToBytes(sessionSpec.rngSeed);
  const configBytes = packConfig(sessionSpec.config, sessionSpec.sessionType);
  const objectiveIndexBytes = Uint8Array.from(
    sessionSpec.objectiveIds.map((objectiveId) => {
      const objectiveIndex = OBJECTIVE_INDEX_BY_ID[objectiveId];
      if (!Number.isInteger(objectiveIndex)) {
        throw new Error(`Seed payload contains an unknown objective id: ${objectiveId}`);
      }

      if (objectiveIndex > MAX_SERIALIZED_OBJECTIVE_INDEX) {
        throw new Error(
          `Seed payload objective index exceeds ${MAX_SERIALIZED_OBJECTIVE_INDEX}: ${objectiveIndex}`
        );
      }

      return objectiveIndex;
    })
  );

  return base64UrlEncode(concatenateBytes(rngBytes, configBytes, objectiveIndexBytes));
}

function decodeCompactSessionSeed(value) {
  const payloadBytes = base64UrlDecode(value.slice(SESSION_SEED_PREFIX.length));
  if (payloadBytes.length < SEED_RNG_BYTES + PACKED_CONFIG_BYTES) {
    throw new Error("Seed payload could not be decoded.");
  }

  const rngBytes = payloadBytes.slice(0, SEED_RNG_BYTES);
  const configBytes = payloadBytes.slice(SEED_RNG_BYTES, SEED_RNG_BYTES + PACKED_CONFIG_BYTES);
  const { config, sessionType } = unpackConfig(configBytes);
  if (config.numberOfObjectives > MAX_SERIALIZED_OBJECTIVE_COUNT) {
    throw new Error(
      `Seed payload objective count exceeds ${MAX_SERIALIZED_OBJECTIVE_COUNT}: ${config.numberOfObjectives}`
    );
  }

  const expectedLength = SEED_RNG_BYTES + PACKED_CONFIG_BYTES + config.numberOfObjectives;

  if (payloadBytes.length !== expectedLength) {
    throw new Error("Seed payload objective list does not match the stored objective count.");
  }

  const objectiveIds = Array.from(
    payloadBytes.slice(SEED_RNG_BYTES + PACKED_CONFIG_BYTES),
    (objectiveIndex) => {
      if (objectiveIndex > MAX_SERIALIZED_OBJECTIVE_INDEX) {
        throw new Error(
          `Seed payload objective index exceeds ${MAX_SERIALIZED_OBJECTIVE_INDEX}: ${objectiveIndex}`
        );
      }

      const objectiveId = allObjectives[objectiveIndex]?.id ?? null;
      if (!objectiveId) {
        throw new Error(`Seed payload contains an invalid objective index: ${objectiveIndex}`);
      }

      return objectiveId;
    }
  );

  return createSessionSeedPayload({
    rngSeed: bytesToHex(rngBytes),
    config,
    objectiveIds,
    sessionType
  });
}

function decodeLegacyCompactSessionSeed(value, prefixLength) {
  const payloadBytes = base64UrlDecode(value.slice(prefixLength));
  if (payloadBytes.length < SEED_RNG_BYTES + LEGACY_PACKED_CONFIG_BYTES) {
    throw new Error("Seed payload could not be decoded.");
  }

  const rngBytes = payloadBytes.slice(0, SEED_RNG_BYTES);
  const configBytes = payloadBytes.slice(
    SEED_RNG_BYTES,
    SEED_RNG_BYTES + LEGACY_PACKED_CONFIG_BYTES
  );
  const { config, sessionType } = unpackLegacyConfig(configBytes);
  const expectedLength = SEED_RNG_BYTES + LEGACY_PACKED_CONFIG_BYTES + config.numberOfObjectives;

  if (payloadBytes.length !== expectedLength) {
    throw new Error("Seed payload objective list does not match the stored objective count.");
  }

  const objectiveIds = Array.from(
    payloadBytes.slice(SEED_RNG_BYTES + LEGACY_PACKED_CONFIG_BYTES),
    (objectiveIndex) => {
      if (objectiveIndex > MAX_SERIALIZED_OBJECTIVE_INDEX) {
        throw new Error(
          `Seed payload objective index exceeds ${MAX_SERIALIZED_OBJECTIVE_INDEX}: ${objectiveIndex}`
        );
      }

      const objectiveId = allObjectives[objectiveIndex]?.id ?? null;
      if (!objectiveId) {
        throw new Error(`Seed payload contains an invalid objective index: ${objectiveIndex}`);
      }

      return objectiveId;
    }
  );

  return createSessionSeedPayload({
    rngSeed: bytesToHex(rngBytes),
    config,
    objectiveIds,
    sessionType
  });
}

function derivePhraseConfig(seed, sessionType = PRACTICE_SESSION_TYPE) {
  const rng = createSeededRng(deriveChildSeed(seed, "config"));
  const excludedAreas = shuffleWithRng(objectiveAreaOrder, rng).slice(
    0,
    randomInteger(rng, 0, Math.min(4, Math.max(0, objectiveAreaOrder.length - 1)))
  );
  const baseConfig = normalizeSessionConfig({
    excludedAreas,
    graffitiVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    unlockVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    defaultVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    notebookVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    trueRandom: false
  });
  const phraseObjectiveMax = Math.max(
    PHRASE_OBJECTIVE_MIN,
    getAvailableObjectiveCount(baseConfig)
  );
  const levelShiftBoundaries = [randomInteger(rng, 0, LEVEL_SHIFT_DISTRIBUTION_TOTAL)];
  const districtJumpBoundaryA = randomInteger(rng, 0, DISTRICT_JUMP_DISTRIBUTION_TOTAL);
  const districtJumpBoundaryB = randomInteger(rng, 0, DISTRICT_JUMP_DISTRIBUTION_TOTAL);
  const districtJumpBoundaries = [districtJumpBoundaryA, districtJumpBoundaryB].sort(
    (left, right) => left - right
  );

  return normalizeSessionConfigForType({
    startingArea: areaOrder[randomInteger(rng, 0, areaOrder.length - 1)],
    ...baseConfig,
    numberOfObjectives: randomInteger(rng, PHRASE_OBJECTIVE_MIN, phraseObjectiveMax),
    levelShift: randomInteger(rng, MOVEMENT_VARIANCE_MIN, MOVEMENT_VARIANCE_MAX),
    districtShift: randomInteger(rng, MOVEMENT_VARIANCE_MIN, MOVEMENT_VARIANCE_MAX),
    levelShiftDistribution: buildLevelShiftDistributionFromBoundaries(levelShiftBoundaries),
    districtJumpDistribution: buildDistrictJumpDistributionFromBoundaries(districtJumpBoundaries),
    routeVisibleCount: randomInteger(rng, ROUTE_VISIBLE_COUNT_MIN, ROUTE_VISIBLE_COUNT_MAX),
    routeRevealMode: rng() < 0.5 ? DEFAULT_ROUTE_REVEAL_MODE : ROUTE_REVEAL_MODE_BURST
  }, sessionType);
}

function repairPhraseConfig(config) {
  return normalizeSessionConfig({
    ...config,
    excludedAreas: []
  });
}

function createSafePhraseConfig() {
  return normalizeSessionConfig({
    startingArea: "Garage",
    ...DEFAULT_DRILL_SETTINGS
  });
}

export function normalizeSeedPhrase(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n?/g, "\n")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function hashSeedPhrase(value) {
  return hashBytesToSeed(encodeUtf8(normalizeSeedPhrase(value)));
}

export function deriveChildSeed(seed, label) {
  return hashBytesToSeed(encodeUtf8(`${label}:${seed}`));
}

export function createRandomSeed() {
  const bytes = new Uint8Array(SEED_RNG_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function createSeededRng(seed) {
  let [stateA, stateB, stateC, stateD] = createSeedState(seed);

  return function seededRandom() {
    const result = (stateA + stateB + stateD) >>> 0;
    stateD = (stateD + 1) >>> 0;
    stateA = (stateB ^ (stateB >>> 9)) >>> 0;
    stateB = (stateC + (stateC << 3)) >>> 0;
    stateC = (((stateC << 21) | (stateC >>> 11)) + result) >>> 0;
    return result / 4294967296;
  };
}

function tryGenerateDrillSequence(config, rngSeed) {
  const rng = createSeededRng(rngSeed);
  const objectiveIds = [];
  let currentArea = config.startingArea;
  let history = [];

  for (let index = 0; index < config.numberOfObjectives; index += 1) {
    const objective = generateNextDrill(allObjectives, {
      currentArea,
      requiredArea:
        index === 0 &&
        currentArea !== "Garage" &&
        !config.excludedAreas.includes(currentArea)
          ? currentArea
          : null,
      usedObjectiveIds: objectiveIds,
      history,
      sessionId: "seeded-session",
      drillSettings: config,
      rng
    });

    if (!objective) {
      return null;
    }

    objectiveIds.push(objective.id);
    history = [
      ...history,
      {
        sessionId: "seeded-session",
        objectiveId: objective.id,
        label: objective.label,
        area: objective.area,
        district: objective.district,
        type: objective.type,
        runClass: objective.runClass,
        result: "complete",
        startedAt: index,
        endedAt: index + 1
      }
    ];
    currentArea = objective.area ?? currentArea;
  }

  return objectiveIds;
}

export function generateDrillSequence(configInput, rngSeed) {
  const config = normalizeSessionConfig(configInput);

  for (let attempt = 0; attempt < MAX_SEQUENCE_GENERATION_ATTEMPTS; attempt += 1) {
    const attemptSeed =
      attempt === 0 ? rngSeed : deriveChildSeed(rngSeed, `sequence-attempt-${attempt}`);
    const objectiveIds = tryGenerateDrillSequence(config, attemptSeed);

    if (objectiveIds) {
      return objectiveIds;
    }
  }

  throw new Error("Seeded configuration could not generate the requested objective sequence.");
}

export function buildSessionSpecFromConfig(
  configInput,
  rngSeed,
  sessionType = PRACTICE_SESSION_TYPE
) {
  const config = normalizeSessionConfigForType(configInput, sessionType);
  const objectiveIds = generateDrillSequence(config, rngSeed);
  const sessionSpec = createSessionSeedPayload({
    rngSeed,
    config,
    objectiveIds,
    sessionType
  });

  return {
    sessionSpec,
    exportSeed: encodeSessionSeed(sessionSpec)
  };
}

export function buildSessionSpecFromPhrase(seedPhrase, sessionType = PRACTICE_SESSION_TYPE) {
  const normalizedPhrase = normalizeSeedPhrase(seedPhrase);
  const rngSeed = hashSeedPhrase(normalizedPhrase);
  const phraseConfig = derivePhraseConfig(rngSeed, sessionType);

  try {
    return {
      ...buildSessionSpecFromConfig(phraseConfig, rngSeed, sessionType),
      normalizedPhrase
    };
  } catch {
    try {
      return {
        ...buildSessionSpecFromConfig(repairPhraseConfig(phraseConfig), rngSeed, sessionType),
        normalizedPhrase
      };
    } catch {
      return {
        ...buildSessionSpecFromConfig(createSafePhraseConfig(), rngSeed, sessionType),
        normalizedPhrase
      };
    }
  }
}

export function encodeSessionSeed(sessionSpec) {
  return `${SESSION_SEED_PREFIX}${encodeCompactSessionSeedPayload(sessionSpec)}`;
}

export function decodeSessionSeed(value) {
  if (typeof value !== "string") {
    throw new Error("Seed is not a supported exported drill seed.");
  }

  if (value.startsWith(SESSION_SEED_PREFIX)) {
    return decodeCompactSessionSeed(value);
  }

  if (value.startsWith(LEGACY_COMPACT_SESSION_SEED_PREFIX)) {
    return decodeLegacyCompactSessionSeed(value, LEGACY_COMPACT_SESSION_SEED_PREFIX.length);
  }

  if (value.startsWith(LEGACY_SESSION_SEED_V2_PREFIX)) {
    return decodeLegacyCompactSessionSeed(
      value,
      LEGACY_SESSION_SEED_V2_PREFIX.length
    );
  }

  throw new Error("Seed is not a supported exported drill seed.");
}

function looksLikeFormalSeed(value) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith(SESSION_SEED_PREFIX) ||
    value.startsWith(LEGACY_COMPACT_SESSION_SEED_PREFIX) ||
    value.startsWith(LEGACY_SESSION_SEED_V2_PREFIX) ||
    /^BNGS/i.test(value) ||
    /^JSRF/i.test(value)
  );
}

function resolveSeedWarning(sessionSpec, sessionType, fallbackWarning = "") {
  const requestedSessionType = normalizeSessionType(sessionType);

  if (
    sessionSpec?.sessionType === ROUTE_SESSION_TYPE &&
    requestedSessionType === PRACTICE_SESSION_TYPE
  ) {
    return ROUTE_SEED_IN_PRACTICE_WARNING;
  }

  if (
    sessionSpec?.sessionType === PRACTICE_SESSION_TYPE &&
    requestedSessionType === ROUTE_SESSION_TYPE
  ) {
    return PRACTICE_SEED_IN_ROUTE_WARNING;
  }

  return fallbackWarning;
}

function adaptSessionSpecForSeedInput(sessionSpec, sessionType) {
  const requestedSessionType = normalizeSessionType(sessionType);

  if (
    sessionSpec?.sessionType === ROUTE_SESSION_TYPE &&
    requestedSessionType === PRACTICE_SESSION_TYPE
  ) {
    return {
      ...sessionSpec,
      sessionType: PRACTICE_SESSION_TYPE,
      config: {
        ...sessionSpec.config
      },
      objectiveIds: sessionSpec.objectiveIds.slice()
    };
  }

  if (
    sessionSpec?.sessionType === PRACTICE_SESSION_TYPE &&
    requestedSessionType === ROUTE_SESSION_TYPE
  ) {
    const objectiveIds = sessionSpec.objectiveIds.slice();

    return {
      ...sessionSpec,
      sessionType: ROUTE_SESSION_TYPE,
      config: {
        ...normalizeSessionConfig(sessionSpec.config),
        numberOfObjectives: objectiveIds.length
      },
      objectiveIds
    };
  }

  return sessionSpec;
}

export function resolveSeedInput(seedInput, sessionType = PRACTICE_SESSION_TYPE) {
  const rawSeedInput = typeof seedInput === "string" ? seedInput : "";
  const exportedCandidate = rawSeedInput.trim();
  const formalSeedCandidate = looksLikeFormalSeed(exportedCandidate);

  if (exportedCandidate) {
    try {
      const decodedSessionSpec = decodeSessionSeed(exportedCandidate);
      const sessionSpec = adaptSessionSpecForSeedInput(decodedSessionSpec, sessionType);
      return {
        mode: "exported",
        sessionSpec,
        exportSeed: encodeSessionSeed(sessionSpec),
        normalizedPhrase: "",
        warning: resolveSeedWarning(decodedSessionSpec, sessionType)
      };
    } catch {
      // Invalid exported-looking values may still be interpreted deterministically as phrase seeds.
    }
  }

  const normalizedPhrase = normalizeSeedPhrase(rawSeedInput);
  if (!normalizedPhrase) {
    return {
      mode: "manual",
      sessionSpec: null,
      exportSeed: "",
      normalizedPhrase: "",
      warning: formalSeedCandidate ? CORRUPTED_FORMAL_SEED_WARNING : ""
    };
  }

  const { sessionSpec, exportSeed } = buildSessionSpecFromPhrase(rawSeedInput, sessionType);
  return {
    mode: "phrase",
    sessionSpec,
    exportSeed,
    normalizedPhrase,
    warning: formalSeedCandidate ? CORRUPTED_FORMAL_SEED_WARNING : ""
  };
}
