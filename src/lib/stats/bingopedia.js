import { areaLabels, areasByDistrict, districtLabels } from "../../data/areaMeta.js";
import { allObjectives } from "../../data/objectives.js";
import { objectiveRequiresTape } from "../session/drillSession.js";
import { PRACTICE_SESSION_TYPE, normalizeSessionType } from "../session/sessionTypes.js";

export const BINGOPEDIA_FILTERS = Object.freeze({
  ALL: "all",
  GRAFFITI: "graffiti",
  DEFAULT_SOULS: "default-souls",
  TAPE_SOULS: "tape-souls",
  UNLOCKS: "unlocks",
  NEVER_PRACTICED: "never-practiced"
});

const RECENT_ATTEMPT_LIMIT = 5;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatSearchText(objective) {
  return normalizeSearchText([
    objective.id,
    objective.label,
    objective.description,
    objective.area,
    objective.areaLabel,
    objective.district,
    objective.type,
    objective.sourceGroup
  ].join(" "));
}

function practiceEntriesForObjective(history, objectiveId) {
  return (Array.isArray(history) ? history : [])
    .filter((entry) =>
      normalizeSessionType(entry?.sessionType) === PRACTICE_SESSION_TYPE &&
      entry.objectiveId === objectiveId &&
      (entry.result === "complete" || entry.result === "skip")
    )
    .slice()
    .sort((left, right) => {
      const leftTime = isFiniteNumber(left?.endedAt) ? left.endedAt : 0;
      const rightTime = isFiniteNumber(right?.endedAt) ? right.endedAt : 0;
      return rightTime - leftTime;
    });
}

function buildRecentAttempt(entry) {
  return {
    result: entry.result,
    endedAt: isFiniteNumber(entry.endedAt) ? entry.endedAt : null,
    durationMs: isFiniteNumber(entry.durationMs) ? entry.durationMs : null,
    challengeDurationMs: isFiniteNumber(entry.challengeDurationMs)
      ? entry.challengeDurationMs
      : null,
    totalDurationMs: isFiniteNumber(entry.totalDurationMs) ? entry.totalDurationMs : null,
    sessionId: typeof entry.sessionId === "string" ? entry.sessionId : ""
  };
}

function objectiveStats({
  objective,
  history,
  bestTimesByObjective,
  aggregateStats
}) {
  const entries = practiceEntriesForObjective(history, objective.id);
  const clearEntries = entries.filter((entry) => entry.result === "complete");
  const clearDurations = clearEntries
    .map((entry) => entry.durationMs)
    .filter(isFiniteNumber);
  const bestRecord = bestTimesByObjective?.[objective.id];
  const pbMs = isFiniteNumber(bestRecord?.durationMs)
    ? bestRecord.durationMs
    : clearDurations.length > 0
      ? Math.min(...clearDurations)
      : null;
  const lastClear = clearEntries.find((entry) => isFiniteNumber(entry.endedAt));
  const needsTape = objectiveRequiresTape(objective.type);

  return {
    attempts: entries.length,
    clears: clearEntries.length,
    skips: entries.length - clearEntries.length,
    pbMs,
    averageMs:
      clearDurations.length > 0
        ? Math.round(clearDurations.reduce((sum, value) => sum + value, 0) / clearDurations.length)
        : null,
    lastClearAt: lastClear && isFiniteNumber(lastClear.endedAt) ? lastClear.endedAt : null,
    recentAttempts: entries.slice(0, RECENT_ATTEMPT_LIMIT).map(buildRecentAttempt),
    needsTape,
    tapePbMs:
      needsTape && isFiniteNumber(aggregateStats?.tapeByArea?.[objective.area]?.bestMs)
        ? aggregateStats.tapeByArea[objective.area].bestMs
        : null
  };
}

function buildSquareRow(objective, options) {
  const stats = objectiveStats({
    objective,
    history: options.history,
    bestTimesByObjective: options.bestTimesByObjective,
    aggregateStats: options.aggregateStats
  });

  return {
    id: objective.id,
    objective,
    area: objective.area,
    areaLabel: areaLabels[objective.area] ?? objective.areaLabel ?? objective.area,
    district: objective.district,
    districtLabel: districtLabels[objective.district] ?? objective.district,
    label: objective.label,
    description: objective.description,
    type: objective.type,
    runClass: objective.runClass,
    searchText: formatSearchText(objective),
    ...stats
  };
}

function summarizeArea(area, squareRows) {
  const clearedCount = squareRows.filter((row) => row.clears > 0).length;
  const pbRows = squareRows.filter((row) => isFiniteNumber(row.pbMs));
  const bestPbMs = pbRows.length > 0 ? Math.min(...pbRows.map((row) => row.pbMs)) : null;

  return {
    area,
    label: areaLabels[area] ?? area,
    squareCount: squareRows.length,
    clearedCount,
    bestPbMs,
    squares: squareRows
  };
}

export function buildBingopediaViewModel(options = {}) {
  const objectives = Array.isArray(options.objectives) ? options.objectives : allObjectives;
  const history = Array.isArray(options.history) ? options.history : [];
  const bestTimesByObjective =
    options.bestTimesByObjective && typeof options.bestTimesByObjective === "object"
      ? options.bestTimesByObjective
      : {};
  const aggregateStats =
    options.aggregateStats && typeof options.aggregateStats === "object"
      ? options.aggregateStats
      : {};
  const squareRows = objectives.map((objective) =>
    buildSquareRow(objective, {
      history,
      bestTimesByObjective,
      aggregateStats
    })
  );
  const squaresByArea = squareRows.reduce((areas, row) => {
    if (!areas[row.area]) {
      areas[row.area] = [];
    }

    areas[row.area].push(row);
    return areas;
  }, {});
  const districts = areasByDistrict.map((district) => ({
    district: district.district,
    label: district.label,
    areas: district.areas.map((area) => summarizeArea(area, squaresByArea[area] ?? []))
  }));

  return {
    districts,
    squares: squareRows,
    squaresByArea,
    areaSummaries: Object.fromEntries(
      districts.flatMap((district) =>
        district.areas.map((areaSummary) => [areaSummary.area, areaSummary])
      )
    )
  };
}

export function filterBingopediaSquares(squareRows, options = {}) {
  const query = normalizeSearchText(options.search);
  const filter = options.filter ?? BINGOPEDIA_FILTERS.ALL;

  return (Array.isArray(squareRows) ? squareRows : []).filter((row) => {
    if (query && !row.searchText.includes(query)) {
      return false;
    }

    if (filter === BINGOPEDIA_FILTERS.GRAFFITI) {
      return row.type === "graffiti";
    }

    if (filter === BINGOPEDIA_FILTERS.DEFAULT_SOULS) {
      return row.type === "default";
    }

    if (filter === BINGOPEDIA_FILTERS.TAPE_SOULS) {
      return row.needsTape;
    }

    if (filter === BINGOPEDIA_FILTERS.UNLOCKS) {
      return row.type === "unlock";
    }

    if (filter === BINGOPEDIA_FILTERS.NEVER_PRACTICED) {
      return row.attempts === 0;
    }

    return true;
  });
}

export function groupBingopediaSquaresByArea(squareRows) {
  const groups = new Map();

  for (const row of Array.isArray(squareRows) ? squareRows : []) {
    const current = groups.get(row.area) ?? {
      area: row.area,
      label: row.areaLabel,
      district: row.district,
      districtLabel: row.districtLabel,
      squares: []
    };
    current.squares.push(row);
    groups.set(row.area, current);
  }

  return Array.from(groups.values());
}
