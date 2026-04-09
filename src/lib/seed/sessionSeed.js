import { areaOrder, objectiveAreaOrder } from "../../data/areaMeta.js";
import { allObjectives, objectivesById } from "../../data/objectives.js";
import { generateNextDrill } from "../drill/drillGenerator.js";
import {
  CATEGORY_VARIANCE_MAX,
  CATEGORY_VARIANCE_MIN,
  DEFAULT_DRILL_SETTINGS,
  MOVEMENT_VARIANCE_MAX,
  MOVEMENT_VARIANCE_MIN,
  normalizeDrillSettings
} from "../drill/drillSettings.js";
import { OBJECTIVE_FRESHNESS_WINDOW } from "../session/drillSessionConstants.js";

export const SESSION_SEED_PREFIX = "BNGSD2.";
export const LEGACY_SESSION_SEED_V2_PREFIX = "JSRFD2.";
export const LEGACY_SESSION_SEED_PREFIX = "JSRFD1.";
export const SESSION_SEED_VERSION = 2;
export const PHRASE_OBJECTIVE_MIN = 5;
export const PHRASE_OBJECTIVE_MAX = 40;
export const CORRUPTED_FORMAL_SEED_WARNING =
  "This looks like a formal seed, but parts of it appear corrupted. We'll read it as-is, but double-check the source if this wasn't expected.";

const OBJECTIVE_INDEX_BY_ID = Object.fromEntries(
  allObjectives.map((objective, index) => [objective.id, index])
);
const SEED_RNG_BYTES = 16;
const PACKED_CONFIG_BYTES = 6;
const PACKED_CONFIG_BITS = 44;
const MAX_SERIALIZED_OBJECTIVE_COUNT = 255;
const MAX_SERIALIZED_OBJECTIVE_INDEX = 255;

function encodeUtf8(value) {
  return new TextEncoder().encode(value);
}

function decodeUtf8(value) {
  return new TextDecoder().decode(value);
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

function createSessionSeedPayload({ rngSeed, config, objectiveIds }) {
  return {
    version: SESSION_SEED_VERSION,
    rngSeed,
    config: normalizeSessionConfig(config),
    objectiveIds: objectiveIds.slice()
  };
}

function packConfig(configInput) {
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
    { bits: 1, value: config.trueRandom ? 1 : 0 }
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
    { key: "trueRandom", bits: 1 }
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

  return normalizeSessionConfig({
    startingArea: areaOrder[decodedFields.startingAreaIndex],
    numberOfObjectives: decodedFields.numberOfObjectives,
    excludedAreas,
    graffitiVariance: decodedFields.graffitiVariance + CATEGORY_VARIANCE_MIN,
    unlockVariance: decodedFields.unlockVariance + CATEGORY_VARIANCE_MIN,
    defaultVariance: decodedFields.defaultVariance + CATEGORY_VARIANCE_MIN,
    notebookVariance: decodedFields.notebookVariance + CATEGORY_VARIANCE_MIN,
    levelShift: decodedFields.levelShift + MOVEMENT_VARIANCE_MIN,
    districtShift: decodedFields.districtShift + MOVEMENT_VARIANCE_MIN,
    trueRandom: Boolean(decodedFields.trueRandom)
  });
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
  const configBytes = packConfig(sessionSpec.config);
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
  const config = unpackConfig(configBytes);
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
    objectiveIds
  });
}

function decodeLegacySessionSeed(value) {
  let parsedValue;
  try {
    parsedValue = JSON.parse(
      decodeUtf8(base64UrlDecode(value.slice(LEGACY_SESSION_SEED_PREFIX.length)))
    );
  } catch {
    throw new Error("Seed payload could not be decoded.");
  }

  if (parsedValue?.version !== 1) {
    throw new Error(`Unsupported seed version: ${parsedValue?.version ?? "unknown"}.`);
  }

  const config = normalizeSessionConfig(parsedValue.config);
  const objectiveIds = Array.isArray(parsedValue.objectiveIds)
    ? parsedValue.objectiveIds.filter(
        (objectiveId) => typeof objectiveId === "string" && objectivesById[objectiveId]
      )
    : [];

  if (objectiveIds.length !== config.numberOfObjectives) {
    throw new Error("Seed payload objective list does not match the stored objective count.");
  }

  const rngSeed =
    typeof parsedValue.rngSeed === "string" && /^[0-9a-f]{32}$/i.test(parsedValue.rngSeed)
      ? parsedValue.rngSeed.toLowerCase()
      : null;

  if (!rngSeed) {
    throw new Error("Seed payload is missing a valid RNG seed.");
  }

  return createSessionSeedPayload({
    rngSeed,
    config,
    objectiveIds
  });
}

function derivePhraseConfig(seed) {
  const rng = createSeededRng(deriveChildSeed(seed, "config"));
  const excludedAreas = shuffleWithRng(objectiveAreaOrder, rng).slice(
    0,
    randomInteger(rng, 0, Math.min(4, Math.max(0, objectiveAreaOrder.length - 1)))
  );

  return normalizeSessionConfig({
    startingArea: areaOrder[randomInteger(rng, 0, areaOrder.length - 1)],
    numberOfObjectives: randomInteger(rng, PHRASE_OBJECTIVE_MIN, PHRASE_OBJECTIVE_MAX),
    excludedAreas,
    graffitiVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    unlockVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    defaultVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    notebookVariance: randomInteger(rng, CATEGORY_VARIANCE_MIN, CATEGORY_VARIANCE_MAX),
    levelShift: randomInteger(rng, MOVEMENT_VARIANCE_MIN, MOVEMENT_VARIANCE_MAX),
    districtShift: randomInteger(rng, MOVEMENT_VARIANCE_MIN, MOVEMENT_VARIANCE_MAX),
    trueRandom: false
  });
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

export function buildSessionConfig(startingArea, drillSettings) {
  return normalizeSessionConfig({
    startingArea,
    ...normalizeDrillSettings(drillSettings)
  });
}

export function normalizeSessionConfig(value) {
  const normalizedDrillSettings = normalizeDrillSettings(value);

  return {
    startingArea:
      typeof value?.startingArea === "string" && areaOrder.includes(value.startingArea)
        ? value.startingArea
        : "Garage",
    numberOfObjectives: normalizedDrillSettings.numberOfObjectives,
    excludedAreas: normalizedDrillSettings.excludedAreas,
    graffitiVariance: normalizedDrillSettings.graffitiVariance,
    unlockVariance: normalizedDrillSettings.unlockVariance,
    defaultVariance: normalizedDrillSettings.defaultVariance,
    notebookVariance: normalizedDrillSettings.notebookVariance,
    levelShift: normalizedDrillSettings.levelShift,
    districtShift: normalizedDrillSettings.districtShift,
    trueRandom: normalizedDrillSettings.trueRandom
  };
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

export function generateDrillSequence(configInput, rngSeed) {
  const config = normalizeSessionConfig(configInput);
  const rng = createSeededRng(rngSeed);
  const objectiveIds = [];
  let currentArea = config.startingArea;
  let usedObjectiveIds = [];
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
      usedObjectiveIds,
      history,
      sessionId: "seeded-session",
      drillSettings: config,
      rng
    });

    if (!objective) {
      throw new Error("Seeded configuration could not generate the requested objective sequence.");
    }

    objectiveIds.push(objective.id);
    usedObjectiveIds = [...usedObjectiveIds, objective.id].slice(-OBJECTIVE_FRESHNESS_WINDOW);
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

export function buildSessionSpecFromConfig(configInput, rngSeed) {
  const config = normalizeSessionConfig(configInput);
  const objectiveIds = generateDrillSequence(config, rngSeed);
  const sessionSpec = createSessionSeedPayload({
    rngSeed,
    config,
    objectiveIds
  });

  return {
    sessionSpec,
    exportSeed: encodeSessionSeed(sessionSpec)
  };
}

export function buildSessionSpecFromPhrase(seedPhrase) {
  const normalizedPhrase = normalizeSeedPhrase(seedPhrase);
  const rngSeed = hashSeedPhrase(normalizedPhrase);
  const phraseConfig = derivePhraseConfig(rngSeed);

  try {
    return {
      ...buildSessionSpecFromConfig(phraseConfig, rngSeed),
      normalizedPhrase
    };
  } catch {
    try {
      return {
        ...buildSessionSpecFromConfig(repairPhraseConfig(phraseConfig), rngSeed),
        normalizedPhrase
      };
    } catch {
      return {
        ...buildSessionSpecFromConfig(createSafePhraseConfig(), rngSeed),
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

  if (value.startsWith(LEGACY_SESSION_SEED_V2_PREFIX)) {
    return decodeCompactSessionSeed(
      `${SESSION_SEED_PREFIX}${value.slice(LEGACY_SESSION_SEED_V2_PREFIX.length)}`
    );
  }

  if (value.startsWith(LEGACY_SESSION_SEED_PREFIX)) {
    return decodeLegacySessionSeed(value);
  }

  throw new Error("Seed is not a supported exported drill seed.");
}

function looksLikeFormalSeed(value) {
  if (!value) {
    return false;
  }

  return (
    value.startsWith(SESSION_SEED_PREFIX) ||
    value.startsWith(LEGACY_SESSION_SEED_V2_PREFIX) ||
    value.startsWith(LEGACY_SESSION_SEED_PREFIX) ||
    /^BNGS/i.test(value) ||
    /^JSRF/i.test(value)
  );
}

export function resolveSeedInput(seedInput) {
  const rawSeedInput = typeof seedInput === "string" ? seedInput : "";
  const exportedCandidate = rawSeedInput.trim();
  const formalSeedCandidate = looksLikeFormalSeed(exportedCandidate);

  if (exportedCandidate) {
    try {
      const sessionSpec = decodeSessionSeed(exportedCandidate);
      return {
        mode: "exported",
        sessionSpec,
        exportSeed: encodeSessionSeed(sessionSpec),
        normalizedPhrase: "",
        warning: ""
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

  const { sessionSpec, exportSeed } = buildSessionSpecFromPhrase(rawSeedInput);
  return {
    mode: "phrase",
    sessionSpec,
    exportSeed,
    normalizedPhrase,
    warning: formalSeedCandidate ? CORRUPTED_FORMAL_SEED_WARNING : ""
  };
}
