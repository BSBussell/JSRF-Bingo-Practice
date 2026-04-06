import { areasByDistrict, objectiveAreaOrder } from "../data/areaMeta.js";
import { DRILL_CATEGORIES } from "./drillCategories.js";

export const CATEGORY_VARIANCE_MIN = -3;
export const CATEGORY_VARIANCE_MAX = 2;
export const MOVEMENT_VARIANCE_MIN = -2;
export const MOVEMENT_VARIANCE_MAX = 2;
export const VARIANCE_STEP = 1;

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

export const CATEGORY_VARIANCE_FIELDS = DRILL_CATEGORIES.map((category) => ({
    key: category.settingKey,
    label: `${category.label} Variance`,
}));

export const DRILL_MOVEMENT_FIELDS = [
    {
        key: "levelShift",
        label: "Level Shift",
    },
    {
        key: "districtShift",
        label: "District Shift",
    },
];

export const DEFAULT_DRILL_SETTINGS = {
    excludedAreas: [],
    graffitiVariance: -2,
    unlockVariance: -1,
    defaultVariance: 0,
    notebookVariance: 0,
    levelShift: 0,
    districtShift: -1,
    trueRandom: false,
};

function fallbackNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
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

export function normalizeDrillSettings(value) {
    if (!value || typeof value !== "object") {
        return {
            ...DEFAULT_DRILL_SETTINGS,
            excludedAreas: [],
        };
    }

    const excludedAreas = Array.isArray(value.excludedAreas)
        ? value.excludedAreas.filter(
              (area, index, areas) =>
                  typeof area === "string" &&
                  objectiveAreaOrder.includes(area) &&
                  areas.indexOf(area) === index,
          )
        : [];

    return {
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
        trueRandom:
            typeof value.trueRandom === "boolean"
                ? value.trueRandom
                : DEFAULT_DRILL_SETTINGS.trueRandom,
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
