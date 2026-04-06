import { areaMeta } from "../data/areaMeta.js";
import { allObjectives } from "../data/objectives.js";
import { generateNextDrill } from "./drillGenerator.js";
import { getObjectiveCategory } from "./drillCategories.js";
import { objectiveRequiresTape } from "./drillSession.js";
import { OBJECTIVE_FRESHNESS_WINDOW } from "./drillSessionConstants.js";
import { normalizeDrillSettings } from "./drillSettings.js";

export function sampleDrillGeneration({
  samples = 1000,
  startingArea = "Garage",
  drillSettings = {},
  result = "complete"
} = {}) {
  const normalizedDrillSettings = normalizeDrillSettings(drillSettings);
  let history = [];
  let usedObjectiveIds = [];
  let currentArea = startingArea;
  let sessionId = "sample_0";
  let unlockedTapeAreas = [];
  let sessionCounter = 0;

  const categoryCounts = {};
  const typeCounts = {};
  const transitionCounts = {
    areaChanges: 0,
    sameLevelMoves: 0,
    levelShifts: 0,
    districtChanges: 0
  };
  const unlockContextCounts = {
    relevantDistrictRolls: 0,
    unlocksInRelevantDistricts: 0
  };

  for (let index = 0; index < samples; index += 1) {
    const requiredArea =
      history.length === 0 &&
      currentArea !== "Garage" &&
      !normalizedDrillSettings.excludedAreas.includes(currentArea)
        ? currentArea
        : null;
    let objective = generateNextDrill(allObjectives, {
      currentArea,
      requiredArea,
      usedObjectiveIds,
      history,
      sessionId,
      drillSettings: normalizedDrillSettings
    });

    if (!objective) {
      sessionCounter += 1;
      history = [];
      usedObjectiveIds = [];
      currentArea = startingArea;
      sessionId = `sample_${sessionCounter}`;
      unlockedTapeAreas = [];
      objective = generateNextDrill(allObjectives, {
        currentArea,
        requiredArea:
          currentArea !== "Garage" &&
          !normalizedDrillSettings.excludedAreas.includes(currentArea)
            ? currentArea
            : null,
        usedObjectiveIds,
        history,
        sessionId,
        drillSettings: normalizedDrillSettings
      });
    }

    if (!objective) {
      throw new Error("Drill sampler could not generate an objective.");
    }

    const category = getObjectiveCategory(objective.type);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    typeCounts[objective.type] = (typeCounts[objective.type] ?? 0) + 1;

    const previousMeta = areaMeta[currentArea];
    const targetMeta = areaMeta[objective.area];
    const hasRelevantDistrictUnlock =
      previousMeta &&
      allObjectives.some(
        (candidate) =>
          candidate.type === "unlock" &&
          candidate.district === previousMeta.district &&
          !normalizedDrillSettings.excludedAreas.includes(candidate.area)
      );

    if (hasRelevantDistrictUnlock) {
      unlockContextCounts.relevantDistrictRolls += 1;
      if (objective.type === "unlock") {
        unlockContextCounts.unlocksInRelevantDistricts += 1;
      }
    }

    if (currentArea !== objective.area && previousMeta && targetMeta) {
      transitionCounts.areaChanges += 1;

      if (previousMeta.district !== targetMeta.district) {
        transitionCounts.districtChanges += 1;
      } else if (previousMeta.depth !== targetMeta.depth) {
        transitionCounts.levelShifts += 1;
      } else {
        transitionCounts.sameLevelMoves += 1;
      }
    }

    usedObjectiveIds = [...usedObjectiveIds, objective.id].slice(-OBJECTIVE_FRESHNESS_WINDOW);
    const nextArea = result === "skip" ? currentArea : objective.area ?? currentArea;

    if (
      result !== "skip" &&
      objectiveRequiresTape(objective.type) &&
      !unlockedTapeAreas.includes(objective.area)
    ) {
      unlockedTapeAreas = [...unlockedTapeAreas, objective.area];
    }

    history = [
      ...history,
      {
        sessionId,
        objectiveId: objective.id,
        label: objective.label,
        area: objective.area,
        district: objective.district,
        type: objective.type,
        runClass: objective.runClass,
        result,
        startedAt: index,
        endedAt: index + 1
      }
    ];
    currentArea = nextArea;
  }

  return {
    samples,
    startingArea,
    result,
    drillSettings: normalizedDrillSettings,
    categoryCounts,
    typeCounts,
    transitionCounts,
    unlockContextCounts,
    transitionRatios: {
      relocationShare:
        samples > 0 ? transitionCounts.areaChanges / samples : 0,
      levelShiftShareOfAreaChanges:
        transitionCounts.areaChanges > 0
          ? transitionCounts.levelShifts / transitionCounts.areaChanges
          : 0,
      levelShiftShareOfNonDistrictAreaChanges:
        transitionCounts.areaChanges - transitionCounts.districtChanges > 0
          ? transitionCounts.levelShifts /
            (transitionCounts.areaChanges - transitionCounts.districtChanges)
          : 0,
      districtChangeShareOfAreaChanges:
        transitionCounts.areaChanges > 0
          ? transitionCounts.districtChanges / transitionCounts.areaChanges
          : 0
    }
  };
}

export function formatCountsTable(counts, total) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => ({
      key,
      count,
      percent: total === 0 ? 0 : (count / total) * 100
    }));
}
