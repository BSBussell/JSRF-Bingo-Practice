import { getAreaLabel } from "../../data/areaMeta.js";
import { objectivesById } from "../../data/objectives.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE,
  normalizeSessionType
} from "./sessionTypes.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function scoreDurationMs(entry) {
  if (isFiniteNumber(entry?.challengeDurationMs)) {
    return entry.challengeDurationMs;
  }

  if (isFiniteNumber(entry?.durationMs)) {
    return entry.durationMs;
  }

  return null;
}

function buildDurationFact(key, label, durationMs, options = {}) {
  if (!isFiniteNumber(durationMs)) {
    return null;
  }

  return {
    key,
    label,
    valueType: "duration",
    durationMs,
    tone: options.tone ?? "neutral",
    detail: options.detail ?? ""
  };
}

function compactFacts(facts) {
  return facts.filter(Boolean);
}

function sessionEntries(history, completionSummary, sessionType) {
  if (!completionSummary?.sessionId || !Array.isArray(history)) {
    return [];
  }

  return history.filter((entry) =>
    entry?.sessionId === completionSummary.sessionId &&
    normalizeSessionType(entry.sessionType) === sessionType
  );
}

function objectiveSplitFact(key, label, entries, pickBetter) {
  const pickedEntry = entries.reduce((selected, entry) => {
    const durationMs = scoreDurationMs(entry);
    if (!isFiniteNumber(durationMs)) {
      return selected;
    }

    if (!selected || pickBetter(durationMs, selected.durationMs)) {
      return {
        entry,
        durationMs
      };
    }

    return selected;
  }, null);

  if (!pickedEntry) {
    return null;
  }

  return {
    key,
    label,
    valueType: "duration",
    durationMs: pickedEntry.durationMs,
    detailSegments: buildObjectiveDetailSegments(pickedEntry.entry),
    tone: "neutral"
  };
}

function buildObjectiveDetailSegments(entry) {
  const fallbackLabel = entry?.label ?? "Completed objective";
  const areaLabel = entry?.area ? getAreaLabel(entry.area) : "";

  if (!areaLabel) {
    return [
      {
        label: fallbackLabel,
        district: ""
      }
    ];
  }

  const labelPrefix = `${areaLabel} - `;
  const objectiveLabel = fallbackLabel.startsWith(labelPrefix)
    ? fallbackLabel.slice(labelPrefix.length)
    : fallbackLabel;

  return [
    {
      label: areaLabel,
      district: entry?.district ?? ""
    },
    {
      label: "-",
      district: "",
      separator: true
    },
    {
      label: objectiveLabel,
      district: ""
    }
  ];
}

function practiceSeedHistoryEntries(history, completionSummary) {
  const exportSeed = completionSummary?.exportSeed;

  if (!exportSeed || !Array.isArray(history)) {
    return [];
  }

  return history.filter((entry) =>
    normalizeSessionType(entry?.sessionType) === PRACTICE_SESSION_TYPE &&
    entry.result === "complete" &&
    entry.exportSeed === exportSeed &&
    entry.sessionCompleted === true &&
    isFiniteNumber(entry.sessionTotalDurationMs)
  );
}

function buildPracticeSeedPbStatus(completionSummary, history) {
  const totalDurationMs = completionSummary?.totalDurationMs;
  const exportSeed = completionSummary?.exportSeed;

  if (!exportSeed || !isFiniteNumber(totalDurationMs)) {
    return null;
  }

  const seedEntries = practiceSeedHistoryEntries(history, completionSummary);
  const priorEntries = seedEntries.filter((entry) =>
    entry.sessionId !== completionSummary.sessionId
  );
  const previousBestMs = priorEntries.reduce((bestMs, entry) =>
    bestMs === null
      ? entry.sessionTotalDurationMs
      : Math.min(bestMs, entry.sessionTotalDurationMs),
  null);

  if (previousBestMs === null) {
    return {
      key: "practiceSeedPbStatus",
      label: "Seed PB",
      valueType: "seed-pb-status",
      status: "no-prior",
      tone: "neutral"
    };
  }

  return {
    key: "practiceSeedPbStatus",
    label: "Seed PB",
    valueType: "seed-pb-status",
    status: totalDurationMs < previousBestMs ? "new-pb" : "delta",
    pbDurationMs: previousBestMs,
    deltaMs: totalDurationMs - previousBestMs,
    tone: totalDurationMs < previousBestMs ? "win" : "neutral"
  };
}

function buildPracticeAttemptFact(completionSummary, history) {
  if (!completionSummary?.exportSeed) {
    return null;
  }

  const seedEntries = practiceSeedHistoryEntries(history, completionSummary);
  const includesCurrentAttempt = seedEntries.some((entry) =>
    entry.sessionId === completionSummary.sessionId
  );
  const attempts = seedEntries.length + (includesCurrentAttempt ? 0 : 1);

  return {
    key: "practiceSeedAttempts",
    label: "Seed Attempts",
    valueType: "count",
    count: Math.max(1, attempts),
    detail: "",
    tone: "neutral"
  };
}

function buildPracticeCompletionRecap(completionSummary, history) {
  const completedEntries = sessionEntries(
    history,
    completionSummary,
    PRACTICE_SESSION_TYPE
  ).filter((entry) => entry?.result === "complete");
  const attempts = buildPracticeAttemptFact(completionSummary, history);

  return {
    sessionType: PRACTICE_SESSION_TYPE,
    attempts,
    facts: compactFacts([
      buildDurationFact("totalTime", "Total Time", completionSummary?.totalDurationMs),
      buildPracticeSeedPbStatus(completionSummary, history),
      objectiveSplitFact(
        "fastestObjective",
        "Fastest Objective",
        completedEntries,
        (durationMs, selectedDurationMs) => durationMs < selectedDurationMs
      ),
      objectiveSplitFact(
        "slowestObjective",
        "Slowest Objective",
        completedEntries,
        (durationMs, selectedDurationMs) => durationMs > selectedDurationMs
      )
    ])
  };
}

function routeSeedHistoryEntries(history, completionSummary) {
  const exportSeed = completionSummary?.exportSeed;

  if (!exportSeed || !Array.isArray(history)) {
    return [];
  }

  return history.filter((entry) =>
    normalizeSessionType(entry?.sessionType) === ROUTE_SESSION_TYPE &&
    entry.result === "complete" &&
    entry.exportSeed === exportSeed &&
    isFiniteNumber(entry.totalDurationMs)
  );
}

function buildRouteSeedPbStatus(completionSummary, history) {
  const totalDurationMs = completionSummary?.totalDurationMs;
  const exportSeed = completionSummary?.exportSeed;

  if (!exportSeed || !isFiniteNumber(totalDurationMs)) {
    return null;
  }

  const seedEntries = routeSeedHistoryEntries(history, completionSummary);
  const priorEntries = seedEntries.filter((entry) =>
    entry.sessionId !== completionSummary.sessionId
  );
  const previousBestMs = priorEntries.reduce((bestMs, entry) => {
    if (!isFiniteNumber(entry.totalDurationMs)) {
      return bestMs;
    }

    return bestMs === null ? entry.totalDurationMs : Math.min(bestMs, entry.totalDurationMs);
  }, null);

  if (previousBestMs === null) {
    return {
      key: "routeSeedPbStatus",
      label: "Seed PB",
      valueType: "seed-pb-status",
      status: "no-prior",
      tone: "neutral"
    };
  }

  return {
    key: "routeSeedPbStatus",
    label: "Seed PB",
    valueType: "seed-pb-status",
    status: totalDurationMs < previousBestMs ? "new-pb" : "delta",
    pbDurationMs: previousBestMs,
    deltaMs: totalDurationMs - previousBestMs,
    tone: totalDurationMs < previousBestMs ? "win" : "neutral"
  };
}

function buildRouteAttemptFact(completionSummary, history) {
  if (!completionSummary?.exportSeed) {
    return null;
  }

  const seedEntries = routeSeedHistoryEntries(history, completionSummary);
  const includesCurrentAttempt = seedEntries.some((entry) =>
    entry.sessionId === completionSummary.sessionId
  );
  const attempts = seedEntries.length + (includesCurrentAttempt ? 0 : 1);

  return {
    key: "routeSeedAttempts",
    label: "Seed Attempts",
    valueType: "count",
    count: Math.max(1, attempts),
    detail: "",
    tone: "neutral"
  };
}

function normalizedRouteClearEvents(completionSummary) {
  if (!Array.isArray(completionSummary?.routeClearEvents)) {
    return [];
  }

  return completionSummary.routeClearEvents
    .map((event) => ({
      objectiveId: typeof event?.objectiveId === "string" ? event.objectiveId : null,
      elapsedMs: isFiniteNumber(event?.elapsedMs) ? Math.max(0, event.elapsedMs) : null
    }))
    .filter((event) => event.objectiveId && event.elapsedMs !== null)
    .sort((left, right) => left.elapsedMs - right.elapsedMs);
}

function formatRouteGapObjectiveLabel(objective, fallbackLabel) {
  if (!objective) {
    return fallbackLabel;
  }

  const areaLabel = getAreaLabel(objective.area);
  const areaPrefix = `${areaLabel} - `;
  const objectiveLabel = objective.label.startsWith(areaPrefix)
    ? objective.label.slice(areaPrefix.length)
    : objective.label;

  return `${areaLabel} ${objectiveLabel}`;
}

function buildRouteGapEndpoint(objectiveId) {
  const objective = objectivesById[objectiveId] ?? null;

  return {
    label: formatRouteGapObjectiveLabel(objective, objectiveId),
    district: objective?.district ?? ""
  };
}

function buildRouteGapDetailSegments(fromEvent, toEvent) {
  if (!fromEvent?.objectiveId || !toEvent?.objectiveId) {
    return [];
  }

  return [
    buildRouteGapEndpoint(fromEvent.objectiveId),
    {
      label: ">",
      district: "",
      separator: true
    },
    buildRouteGapEndpoint(toEvent.objectiveId)
  ];
}

function buildRouteGapFacts(clearEvents) {
  if (clearEvents.length <= 1) {
    return [];
  }

  const gaps = [];
  for (let index = 1; index < clearEvents.length; index += 1) {
    gaps.push({
      durationMs: Math.max(0, clearEvents[index].elapsedMs - clearEvents[index - 1].elapsedMs),
      fromEvent: clearEvents[index - 1],
      toEvent: clearEvents[index]
    });
  }

  const totalGapMs = gaps.reduce((sum, gap) => sum + gap.durationMs, 0);
  const averageGapMs = Math.round(totalGapMs / gaps.length);
  const longestGap = gaps.reduce((selected, gap) =>
    !selected || gap.durationMs > selected.durationMs ? gap : selected,
  null);

  return compactFacts([
    buildDurationFact("routeAverageGap", "Average Gap", averageGapMs),
    longestGap
      ? {
          ...buildDurationFact("routeLongestGap", "Longest Gap", longestGap.durationMs),
          detailSegments: buildRouteGapDetailSegments(longestGap.fromEvent, longestGap.toEvent)
        }
      : null
  ]);
}

function buildRouteCompletionRecap(completionSummary, history) {
  const clearEvents = normalizedRouteClearEvents(completionSummary);
  const attempts = buildRouteAttemptFact(completionSummary, history);

  return {
    sessionType: ROUTE_SESSION_TYPE,
    attempts,
    facts: compactFacts([
      buildDurationFact("totalTime", "Total Time", completionSummary?.totalDurationMs),
      buildRouteSeedPbStatus(completionSummary, history),
      ...buildRouteGapFacts(clearEvents)
    ])
  };
}

export function buildCompletionRecap({
  completionSummary,
  history = []
}) {
  if (!completionSummary) {
    return null;
  }

  const sessionType = normalizeSessionType(completionSummary.sessionType);

  if (sessionType === ROUTE_SESSION_TYPE) {
    return buildRouteCompletionRecap(completionSummary, history);
  }

  return buildPracticeCompletionRecap(completionSummary, history);
}
