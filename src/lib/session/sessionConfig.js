import { areaOrder } from "../../data/areaMeta.js";
import {
  NUMBER_OF_OBJECTIVES_MAX,
  NUMBER_OF_OBJECTIVES_MIN,
  ROUTE_VISIBLE_COUNT_MAX,
  ROUTE_VISIBLE_COUNT_MIN,
  getAvailableObjectiveCount,
  normalizeDrillSettings
} from "../drill/drillSettings.js";
import { PRACTICE_SESSION_TYPE, isRouteSessionType } from "./sessionTypes.js";

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
    trueRandom: normalizedDrillSettings.trueRandom,
    routeVisibleCount: normalizedDrillSettings.routeVisibleCount
  };
}

export function normalizeRouteSessionConfig(configInput) {
  const config = normalizeSessionConfig(configInput);
  const availableObjectiveCount = getAvailableObjectiveCount(config);
  const visibleMin = Math.min(ROUTE_VISIBLE_COUNT_MIN, availableObjectiveCount);
  const visibleMax = Math.max(
    visibleMin,
    Math.min(ROUTE_VISIBLE_COUNT_MAX, availableObjectiveCount)
  );
  const routeVisibleCount = Math.max(
    visibleMin,
    Math.min(visibleMax, config.routeVisibleCount)
  );

  return normalizeSessionConfig({
    ...config,
    routeVisibleCount,
    numberOfObjectives: Math.max(
      routeVisibleCount,
      Math.min(availableObjectiveCount, config.numberOfObjectives)
    )
  });
}

export function normalizeSessionConfigForType(configInput, sessionType = PRACTICE_SESSION_TYPE) {
  return isRouteSessionType(sessionType)
    ? normalizeRouteSessionConfig(configInput)
    : normalizeSessionConfig(configInput);
}

export function normalizeDrillSettingsForSessionType(value, sessionType = PRACTICE_SESSION_TYPE) {
  return normalizeDrillSettings(normalizeSessionConfigForType(value, sessionType));
}

export function buildSessionConfig(startingArea, drillSettings) {
  return normalizeSessionConfig({
    startingArea,
    ...normalizeDrillSettings(drillSettings)
  });
}

export function getSessionObjectiveMax(drillSettings) {
  return Math.max(
    NUMBER_OF_OBJECTIVES_MIN,
    Math.min(NUMBER_OF_OBJECTIVES_MAX, getAvailableObjectiveCount(drillSettings))
  );
}
