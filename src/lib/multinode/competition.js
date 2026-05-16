function toPlayerIndex(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function toObjectiveId(value) {
  return typeof value === "string" && value ? value : null;
}

function sortPlayerIndexesByScore(scoresByPlayerIndex, playerIndexes) {
  return playerIndexes.slice().sort((leftIndex, rightIndex) => {
    const leftScore = scoresByPlayerIndex[leftIndex] ?? 0;
    const rightScore = scoresByPlayerIndex[rightIndex] ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return leftIndex - rightIndex;
  });
}

function resolveWinnerPlayerIndex(scoresByPlayerIndex) {
  const entries = Object.entries(scoresByPlayerIndex).map(([playerIndex, score]) => ({
    playerIndex: Number(playerIndex),
    score: Number(score) || 0
  }));
  if (entries.length === 0) {
    return null;
  }

  entries.sort((left, right) => right.score - left.score || left.playerIndex - right.playerIndex);
  if (entries.length > 1 && entries[0].score === entries[1].score) {
    return null;
  }

  return entries[0].playerIndex;
}

export function createCompetitionRaceState({
  raceKey = "",
  objectives = [],
  localClaimedPlayerIndex = null
} = {}) {
  const objectiveIds = [];
  const objectiveLabelsById = {};

  for (const objective of objectives) {
    const objectiveId = toObjectiveId(objective?.id);
    if (!objectiveId || objectiveIds.includes(objectiveId)) {
      continue;
    }

    objectiveIds.push(objectiveId);
    objectiveLabelsById[objectiveId] =
      typeof objective?.label === "string" && objective.label
        ? objective.label
        : objectiveId;
  }

  return {
    raceKey: typeof raceKey === "string" ? raceKey : "",
    objectiveIds,
    objectiveLabelsById,
    claimsByObjectiveId: {},
    scoresByPlayerIndex: {},
    playersByIndex: {},
    playerIndexes: [],
    recentClaims: [],
    claimedCount: 0,
    totalObjectives: objectiveIds.length,
    isComplete: false,
    winnerPlayerIndex: null,
    localClaimedPlayerIndex: toPlayerIndex(localClaimedPlayerIndex)
  };
}

export function registerCompetitionPlayers(state, players) {
  if (!state || !Array.isArray(players)) {
    return state;
  }

  let changed = false;
  const nextPlayersByIndex = {
    ...state.playersByIndex
  };

  for (const player of players) {
    const playerIndex = toPlayerIndex(player?.index);
    if (playerIndex === null) {
      continue;
    }

    const previous = nextPlayersByIndex[playerIndex] ?? { index: playerIndex, name: null };
    const name =
      typeof player?.name === "string" && player.name.trim()
        ? player.name.trim()
        : previous.name;

    if (previous.name !== name || previous.index !== playerIndex) {
      nextPlayersByIndex[playerIndex] = {
        index: playerIndex,
        name
      };
      changed = true;
    }
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    playersByIndex: nextPlayersByIndex,
    playerIndexes: sortPlayerIndexesByScore(
      state.scoresByPlayerIndex,
      Object.keys(nextPlayersByIndex).map(Number)
    )
  };
}

export function setCompetitionLocalPlayer(state, playerIndex) {
  if (!state) {
    return state;
  }

  const normalizedPlayerIndex = toPlayerIndex(playerIndex);
  if (state.localClaimedPlayerIndex === normalizedPlayerIndex) {
    return state;
  }

  return {
    ...state,
    localClaimedPlayerIndex: normalizedPlayerIndex
  };
}

function buildClaimTone(localClaimedPlayerIndex, claimPlayerIndex) {
  if (!Number.isInteger(localClaimedPlayerIndex) || !Number.isInteger(claimPlayerIndex)) {
    return "neutral";
  }

  return localClaimedPlayerIndex === claimPlayerIndex ? "yay" : "doom";
}

export function applyCompetitionClaim(state, payload) {
  if (!state || !payload) {
    return {
      state,
      claimResult: {
        claimed: false,
        reason: "Invalid competition claim payload."
      }
    };
  }

  const objectiveId = toObjectiveId(payload.objectiveId);
  const playerIndex = toPlayerIndex(payload.playerIndex);
  if (!objectiveId || playerIndex === null) {
    return {
      state,
      claimResult: {
        claimed: false,
        reason: "Competition claim is missing objective or player index."
      }
    };
  }

  if (!state.objectiveIds.includes(objectiveId)) {
    return {
      state,
      claimResult: {
        claimed: false,
        reason: "Objective is not part of the active competition race."
      }
    };
  }

  if (state.claimsByObjectiveId[objectiveId]) {
    return {
      state,
      claimResult: {
        claimed: false,
        reason: "Objective has already been claimed."
      }
    };
  }

  const occurredAt = Number.isFinite(payload.occurredAt) ? Math.max(0, payload.occurredAt) : Date.now();
  const objectiveLabel =
    typeof payload.objectiveLabel === "string" && payload.objectiveLabel
      ? payload.objectiveLabel
      : state.objectiveLabelsById[objectiveId] ?? objectiveId;
  const playerName =
    typeof payload.playerName === "string" && payload.playerName.trim()
      ? payload.playerName.trim()
      : state.playersByIndex[playerIndex]?.name ?? null;

  const claim = {
    objectiveId,
    objectiveLabel,
    playerIndex,
    playerName,
    eventType: typeof payload.eventType === "string" ? payload.eventType : null,
    occurredAt
  };

  const nextScoresByPlayerIndex = {
    ...state.scoresByPlayerIndex,
    [playerIndex]: (state.scoresByPlayerIndex[playerIndex] ?? 0) + 1
  };
  const nextPlayersByIndex = {
    ...state.playersByIndex,
    [playerIndex]: {
      index: playerIndex,
      name: playerName
    }
  };
  const nextClaimsByObjectiveId = {
    ...state.claimsByObjectiveId,
    [objectiveId]: claim
  };
  const nextClaimedCount = state.claimedCount + 1;
  const raceComplete = state.totalObjectives > 0 && nextClaimedCount >= state.totalObjectives;
  const winnerPlayerIndex = raceComplete ? resolveWinnerPlayerIndex(nextScoresByPlayerIndex) : null;
  const nextState = {
    ...state,
    claimsByObjectiveId: nextClaimsByObjectiveId,
    scoresByPlayerIndex: nextScoresByPlayerIndex,
    playersByIndex: nextPlayersByIndex,
    playerIndexes: sortPlayerIndexesByScore(
      nextScoresByPlayerIndex,
      Object.keys(nextPlayersByIndex).map(Number)
    ),
    recentClaims: [claim, ...state.recentClaims].slice(0, 30),
    claimedCount: nextClaimedCount,
    isComplete: raceComplete,
    winnerPlayerIndex
  };

  return {
    state: nextState,
    claimResult: {
      claimed: true,
      claim,
      tone: buildClaimTone(state.localClaimedPlayerIndex, playerIndex),
      raceCompleted: raceComplete,
      winnerTone: raceComplete
        ? buildClaimTone(state.localClaimedPlayerIndex, winnerPlayerIndex)
        : "neutral"
    }
  };
}

export function getCompetitionPlayerName(state, playerIndex) {
  const normalizedPlayerIndex = toPlayerIndex(playerIndex);
  if (normalizedPlayerIndex === null) {
    return "Unknown";
  }

  const name = state?.playersByIndex?.[normalizedPlayerIndex]?.name;
  return typeof name === "string" && name.trim()
    ? name.trim()
    : `Player ${normalizedPlayerIndex + 1}`;
}
