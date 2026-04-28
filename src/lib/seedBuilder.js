import { areaOrder, objectiveAreaOrder } from "../data/areaMeta.js";
import { allObjectives, objectivesById } from "../data/objectives.js";
import {
  DEFAULT_DRILL_SETTINGS,
  ROUTE_VISIBLE_COUNT_MAX,
  ROUTE_VISIBLE_COUNT_MIN,
  normalizeDrillSettings
} from "./drill/drillSettings.js";
import {
  buildSessionSpecFromObjectiveIds,
  createRandomSeed
} from "./seed/sessionSeed.js";
import {
  DEFAULT_ROUTE_REVEAL_MODE,
  normalizeRouteRevealMode
} from "./session/routeRevealMode.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE,
  normalizeSessionType
} from "./session/sessionTypes.js";

export const SEED_BUILDER_MODE = "seed-builder";
export const SEED_BUILDER_MIN_ROUTE_OBJECTIVES = ROUTE_VISIBLE_COUNT_MIN;

const OBJECTIVE_ID_SET = new Set(allObjectives.map((objective) => objective.id));
const DEFAULT_SELECTED_AREA = objectiveAreaOrder[0] ?? "Dogen";
const DEFAULT_STARTING_AREA = "Garage";

function clampRouteVisibleCount(value, objectiveCount = ROUTE_VISIBLE_COUNT_MAX) {
  const numericValue = Number.isFinite(value)
    ? Math.round(value)
    : DEFAULT_DRILL_SETTINGS.routeVisibleCount;
  const maxVisibleCount = Math.max(
    ROUTE_VISIBLE_COUNT_MIN,
    Math.min(ROUTE_VISIBLE_COUNT_MAX, objectiveCount || ROUTE_VISIBLE_COUNT_MAX)
  );

  return Math.max(ROUTE_VISIBLE_COUNT_MIN, Math.min(maxVisibleCount, numericValue));
}

function normalizeSeedBuilderObjectiveIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenObjectiveIds = new Set();
  const objectiveIds = [];

  for (const rawObjectiveId of value) {
    if (typeof rawObjectiveId !== "string") {
      continue;
    }

    const objectiveId = rawObjectiveId.trim();
    if (!OBJECTIVE_ID_SET.has(objectiveId) || seenObjectiveIds.has(objectiveId)) {
      continue;
    }

    seenObjectiveIds.add(objectiveId);
    objectiveIds.push(objectiveId);
  }

  return objectiveIds;
}

function normalizeSelectedArea(value, objectiveIds) {
  if (typeof value === "string" && objectiveAreaOrder.includes(value)) {
    return value;
  }

  const firstObjectiveArea = objectivesById[objectiveIds[0]]?.area;
  return objectiveAreaOrder.includes(firstObjectiveArea)
    ? firstObjectiveArea
    : DEFAULT_SELECTED_AREA;
}

function normalizeRngSeed(value) {
  return typeof value === "string" && /^[0-9a-f]{32}$/i.test(value)
    ? value.toLowerCase()
    : createRandomSeed();
}

export function createDefaultSeedBuilderDraft() {
  return {
    sessionType: PRACTICE_SESSION_TYPE,
    objectiveIds: [],
    startingArea: DEFAULT_STARTING_AREA,
    selectedArea: DEFAULT_SELECTED_AREA,
    routeVisibleCount: DEFAULT_DRILL_SETTINGS.routeVisibleCount,
    routeRevealMode: DEFAULT_ROUTE_REVEAL_MODE,
    rngSeed: createRandomSeed()
  };
}

export function normalizeSeedBuilderDraft(value) {
  const defaults = createDefaultSeedBuilderDraft();

  if (!value || typeof value !== "object") {
    return defaults;
  }

  const sessionType = normalizeSessionType(value.sessionType);
  const objectiveIds = normalizeSeedBuilderObjectiveIds(value.objectiveIds);
  const routeVisibleCount = clampRouteVisibleCount(
    Number(value.routeVisibleCount),
    objectiveIds.length
  );

  return {
    sessionType,
    objectiveIds,
    startingArea:
      typeof value.startingArea === "string" && areaOrder.includes(value.startingArea)
        ? value.startingArea
        : defaults.startingArea,
    selectedArea: normalizeSelectedArea(value.selectedArea, objectiveIds),
    routeVisibleCount,
    routeRevealMode: normalizeRouteRevealMode(value.routeRevealMode),
    rngSeed: normalizeRngSeed(value.rngSeed)
  };
}

export function createSeedBuilderDraftFromSessionSpec(sessionSpec, previousDraft = null) {
  const normalizedPrevious = normalizeSeedBuilderDraft(previousDraft);
  const objectiveIds = normalizeSeedBuilderObjectiveIds(sessionSpec?.objectiveIds);
  const firstObjectiveArea = objectivesById[objectiveIds[0]]?.area;

  return normalizeSeedBuilderDraft({
    ...normalizedPrevious,
    sessionType: normalizeSessionType(sessionSpec?.sessionType),
    objectiveIds,
    startingArea: sessionSpec?.config?.startingArea ?? normalizedPrevious.startingArea,
    selectedArea: firstObjectiveArea ?? normalizedPrevious.selectedArea,
    routeVisibleCount:
      sessionSpec?.config?.routeVisibleCount ?? normalizedPrevious.routeVisibleCount,
    routeRevealMode:
      sessionSpec?.config?.routeRevealMode ?? normalizedPrevious.routeRevealMode,
    rngSeed: sessionSpec?.rngSeed ?? normalizedPrevious.rngSeed
  });
}

export function buildSeedBuilderLaunchState(draft, options = {}) {
  const normalizedDraft = normalizeSeedBuilderDraft(draft);
  const objectiveCount = normalizedDraft.objectiveIds.length;
  const sessionType = normalizedDraft.sessionType;

  if (objectiveCount === 0) {
    throw new Error("Add at least one square before creating a seed.");
  }

  if (
    sessionType === ROUTE_SESSION_TYPE &&
    objectiveCount < SEED_BUILDER_MIN_ROUTE_OBJECTIVES
  ) {
    throw new Error("Route seeds need at least two squares.");
  }

  const baseDrillSettings = normalizeDrillSettings(
    options.drillSettings ?? DEFAULT_DRILL_SETTINGS
  );
  const routeVisibleCount =
    sessionType === ROUTE_SESSION_TYPE
      ? clampRouteVisibleCount(normalizedDraft.routeVisibleCount, objectiveCount)
      : normalizedDraft.routeVisibleCount;
  const config = {
    ...baseDrillSettings,
    startingArea: normalizedDraft.startingArea,
    numberOfObjectives: objectiveCount,
    routeVisibleCount,
    routeRevealMode: normalizedDraft.routeRevealMode
  };

  return buildSessionSpecFromObjectiveIds(
    normalizedDraft.objectiveIds,
    config,
    options.rngSeed ?? normalizedDraft.rngSeed,
    sessionType
  );
}

export function moveSeedBuilderObjective(objectiveIdsInput, fromIndex, toIndex) {
  const objectiveIds = normalizeSeedBuilderObjectiveIds(objectiveIdsInput);
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= objectiveIds.length ||
    toIndex < 0 ||
    toIndex >= objectiveIds.length ||
    fromIndex === toIndex
  ) {
    return objectiveIds;
  }

  const nextObjectiveIds = objectiveIds.slice();
  const [movedObjectiveId] = nextObjectiveIds.splice(fromIndex, 1);
  nextObjectiveIds.splice(toIndex, 0, movedObjectiveId);
  return nextObjectiveIds;
}

export function insertSeedBuilderObjective(objectiveIdsInput, objectiveId, insertIndex) {
  const objectiveIds = normalizeSeedBuilderObjectiveIds(objectiveIdsInput);
  if (!OBJECTIVE_ID_SET.has(objectiveId) || objectiveIds.includes(objectiveId)) {
    return objectiveIds;
  }

  const targetIndex = Number.isInteger(insertIndex)
    ? Math.max(0, Math.min(objectiveIds.length, insertIndex))
    : objectiveIds.length;
  const nextObjectiveIds = objectiveIds.slice();
  nextObjectiveIds.splice(targetIndex, 0, objectiveId);
  return nextObjectiveIds;
}

export function removeSeedBuilderObjective(objectiveIdsInput, removeIndex) {
  const objectiveIds = normalizeSeedBuilderObjectiveIds(objectiveIdsInput);
  if (
    !Number.isInteger(removeIndex) ||
    removeIndex < 0 ||
    removeIndex >= objectiveIds.length
  ) {
    return objectiveIds;
  }

  return objectiveIds.filter((_, index) => index !== removeIndex);
}

export function normalizeSeedBuilderDraftAfterObjectiveChange(draftInput, objectiveIdsInput) {
  const draft = normalizeSeedBuilderDraft(draftInput);
  return normalizeSeedBuilderDraft({
    ...draft,
    objectiveIds: normalizeSeedBuilderObjectiveIds(objectiveIdsInput)
  });
}
