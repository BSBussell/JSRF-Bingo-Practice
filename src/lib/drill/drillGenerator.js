// Weighted drill selection. The shape here is intentionally two-stage:
// first pick movement, then pick category within that movement bucket.
// That keeps the tuning knobs legible and prevents one giant weight from
// accidentally flattening the travel cadence Bee actually cares about.
import { areaMeta } from "../../data/areaMeta.js";
import { DRILL_CATEGORY_BY_KEY, DRILL_CATEGORY_KEYS, getObjectiveCategory } from "./drillCategories.js";
import {
  DEFAULT_DRILL_SETTINGS,
  categoryVarianceMultiplier,
  movementTargetShare
} from "./drillSettings.js";
import { travelWeight } from "./travelWeight.js";
import { weightedPick } from "./weightedPick.js";

const MOVEMENT_CLASSES = ["sameArea", "sameLevelMove", "levelShift", "districtChange"];

function recentSessionEntries(history, sessionId, count = 3) {
  return history.filter((entry) => entry.sessionId === sessionId).slice(-count);
}

function currentDistrictStreak(history, sessionId, district) {
  if (!district) {
    return 0;
  }

  const sessionEntries = history.filter((entry) => entry.sessionId === sessionId);
  let streak = 0;

  for (let index = sessionEntries.length - 1; index >= 0; index -= 1) {
    if (sessionEntries[index].district !== district) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function streakDepthBias(streak, currentDepth, targetDepth) {
  if (currentDepth === null || targetDepth === null || targetDepth >= currentDepth) {
    return 1;
  }

  // These values are hand-tuned nudges, not a derived formula. Keeping them as
  // explicit steps makes future retuning less mysterious than hiding them in a
  // clever curve.
  const depthDrop = currentDepth - targetDepth;

  if (streak === 7) {
    if (depthDrop === 1) return 4.5;
    if (depthDrop >= 2) return 1.6;
  }

  if (streak === 8) {
    if (depthDrop === 1) return 3.2;
    if (depthDrop >= 2) return 3.8;
  }

  if (streak === 9) {
    if (depthDrop === 1) return 2.1;
    if (depthDrop >= 2) return 5.1;
  }

  if (streak >= 10) {
    return 0;
  }

  return 1;
}

function resolveMovementClass(currentArea, targetArea) {
  if (currentArea === targetArea) {
    return "sameArea";
  }

  const currentMeta = areaMeta[currentArea];
  const targetMeta = areaMeta[targetArea];

  if (!currentMeta || !targetMeta) {
    return "sameLevelMove";
  }

  if (currentMeta.district !== targetMeta.district) {
    return "districtChange";
  }

  if (currentMeta.depth !== targetMeta.depth) {
    return "levelShift";
  }

  return "sameLevelMove";
}

function buildObjectiveWeight(objective, context) {
  const {
    currentArea,
    requiredArea = null,
    usedObjectiveIds,
    history,
    sessionId,
    drillSettings = DEFAULT_DRILL_SETTINGS
  } = context;

  if (drillSettings.excludedAreas.includes(objective.area)) {
    return 0;
  }

  if (drillSettings.trueRandom) {
    return 1;
  }

  if (usedObjectiveIds.has(objective.id)) {
    return 0;
  }

  if (requiredArea && objective.area !== requiredArea) {
    return 0;
  }

  const category = getObjectiveCategory(objective.type);
  const currentMeta = areaMeta[currentArea];
  const targetMeta = areaMeta[objective.area];

  // Unlock cadence is local-only: if the current district can't naturally reach a character unlock,
  // the unlock category should simply drop out instead of forcing a map transfer.
  if (
    category === "unlock" &&
    currentMeta &&
    targetMeta &&
    !currentMeta.transitHub &&
    currentMeta.district !== targetMeta.district
  ) {
    return 0;
  }

  const movementClass = resolveMovementClass(currentArea, objective.area);
  let weight = travelWeight(currentArea, objective.area, areaMeta);
  const recent = recentSessionEntries(history, sessionId, 3);
  const recentTypes = recent.map((entry) => entry.type);
  const recentRunClasses = recent.map((entry) => entry.runClass);
  const lastEntry = recent[recent.length - 1];
  const districtStreak = currentDistrictStreak(
    history,
    sessionId,
    currentMeta?.district
  );

  if (movementClass === "districtChange") {
    // Cross-district rolls are only legal to top-level areas; anything deeper
    // would imply a pathing shortcut the current trainer state does not model.
    if (!targetMeta || targetMeta.depth !== 0) {
      return 0;
    }
  }

  if (movementClass === "levelShift" && currentMeta && targetMeta) {
    const isLowerDepthTarget =
      currentMeta.depth >= 1 &&
      targetMeta.depth < currentMeta.depth &&
      objective.area !== currentArea;

    if (isLowerDepthTarget) {
      weight *= streakDepthBias(districtStreak, currentMeta.depth, targetMeta.depth);
    }
  }

  if (lastEntry?.type === objective.type) {
    weight *= 0.45;
  }

  if (recentTypes.length >= 2 && recentTypes.slice(-2).every((type) => type === objective.type)) {
    weight *= 0.35;
  }

  if (objective.runClass === "long") {
    weight *= 0.6;
  }

  if (lastEntry?.runClass === "long" && objective.runClass === "long") {
    weight *= 0.4;
  }

  if (
    recentRunClasses.length >= 2 &&
    recentRunClasses.slice(-2).every((runClass) => runClass === "long") &&
    objective.runClass === "long"
  ) {
    weight *= 0.25;
  }

  if (lastEntry?.result === "skip" && lastEntry.type === objective.type) {
    weight *= 0.75;
  }

  if (objective.area === currentArea) {
    weight *= 1.18;
  }

  return Math.max(0, weight);
}

function buildCategoryScore(category, weightedObjectives, context) {
  if (weightedObjectives.length === 0) {
    return 0;
  }

  const drillSettings = context.drillSettings ?? DEFAULT_DRILL_SETTINGS;
  const categorySettingKey = DRILL_CATEGORY_BY_KEY[category]?.settingKey;
  const categoryControl = drillSettings.trueRandom
    ? 1
    : categoryVarianceMultiplier(drillSettings[categorySettingKey]);

  if (categoryControl <= 0) {
    return 0;
  }

  const history = context.history ?? [];
  const recentCategories = recentSessionEntries(history, context.sessionId, 3).map((entry) =>
    getObjectiveCategory(entry.type)
  );
  const totalWeight = weightedObjectives.reduce((sum, entry) => sum + entry.weight, 0);
  const averageWeight = totalWeight / weightedObjectives.length;
  let score = averageWeight * Math.log2(weightedObjectives.length + 1);

  if (recentCategories[recentCategories.length - 1] === category) {
    score *= 0.38;
  }

  if (
    recentCategories.length >= 2 &&
    recentCategories.slice(-2).every((recentCategory) => recentCategory === category)
  ) {
    score *= 0.24;
  }

  return Math.max(0, score * categoryControl);
}

function buildWeightedObjectivesByCategory(objectives, context) {
  return objectives.reduce((categories, objective) => {
    const weight = buildObjectiveWeight(objective, context);
    if (weight <= 0) {
      return categories;
    }

    const category = getObjectiveCategory(objective.type);
    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push({
      objective,
      weight
    });
    return categories;
  }, {});
}

function buildWeightedEntryCategories(entries) {
  return entries.reduce((categories, entry) => {
    const category = getObjectiveCategory(entry.objective.type);

    if (!categories[category]) {
      categories[category] = [];
    }

    categories[category].push(entry);
    return categories;
  }, {});
}

function buildWeightedObjectivesByMovement(entries, currentArea) {
  return entries.reduce((movements, entry) => {
    const movementClass = resolveMovementClass(currentArea, entry.objective.area);

    if (!movements[movementClass]) {
      movements[movementClass] = [];
    }

    movements[movementClass].push(entry);
    return movements;
  }, {});
}

function buildMovementClassScores(movementBuckets, context) {
  const drillSettings = context.drillSettings ?? DEFAULT_DRILL_SETTINGS;
  const baseScores = Object.fromEntries(
    MOVEMENT_CLASSES.map((movementClass) => [
      movementClass,
      (movementBuckets[movementClass] ?? []).reduce((sum, entry) => sum + entry.weight, 0)
    ])
  );

  if (drillSettings.trueRandom) {
    return baseScores;
  }

  const sameAreaBase = baseScores.sameArea ?? 0;
  const sameLevelBase = baseScores.sameLevelMove ?? 0;
  const crossLevelBase = baseScores.levelShift ?? 0;
  const districtChangeBase = baseScores.districtChange ?? 0;
  const areaChangeBase =
    (baseScores.sameLevelMove ?? 0) +
    (baseScores.levelShift ?? 0) +
    (baseScores.districtChange ?? 0);
  const totalBase = sameAreaBase + areaChangeBase;

  if (totalBase <= 0) {
    return {
      sameArea: 0,
      sameLevelMove: 0,
      levelShift: 0,
      districtChange: 0
    };
  }

  if (areaChangeBase <= 0) {
    return {
      sameArea: totalBase,
      sameLevelMove: 0,
      levelShift: 0,
      districtChange: 0
    };
  }

  const relocationTarget = movementTargetShare(drillSettings.levelShift);
  const districtTarget = movementTargetShare(drillSettings.districtShift);

  const canStayInArea = sameAreaBase > 0;
  const canRelocate = areaChangeBase > 0;

  let sameAreaBudget = canStayInArea ? totalBase * (1 - relocationTarget) : 0;
  let relocationBudget = canRelocate ? totalBase * relocationTarget : 0;

  if (!canStayInArea && canRelocate) {
    relocationBudget = totalBase;
  }

  if (canStayInArea && !canRelocate) {
    sameAreaBudget = totalBase;
  }

  const sameDistrictBase = sameLevelBase + crossLevelBase;
  const canChangeDistrict = districtChangeBase > 0;
  const canStayInDistrict = sameDistrictBase > 0;

  // Budgets redistribute the same total weight rather than multiplying buckets
  // independently, so the movement sliders change shape without changing how
  // dense the overall candidate pool feels.
  let districtBudget = canChangeDistrict ? relocationBudget * districtTarget : 0;
  let sameDistrictBudget = canStayInDistrict ? relocationBudget - districtBudget : 0;

  if (!canChangeDistrict && canStayInDistrict) {
    sameDistrictBudget = relocationBudget;
  }

  if (canChangeDistrict && !canStayInDistrict) {
    districtBudget = relocationBudget;
  }

  const sameLevelShare =
    sameDistrictBase > 0 ? sameLevelBase / sameDistrictBase : 0;
  const crossLevelShare =
    sameDistrictBase > 0 ? crossLevelBase / sameDistrictBase : 0;

  return {
    sameArea: sameAreaBudget,
    sameLevelMove: sameDistrictBudget * sameLevelShare,
    levelShift: sameDistrictBudget * crossLevelShare,
    districtChange: districtBudget
  };
}

export function generateNextDrill(objectives, context) {
  const usedObjectiveIds = new Set(context.usedObjectiveIds);
  const nextContext = {
    ...context,
    usedObjectiveIds,
    drillSettings: context.drillSettings ?? DEFAULT_DRILL_SETTINGS
  };

  const weightedObjectivesByCategory = buildWeightedObjectivesByCategory(objectives, nextContext);
  const allWeightedEntries = DRILL_CATEGORY_KEYS.flatMap(
    (category) => weightedObjectivesByCategory[category] ?? []
  );

  if (nextContext.drillSettings.trueRandom) {
    return (
      weightedPick(allWeightedEntries, (entry) => entry.weight, nextContext.rng)?.objective ?? null
    );
  }

  // Picking movement before category is the whole trick: it keeps "stay here"
  // versus "go somewhere else" readable and tunable without encoding that logic
  // into every single objective weight.
  const movementBuckets = buildWeightedObjectivesByMovement(
    allWeightedEntries,
    nextContext.currentArea
  );
  const movementScores = buildMovementClassScores(movementBuckets, nextContext);
  const selectedMovement = weightedPick(
    MOVEMENT_CLASSES,
    (movementClass) => movementScores[movementClass] ?? 0,
    nextContext.rng
  );

  if (!selectedMovement) {
    return null;
  }

  const selectedMovementEntries = movementBuckets[selectedMovement] ?? [];
  const movementCategories = buildWeightedEntryCategories(selectedMovementEntries);
  const selectedCategory = weightedPick(
    DRILL_CATEGORY_KEYS,
    (category) => buildCategoryScore(category, movementCategories[category] ?? [], nextContext),
    nextContext.rng
  );

  if (!selectedCategory) {
    return null;
  }

  return weightedPick(
    movementCategories[selectedCategory] ?? [],
    (entry) => entry.weight,
    nextContext.rng
  )?.objective ?? null;
}
