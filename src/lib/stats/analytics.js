import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE,
  normalizeSessionType
} from "../session/sessionTypes.js";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function seedReference(exportSeed) {
  if (typeof exportSeed !== "string" || !exportSeed) {
    return {
      prefix: "",
      preview: "Seed unavailable",
      label: "Seed unavailable"
    };
  }

  const [prefix, ...payloadParts] = exportSeed.split(".");
  const payload = payloadParts.join(".") || exportSeed;
  const preview = `${payload.slice(0, 7)}${payload.length > 7 ? "…" : ""}`;

  return {
    prefix: payloadParts.length > 0 ? prefix : "",
    preview,
    label: payloadParts.length > 0 ? `${prefix} ${preview}` : preview
  };
}

function seedNameForExport(seedNamesByExportSeed, exportSeed) {
  const name = seedNamesByExportSeed?.[exportSeed];
  return typeof name === "string" && name.trim() ? name.trim() : "";
}

function sortedByEndedAt(entries) {
  return entries.slice().sort((left, right) => {
    const leftTime = isFiniteNumber(left?.endedAt) ? left.endedAt : 0;
    const rightTime = isFiniteNumber(right?.endedAt) ? right.endedAt : 0;
    return leftTime - rightTime;
  });
}

function buildSeedRows(entries, sessionType, seedNamesByExportSeed) {
  const rowsBySeed = new Map();

  for (const entry of entries) {
    const exportSeed = entry?.exportSeed;
    if (typeof exportSeed !== "string" || !exportSeed) {
      continue;
    }

    const durationMs =
      sessionType === PRACTICE_SESSION_TYPE
        ? entry.sessionTotalDurationMs
        : entry.totalDurationMs;
    if (!isFiniteNumber(durationMs)) {
      continue;
    }

    const reference = seedReference(exportSeed);
    const customName = seedNameForExport(seedNamesByExportSeed, exportSeed);
    const current = rowsBySeed.get(exportSeed) ?? {
      sessionType,
      exportSeed,
      seedPrefix: reference.prefix,
      seedPreview: reference.preview,
      seedLabel: reference.label,
      customName,
      displayName: customName || reference.label,
      objectiveCount: null,
      attempts: 0,
      firstDurationMs: null,
      latestDurationMs: null,
      latestEndedAt: null,
      pbDurationMs: null,
      pbEndedAt: null,
      latestDeltaMs: null,
      firstToBestDeltaMs: null,
      visibleCount: null,
      routeRevealMode: null
    };

    current.attempts += 1;
    if (current.firstDurationMs === null) {
      current.firstDurationMs = durationMs;
    }
    current.latestDurationMs = durationMs;
    current.latestEndedAt = isFiniteNumber(entry.endedAt) ? entry.endedAt : null;
    if (current.pbDurationMs === null || durationMs < current.pbDurationMs) {
      current.pbDurationMs = durationMs;
      current.pbEndedAt = isFiniteNumber(entry.endedAt) ? entry.endedAt : null;
    }
    if (sessionType === ROUTE_SESSION_TYPE) {
      current.objectiveCount = Number.isInteger(entry.objectiveCount)
        ? entry.objectiveCount
        : current.objectiveCount;
      current.visibleCount = entry.visibleCount ?? current.visibleCount;
      current.routeRevealMode = entry.routeRevealMode ?? current.routeRevealMode;
    } else {
      current.objectiveCount = Number.isInteger(entry.sessionObjectiveCount)
        ? entry.sessionObjectiveCount
        : current.objectiveCount;
    }

    rowsBySeed.set(exportSeed, current);
  }

  return Array.from(rowsBySeed.values())
    .map((row) => ({
      ...row,
      latestDeltaMs:
        isFiniteNumber(row.latestDurationMs) && isFiniteNumber(row.pbDurationMs)
          ? row.latestDurationMs - row.pbDurationMs
          : null,
      firstToBestDeltaMs:
        isFiniteNumber(row.firstDurationMs) && isFiniteNumber(row.pbDurationMs)
          ? row.firstDurationMs - row.pbDurationMs
          : null
    }))
    .sort((left, right) => {
      if (left.latestEndedAt === null) return 1;
      if (right.latestEndedAt === null) return -1;
      return right.latestEndedAt - left.latestEndedAt;
    });
}

function practiceSeedCompletionEntries(entriesSortedByEndedAt) {
  const skippedSessionIds = entriesSortedByEndedAt.reduce((sessionIds, entry) => {
    if (
      normalizeSessionType(entry?.sessionType) === PRACTICE_SESSION_TYPE &&
      entry.result === "skip" &&
      typeof entry.sessionId === "string" &&
      entry.sessionId
    ) {
      sessionIds.add(entry.sessionId);
    }

    return sessionIds;
  }, new Set());

  return entriesSortedByEndedAt.filter((entry) =>
    normalizeSessionType(entry?.sessionType) === PRACTICE_SESSION_TYPE &&
    entry.result === "complete" &&
    !skippedSessionIds.has(entry.sessionId) &&
    entry.sessionCompleted === true &&
    isFiniteNumber(entry.sessionTotalDurationMs)
  );
}

function routeSeedCompletionEntries(entriesSortedByEndedAt) {
  return entriesSortedByEndedAt.filter((entry) =>
    normalizeSessionType(entry?.sessionType) === ROUTE_SESSION_TYPE &&
    entry.result === "complete" &&
    isFiniteNumber(entry.totalDurationMs)
  );
}

function routeGapSummary(entry) {
  const events = Array.isArray(entry?.routeClearEvents)
    ? entry.routeClearEvents
        .filter((event) => isFiniteNumber(event?.elapsedMs))
        .slice()
        .sort((left, right) => left.elapsedMs - right.elapsedMs)
    : [];

  if (events.length <= 1) {
    return {
      averageGapMs: null,
      longestGapMs: null
    };
  }

  const gaps = [];
  for (let index = 1; index < events.length; index += 1) {
    gaps.push(Math.max(0, events[index].elapsedMs - events[index - 1].elapsedMs));
  }

  return {
    averageGapMs: Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length),
    longestGapMs: Math.max(...gaps)
  };
}

function lastCompletedPracticeEntry(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.sessionCompleted === true) {
      return entries[index];
    }
  }

  return entries[entries.length - 1] ?? null;
}

function buildRunRows(history, seedNamesByExportSeed) {
  const groups = new Map();

  history.forEach((entry, historyIndex) => {
    const sessionId = typeof entry?.sessionId === "string" ? entry.sessionId : `entry_${historyIndex}`;
    const group = groups.get(sessionId) ?? {
      sessionId,
      entries: [],
      historyIndexes: []
    };
    group.entries.push(entry);
    group.historyIndexes.push(historyIndex);
    groups.set(sessionId, group);
  });

  return Array.from(groups.values())
    .map((group) => {
      const sortedPairs = group.entries
        .map((entry, index) => ({
          entry,
          historyIndex: group.historyIndexes[index]
        }))
        .sort((left, right) => {
          const leftTime = isFiniteNumber(left.entry?.endedAt) ? left.entry.endedAt : 0;
          const rightTime = isFiniteNumber(right.entry?.endedAt) ? right.entry.endedAt : 0;
          return leftTime - rightTime;
        });
      const entries = sortedPairs.map((pair) => pair.entry);
      const sessionType = normalizeSessionType(entries[0]?.sessionType);
      const routeEntry =
        sessionType === ROUTE_SESSION_TYPE
          ? entries.find((entry) => entry.result === "complete") ?? entries[entries.length - 1]
          : null;
      const finalPracticeEntry =
        sessionType === PRACTICE_SESSION_TYPE
          ? lastCompletedPracticeEntry(entries)
          : null;
      const completedEntries = entries.filter((entry) => entry?.result === "complete");
      const endedAt = entries.reduce((latest, entry) => {
        if (!isFiniteNumber(entry?.endedAt)) {
          return latest;
        }

        return latest === null ? entry.endedAt : Math.max(latest, entry.endedAt);
      }, null);
      const routeGaps = routeGapSummary(routeEntry);

      const exportSeed = routeEntry?.exportSeed ?? finalPracticeEntry?.exportSeed ?? "";
      const reference = seedReference(exportSeed);
      const customName = seedNameForExport(seedNamesByExportSeed, exportSeed);

      return {
        sessionId: group.sessionId,
        sessionType,
        title:
          sessionType === ROUTE_SESSION_TYPE
            ? routeEntry?.label ?? "Route Run"
            : finalPracticeEntry?.sessionCompleted
              ? "Drill Seed Complete"
              : "Drill Run",
        exportSeed,
        seedLabel: customName || reference.label,
        endedAt,
        totalDurationMs:
          sessionType === ROUTE_SESSION_TYPE
            ? routeEntry?.totalDurationMs ?? null
            : finalPracticeEntry?.sessionTotalDurationMs ?? null,
        completedCount:
          sessionType === ROUTE_SESSION_TYPE
            ? routeEntry?.squaresCleared ?? completedEntries.length
            : completedEntries.length,
        objectiveCount:
          sessionType === ROUTE_SESSION_TYPE
            ? routeEntry?.objectiveCount ?? null
            : finalPracticeEntry?.sessionObjectiveCount ?? entries.length,
        visibleCount: routeEntry?.visibleCount ?? null,
        routeRevealMode: routeEntry?.routeRevealMode ?? null,
        averageGapMs: routeGaps.averageGapMs,
        longestGapMs: routeGaps.longestGapMs,
        entries,
        historyIndexes: sortedPairs.map((pair) => pair.historyIndex)
      };
    })
    .sort((left, right) => {
      if (left.endedAt === null) return 1;
      if (right.endedAt === null) return -1;
      return right.endedAt - left.endedAt;
    });
}

function markedSquareCount(runs) {
  return runs.reduce((total, run) => total + (isFiniteNumber(run.completedCount) ? run.completedCount : 0), 0);
}

export function buildAnalyticsViewModel(history = [], options = {}) {
  const safeHistory = Array.isArray(history) ? history : [];
  const historyByEndedAt = sortedByEndedAt(safeHistory);
  const seedNamesByExportSeed =
    options.seedNamesByExportSeed && typeof options.seedNamesByExportSeed === "object"
      ? options.seedNamesByExportSeed
      : {};
  const practiceSeedRows = buildSeedRows(
    practiceSeedCompletionEntries(historyByEndedAt),
    PRACTICE_SESSION_TYPE,
    seedNamesByExportSeed
  );
  const routeSeedRows = buildSeedRows(
    routeSeedCompletionEntries(historyByEndedAt),
    ROUTE_SESSION_TYPE,
    seedNamesByExportSeed
  );
  const runRows = buildRunRows(safeHistory, seedNamesByExportSeed);
  const drillRuns = runRows.filter((run) => run.sessionType === PRACTICE_SESSION_TYPE);
  const routeRuns = runRows.filter((run) => run.sessionType === ROUTE_SESSION_TYPE);

  return {
    overview: {
      drillRuns: drillRuns.length,
      routeRuns: routeRuns.length,
      squaresMarked: markedSquareCount(runRows)
    },
    practiceSeeds: practiceSeedRows,
    routeSeeds: routeSeedRows,
    runs: runRows
  };
}
