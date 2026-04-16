import { areasByDistrict, objectiveAreaOrder } from "../../data/areaMeta.js";
import { allObjectives } from "../../data/objectives.js";
import {
    DEFAULT_ROUTE_REVEAL_MODE,
    normalizeRouteRevealMode
} from "../session/routeRevealMode.js";
import {
    DRILL_CATEGORY_BY_KEY,
    DRILL_CATEGORIES,
    getObjectiveCategory,
} from "./drillCategories.js";

export const CATEGORY_VARIANCE_MIN = -3;
export const CATEGORY_VARIANCE_MAX = 2;
export const MOVEMENT_VARIANCE_MIN = -2;
export const MOVEMENT_VARIANCE_MAX = 2;
export const VARIANCE_STEP = 1;
export const NUMBER_OF_OBJECTIVES_MIN = 1;
export const NUMBER_OF_OBJECTIVES_MAX = 123;
export const ROUTE_VISIBLE_COUNT_MIN = 2;
export const ROUTE_VISIBLE_COUNT_MAX = 10;
export const DISTRICT_JUMP_DEPTHS = [0, 1, 2];
export const LEVEL_SHIFT_LENGTHS = [1, 2];
export const DISTRICT_JUMP_DISTRIBUTION_TOTAL = 100;
export const DISTRICT_JUMP_BOUNDARY_STEP = 1;
export const LEVEL_SHIFT_DISTRIBUTION_TOTAL = DISTRICT_JUMP_DISTRIBUTION_TOTAL;
export const LEVEL_SHIFT_BOUNDARY_STEP = DISTRICT_JUMP_BOUNDARY_STEP;

export const VARIANCE_LABELS = {
    [-3]: "None",
    [-2]: "Much less",
    [-1]: "Less",
    0: "Unweighted",
    1: "More",
    2: "Much more",
};

export const MOVEMENT_LABELS = {
    [-2]: "Much less",
    [-1]: "Less",
    0: "Default",
    1: "More",
    2: "Always",
};

export const LEGACY_DISTRICT_JUMP_TENDENCY_DISTRIBUTIONS = {
    0: {
        0: 100,
        1: 0,
        2: 0,
    },
    1: {
        0: 70,
        1: 20,
        2: 10,
    },
    2: {
        0: 50,
        1: 30,
        2: 20,
    },
};

export const DEFAULT_DISTRICT_JUMP_DISTRIBUTION = [75, 15, 10];
export const DEFAULT_LEVEL_SHIFT_DISTRIBUTION = [80, 20];

export const CATEGORY_VARIANCE_FIELDS = DRILL_CATEGORIES.map((category) => ({
    key: category.settingKey,
    label: `${category.label} Variance`,
}));

export const DRILL_MOVEMENT_FIELDS = [
    {
        key: "levelShift",
        label: "Level Shift",
        description: "How often you move to a new level.",
    },
    {
        key: "districtShift",
        label: "District Shift",
        description: "How often a level shift crosses districts.",
    },
];

export const DEFAULT_DRILL_SETTINGS = {
    numberOfObjectives: 25,
    routeVisibleCount: 4,
    routeRevealMode: DEFAULT_ROUTE_REVEAL_MODE,
    excludedAreas: [],
    graffitiVariance: -2,
    unlockVariance: -1,
    defaultVariance: 0,
    notebookVariance: 0,
    levelShift: 0,
    districtShift: -1,
    levelShiftDistribution: DEFAULT_LEVEL_SHIFT_DISTRIBUTION,
    districtJumpDistribution: DEFAULT_DISTRICT_JUMP_DISTRIBUTION,
    trueRandom: false,
};

function fallbackNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function clampNumberOfObjectives(value, maxValue = NUMBER_OF_OBJECTIVES_MAX) {
    if (!Number.isFinite(value)) {
        return DEFAULT_DRILL_SETTINGS.numberOfObjectives;
    }

    return Math.max(
        NUMBER_OF_OBJECTIVES_MIN,
        Math.min(maxValue, Math.round(value)),
    );
}

function clampRouteVisibleCount(value) {
    if (!Number.isFinite(value)) {
        return DEFAULT_DRILL_SETTINGS.routeVisibleCount;
    }

    return Math.max(
        ROUTE_VISIBLE_COUNT_MIN,
        Math.min(ROUTE_VISIBLE_COUNT_MAX, Math.round(value)),
    );
}

function clampCategoryVariance(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(
        CATEGORY_VARIANCE_MIN,
        Math.min(CATEGORY_VARIANCE_MAX, Math.round(value)),
    );
}

function clampMovementVariance(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(
        MOVEMENT_VARIANCE_MIN,
        Math.min(MOVEMENT_VARIANCE_MAX, Math.round(value)),
    );
}

function roundNormalizedShares(values, total) {
    const scaledValues = values.map((value) => (value / total) * DISTRICT_JUMP_DISTRIBUTION_TOTAL);
    const flooredValues = scaledValues.map((value) => Math.floor(value));
    let remainder = DISTRICT_JUMP_DISTRIBUTION_TOTAL -
        flooredValues.reduce((sum, value) => sum + value, 0);
    const fractionalRanks = scaledValues
        .map((value, index) => ({
            index,
            remainder: value - flooredValues[index],
        }))
        .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

    for (let index = 0; index < fractionalRanks.length && remainder > 0; index += 1) {
        flooredValues[fractionalRanks[index].index] += 1;
        remainder -= 1;
    }

    return flooredValues;
}

function normalizeExplicitDistribution(rawDistribution, defaultDistribution) {
    const normalizedValues = defaultDistribution.map((_, index) => {
        const nextValue = rawDistribution?.[index];
        return Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
    });
    const sum = normalizedValues.reduce((total, entry) => total + entry, 0);

    if (sum <= 0) {
        return defaultDistribution.slice();
    }

    return roundNormalizedShares(normalizedValues, sum);
}

function buildDistributionBoundaries(distribution, normalizeDistribution) {
    const normalizedDistribution = normalizeDistribution(distribution);
    const boundaries = [];
    let runningTotal = 0;

    for (let index = 0; index < normalizedDistribution.length - 1; index += 1) {
        runningTotal += normalizedDistribution[index];
        boundaries.push(runningTotal);
    }

    return boundaries;
}

function buildDistributionFromBoundaries(
    boundaries,
    defaultDistribution,
    distributionTotal = DISTRICT_JUMP_DISTRIBUTION_TOTAL,
) {
    const normalizedDefault = normalizeExplicitDistribution(
        defaultDistribution,
        defaultDistribution,
    );
    const nextDistribution = [];
    let previousBoundary = 0;

    for (let index = 0; index < normalizedDefault.length - 1; index += 1) {
        const fallbackBoundary = previousBoundary + normalizedDefault[index];
        const nextBoundary = Number.isFinite(boundaries?.[index])
            ? Math.max(
                  previousBoundary,
                  Math.min(distributionTotal, Math.round(boundaries[index])),
              )
            : fallbackBoundary;
        nextDistribution.push(nextBoundary - previousBoundary);
        previousBoundary = nextBoundary;
    }

    nextDistribution.push(distributionTotal - previousBoundary);
    return nextDistribution;
}

function deriveNotebookVariance(value) {
    if (Number.isFinite(value?.notebookVariance)) {
        return clampCategoryVariance(value.notebookVariance);
    }

    const legacyNotebookValues = [
        value?.pointsVariance,
        value?.grindVariance,
        value?.specialVariance,
        value?.tricksVariance,
        value?.airVariance,
    ].filter(Number.isFinite);

    if (legacyNotebookValues.length === 0) {
        return DEFAULT_DRILL_SETTINGS.notebookVariance;
    }

    const sum = legacyNotebookValues.reduce((total, entry) => total + entry, 0);
    return clampCategoryVariance(sum / legacyNotebookValues.length);
}

function isObjectiveEnabledBySettings(objective, drillSettings) {
    if (drillSettings.excludedAreas.includes(objective.area)) {
        return false;
    }

    if (drillSettings.trueRandom) {
        return true;
    }

    const category = getObjectiveCategory(objective.type);
    const categorySettingKey = DRILL_CATEGORY_BY_KEY[category]?.settingKey;

    if (!categorySettingKey) {
        return true;
    }

    return drillSettings[categorySettingKey] > CATEGORY_VARIANCE_MIN;
}

export function getAvailableObjectiveCount(drillSettings, objectives = allObjectives) {
    if (!Array.isArray(objectives) || objectives.length === 0) {
        return 0;
    }

    return objectives.filter((objective) => isObjectiveEnabledBySettings(objective, drillSettings))
        .length;
}

function legacyDistrictJumpDistribution(value) {
    const legacyScalar = Number.isFinite(value?.districtJumpTendency)
        ? value.districtJumpTendency
        : Number.isFinite(value?.districtJumpDepth)
            ? value.districtJumpDepth
            : null;

    if (!Number.isFinite(legacyScalar)) {
        return DEFAULT_DISTRICT_JUMP_DISTRIBUTION;
    }

    const normalizedScalar = Math.max(
        0,
        Math.min(
            Object.keys(LEGACY_DISTRICT_JUMP_TENDENCY_DISTRIBUTIONS).length - 1,
            Math.round(legacyScalar),
        ),
    );
    const legacyDistribution = LEGACY_DISTRICT_JUMP_TENDENCY_DISTRIBUTIONS[normalizedScalar];

    return DISTRICT_JUMP_DEPTHS.map((depth) => legacyDistribution?.[depth] ?? 0);
}

export function normalizeDistrictJumpDistribution(value) {
    const rawDistribution = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray(value.districtJumpDistribution)
            ? value.districtJumpDistribution
            : legacyDistrictJumpDistribution(value);
    return normalizeExplicitDistribution(
        rawDistribution,
        DEFAULT_DISTRICT_JUMP_DISTRIBUTION,
    );
}

export function normalizeLevelShiftDistribution(value) {
    const rawDistribution = Array.isArray(value)
        ? value
        : value && typeof value === "object" && Array.isArray(value.levelShiftDistribution)
            ? value.levelShiftDistribution
            : DEFAULT_LEVEL_SHIFT_DISTRIBUTION;

    return normalizeExplicitDistribution(
        rawDistribution,
        DEFAULT_LEVEL_SHIFT_DISTRIBUTION,
    );
}

export function buildDistrictJumpBoundaries(distribution) {
    return buildDistributionBoundaries(
        distribution,
        normalizeDistrictJumpDistribution,
    );
}

export function buildDistrictJumpDistributionFromBoundaries(boundaries) {
    return buildDistributionFromBoundaries(
        boundaries,
        DEFAULT_DISTRICT_JUMP_DISTRIBUTION,
    );
}

export function buildLevelShiftBoundaries(distribution) {
    return buildDistributionBoundaries(
        distribution,
        normalizeLevelShiftDistribution,
    );
}

export function buildLevelShiftDistributionFromBoundaries(boundaries) {
    return buildDistributionFromBoundaries(
        boundaries,
        DEFAULT_LEVEL_SHIFT_DISTRIBUTION,
        LEVEL_SHIFT_DISTRIBUTION_TOTAL,
    );
}

export function normalizeDrillSettings(value) {
    if (!value || typeof value !== "object") {
        return {
            ...DEFAULT_DRILL_SETTINGS,
            levelShiftDistribution: DEFAULT_LEVEL_SHIFT_DISTRIBUTION.slice(),
            districtJumpDistribution: DEFAULT_DISTRICT_JUMP_DISTRIBUTION.slice(),
            excludedAreas: [],
        };
    }

    const excludedAreas = Array.isArray(value.excludedAreas)
        ? value.excludedAreas
              .filter(
                  (area, index, areas) =>
                      typeof area === "string" &&
                      objectiveAreaOrder.includes(area) &&
                      areas.indexOf(area) === index,
              )
              .sort(
                  (left, right) =>
                      objectiveAreaOrder.indexOf(left) -
                      objectiveAreaOrder.indexOf(right),
              )
        : [];

    const normalizedSettings = {
        routeVisibleCount: clampRouteVisibleCount(
            fallbackNumber(
                value.routeVisibleCount,
                DEFAULT_DRILL_SETTINGS.routeVisibleCount,
            ),
        ),
        routeRevealMode: normalizeRouteRevealMode(value.routeRevealMode),
        excludedAreas,
        graffitiVariance: clampCategoryVariance(
            fallbackNumber(
                value.graffitiVariance,
                DEFAULT_DRILL_SETTINGS.graffitiVariance,
            ),
        ),
        unlockVariance: clampCategoryVariance(
            fallbackNumber(
                value.unlockVariance,
                DEFAULT_DRILL_SETTINGS.unlockVariance,
            ),
        ),
        defaultVariance: clampCategoryVariance(
            fallbackNumber(
                value.defaultVariance,
                DEFAULT_DRILL_SETTINGS.defaultVariance,
            ),
        ),
        notebookVariance: deriveNotebookVariance(value),
        levelShift: clampMovementVariance(
            fallbackNumber(
                Number.isFinite(value.levelShift)
                    ? value.levelShift
                    : value.depthSwing,
                DEFAULT_DRILL_SETTINGS.levelShift,
            ),
        ),
        districtShift: clampMovementVariance(
            fallbackNumber(
                value.districtShift,
                DEFAULT_DRILL_SETTINGS.districtShift,
            ),
        ),
        levelShiftDistribution: normalizeLevelShiftDistribution(value),
        districtJumpDistribution: normalizeDistrictJumpDistribution(value),
        trueRandom:
            typeof value.trueRandom === "boolean"
                ? value.trueRandom
                : DEFAULT_DRILL_SETTINGS.trueRandom,
    };

    const availableObjectiveCount = getAvailableObjectiveCount(normalizedSettings);
    const effectiveObjectiveMax = Math.max(
        NUMBER_OF_OBJECTIVES_MIN,
        Math.min(NUMBER_OF_OBJECTIVES_MAX, availableObjectiveCount),
    );

    return {
        ...normalizedSettings,
        numberOfObjectives: clampNumberOfObjectives(
            fallbackNumber(
                value.numberOfObjectives,
                DEFAULT_DRILL_SETTINGS.numberOfObjectives,
            ),
            effectiveObjectiveMax,
        ),
    };
}

export function toggleAreaExclusion(excludedAreas, area) {
    return excludedAreas.includes(area)
        ? excludedAreas.filter((entry) => entry !== area)
        : [...excludedAreas, area];
}

export function setDistrictExclusion(excludedAreas, district, excluded) {
    const districtAreaSet = new Set(
        areasByDistrict.find((entry) => entry.district === district)?.areas ??
            [],
    );
    const nextExcludedAreas = excludedAreas.filter(
        (area) => !districtAreaSet.has(area),
    );

    if (!excluded) {
        return nextExcludedAreas;
    }

    return [...nextExcludedAreas, ...districtAreaSet];
}

export function isAreaExcluded(drillSettings, area) {
    return drillSettings.excludedAreas.includes(area);
}

export function isDistrictExcluded(drillSettings, district) {
    return areasByDistrict
        .find((entry) => entry.district === district)
        ?.areas.every((area) => isAreaExcluded(drillSettings, area));
}

export function categoryVarianceMultiplier(value) {
    if (value <= -3) return 0;
    if (value === -2) return 0.18;
    if (value === -1) return 0.5;
    if (value === 1) return 2.25;
    if (value >= 2) return 5;
    return 1;
}

export function movementTargetShare(value) {
    if (value <= -2) return 0.1;
    if (value === -1) return 0.25;
    if (value === 1) return 0.75;
    if (value >= 2) return 1;
    return 0.5;
}
