function updateBucket(bucket = {}, key, durationMs) {
  const existing = bucket[key] ?? {
    attempts: 0,
    completions: 0,
    totalDurationMs: 0,
    bestMs: null
  };

  return {
    ...bucket,
    [key]: {
      attempts: existing.attempts + 1,
      completions: existing.completions + 1,
      totalDurationMs: existing.totalDurationMs + durationMs,
      bestMs:
        existing.bestMs === null ? durationMs : Math.min(existing.bestMs, durationMs)
    }
  };
}

export function createEmptyAggregateStats() {
  return {
    squareByArea: {},
    tapeByArea: {},
    graffitiByArea: {},
    routeByVisibleCount: {}
  };
}

export function recordCompletionStats(aggregateStats, entry) {
  const scoreDurationMs = entry.challengeDurationMs ?? entry.durationMs;
  const nextStats = {
    squareByArea: aggregateStats.squareByArea ?? {},
    tapeByArea: aggregateStats.tapeByArea ?? {},
    graffitiByArea: aggregateStats.graffitiByArea ?? {},
    routeByVisibleCount: aggregateStats.routeByVisibleCount ?? {}
  };

  if (
    entry.sessionType === "route" &&
    entry.result === "complete" &&
    typeof entry.totalDurationMs === "number" &&
    Number.isInteger(entry.visibleCount)
  ) {
    nextStats.routeByVisibleCount = updateBucket(
      nextStats.routeByVisibleCount,
      String(entry.visibleCount),
      entry.totalDurationMs
    );
    return nextStats;
  }

  if (
    entry.result === "complete" &&
    typeof scoreDurationMs === "number" &&
    entry.type !== "graffiti"
  ) {
    nextStats.squareByArea = updateBucket(nextStats.squareByArea, entry.area, scoreDurationMs);
  }

  if (entry.result === "complete" && typeof entry.tapeDurationMs === "number") {
    nextStats.tapeByArea = updateBucket(nextStats.tapeByArea, entry.area, entry.tapeDurationMs);
  }

  if (
    entry.result === "complete" &&
    typeof scoreDurationMs === "number" &&
    entry.type === "graffiti"
  ) {
    nextStats.graffitiByArea = updateBucket(
      nextStats.graffitiByArea,
      entry.area,
      scoreDurationMs
    );
  }

  return nextStats;
}

export function recordBestTime(bestTimesByObjective, entry) {
  const scoreDurationMs = entry.challengeDurationMs ?? entry.durationMs;

  if (entry.sessionType === "route") {
    return bestTimesByObjective;
  }

  if (entry.result !== "complete" || typeof scoreDurationMs !== "number") {
    return bestTimesByObjective;
  }

  const current = bestTimesByObjective[entry.objectiveId];
  if (!current || scoreDurationMs < current.durationMs) {
    return {
      ...bestTimesByObjective,
      [entry.objectiveId]: {
        durationMs: scoreDurationMs,
        totalDurationMs: entry.totalDurationMs ?? null,
        label: entry.label,
        area: entry.area,
        type: entry.type,
        updatedAt: entry.endedAt
      }
    };
  }

  return bestTimesByObjective;
}

export function rebuildPerformanceState(history) {
  return history.reduce(
    (state, entry) => ({
      bestTimesByObjective: recordBestTime(state.bestTimesByObjective, entry),
      aggregateStats: recordCompletionStats(state.aggregateStats, entry)
    }),
    {
      bestTimesByObjective: {},
      aggregateStats: createEmptyAggregateStats()
    }
  );
}

function averageRows(collection) {
  return Object.entries(collection)
    .map(([key, value]) => ({
      key,
      attempts: value.attempts,
      completions: value.completions,
      averageMs:
        value.completions > 0 ? Math.round(value.totalDurationMs / value.completions) : null,
      bestMs: value.bestMs
    }))
    .sort((a, b) => {
      if (a.averageMs === null) return 1;
      if (b.averageMs === null) return -1;
      return a.averageMs - b.averageMs;
    });
}

export function buildStatsViewModel(aggregateStats, history) {
  return {
    squareByArea: averageRows(aggregateStats.squareByArea ?? {}),
    tapeByArea: averageRows(aggregateStats.tapeByArea ?? {}),
    graffitiByArea: averageRows(aggregateStats.graffitiByArea ?? {}),
    routeByVisibleCount: averageRows(aggregateStats.routeByVisibleCount ?? {}).sort(
      (left, right) => Number(left.key) - Number(right.key)
    )
  };
}
