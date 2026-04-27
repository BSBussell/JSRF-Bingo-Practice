import { CHARACTER_NAME_BY_ID, LEVEL_NAME_BY_ID } from "./levelIds.js";
import { GRAFFITI_BY_LEVEL_ID } from "./graffitiData.js";

function toLevelName(levelId) {
  return LEVEL_NAME_BY_ID[levelId] ?? `Level ${levelId}`;
}

function ensurePlayerSlots(players, count) {
  const nextPlayers = players.slice();

  while (nextPlayers.length < count) {
    const index = nextPlayers.length;
    nextPlayers.push({
      index,
      name: null,
      levelId: null,
      levelName: null,
      enteredAt: null
    });
  }

  return nextPlayers;
}

function dedupePush(list, value) {
  return list.includes(value) ? list : [...list, value];
}

function buildGraffitiById(definitions) {
  return definitions.reduce((accumulator, definition) => {
    const requiredTagIds = definition.requiredTagIds.slice();
    accumulator[definition.graffitiId] = {
      graffitiId: definition.graffitiId,
      size: definition.size,
      location: definition.location,
      completedTagIds: [],
      requiredTagIds,
      completedCount: 0,
      totalCount: requiredTagIds.length,
      isComplete: false
    };
    return accumulator;
  }, {});
}

function buildGraffitiState(graffitiByLevelId) {
  const byLevelId = {};

  for (const [levelIdKey, definitions] of Object.entries(graffitiByLevelId)) {
    const levelId = Number(levelIdKey);
    const byGraffitiId = buildGraffitiById(definitions);

    byLevelId[levelId] = {
      levelId,
      levelName: toLevelName(levelId),
      completedGraffitiIds: [],
      completedCount: 0,
      totalCount: definitions.length,
      isComplete: definitions.length > 0 ? false : true,
      byGraffitiId
    };
  }

  return { byLevelId };
}

function cloneLevelEntry(levelEntry) {
  const byGraffitiId = {};

  for (const [graffitiId, graffitiEntry] of Object.entries(levelEntry.byGraffitiId)) {
    byGraffitiId[graffitiId] = {
      ...graffitiEntry,
      completedTagIds: graffitiEntry.completedTagIds.slice(),
      requiredTagIds: graffitiEntry.requiredTagIds.slice()
    };
  }

  return {
    ...levelEntry,
    completedGraffitiIds: levelEntry.completedGraffitiIds.slice(),
    byGraffitiId
  };
}

export function createMultinodeWorldState(options = {}) {
  const graffitiByLevelId = options.graffitiByLevelId ?? GRAFFITI_BY_LEVEL_ID;

  return {
    players: [],
    playerCount: 0,
    collectedSoulIds: [],
    unlockedSoulIds: [],
    collectedTapeIds: [],
    unlockedCharacterIds: [],
    graffiti: buildGraffitiState(graffitiByLevelId),
    lastUpdatedAt: null
  };
}

export function applyMultinodeEvent(state, event, options = {}) {
  if (!event || typeof event.type !== "string") {
    return {
      state,
      events: []
    };
  }

  const now = Date.now();

  switch (event.type) {
    case "player_count_changed": {
      const nextPlayerCount = Math.max(0, event.count | 0);
      return {
        state: {
          ...state,
          playerCount: nextPlayerCount,
          players: ensurePlayerSlots(state.players, nextPlayerCount),
          lastUpdatedAt: now
        },
        events: []
      };
    }

    case "player_registered": {
      const playerIndex = event.playerIndex | 0;
      if (playerIndex < 0) {
        return { state, events: [] };
      }

      const nextPlayers = ensurePlayerSlots(state.players, playerIndex + 1);
      nextPlayers[playerIndex] = {
        ...nextPlayers[playerIndex],
        name: typeof event.playerName === "string" ? event.playerName : null
      };

      return {
        state: {
          ...state,
          players: nextPlayers,
          lastUpdatedAt: now
        },
        events: []
      };
    }

    case "area_changed": {
      const playerIndex = event.playerIndex | 0;
      if (playerIndex < 0) {
        return { state, events: [] };
      }

      const levelId = event.levelId | 0;
      const levelName = toLevelName(levelId);
      const nextPlayers = ensurePlayerSlots(state.players, playerIndex + 1);
      nextPlayers[playerIndex] = {
        ...nextPlayers[playerIndex],
        levelId,
        levelName,
        enteredAt: now
      };

      return {
        state: {
          ...state,
          players: nextPlayers,
          lastUpdatedAt: now
        },
        events: [
          {
            type: "player_location_changed",
            playerIndex,
            levelId,
            levelName
          }
        ]
      };
    }

    case "soul_collected": {
      return {
        state: {
          ...state,
          collectedSoulIds: dedupePush(state.collectedSoulIds, event.soulId | 0),
          lastUpdatedAt: now
        },
        events: []
      };
    }

    case "soul_unlocked": {
      return {
        state: {
          ...state,
          unlockedSoulIds: dedupePush(state.unlockedSoulIds, event.soulId | 0),
          lastUpdatedAt: now
        },
        events: []
      };
    }

    case "tape_collected": {
      return {
        state: {
          ...state,
          collectedTapeIds: dedupePush(state.collectedTapeIds, event.tapeId | 0),
          lastUpdatedAt: now
        },
        events: []
      };
    }

    case "character_unlocked": {
      return {
        state: {
          ...state,
          unlockedCharacterIds: dedupePush(state.unlockedCharacterIds, event.characterId | 0),
          lastUpdatedAt: now
        },
        events: []
      };
    }

    case "tag_sprayed": {
      const levelId = event.levelId | 0;
      const graffitiId = event.graffitiId | 0;
      const tagId = event.tagId | 0;
      const levelEntry = state.graffiti.byLevelId[levelId];
      if (!levelEntry) {
        return { state, events: [] };
      }

      const graffitiEntry = levelEntry.byGraffitiId[graffitiId];
      if (!graffitiEntry || !graffitiEntry.requiredTagIds.includes(tagId)) {
        return { state, events: [] };
      }

      if (graffitiEntry.completedTagIds.includes(tagId)) {
        return { state, events: [] };
      }

      const nextLevelEntry = cloneLevelEntry(levelEntry);
      const nextGraffitiEntry = nextLevelEntry.byGraffitiId[graffitiId];
      const nextCompletedTagIds = [...nextGraffitiEntry.completedTagIds, tagId];
      nextGraffitiEntry.completedTagIds = nextCompletedTagIds;
      nextGraffitiEntry.completedCount = nextCompletedTagIds.length;

      const derivedEvents = [];

      if (!nextGraffitiEntry.isComplete && nextCompletedTagIds.length >= nextGraffitiEntry.totalCount) {
        nextGraffitiEntry.isComplete = true;
        nextLevelEntry.completedGraffitiIds = dedupePush(nextLevelEntry.completedGraffitiIds, graffitiId);
        nextLevelEntry.completedCount = nextLevelEntry.completedGraffitiIds.length;

        derivedEvents.push({
          type: "graffiti_completed",
          levelId,
          levelName: nextLevelEntry.levelName,
          graffitiId,
          size: nextGraffitiEntry.size,
          location: nextGraffitiEntry.location
        });

        if (!nextLevelEntry.isComplete && nextLevelEntry.completedCount >= nextLevelEntry.totalCount) {
          nextLevelEntry.isComplete = true;
          derivedEvents.push({
            type: "graffiti_area_completed",
            levelId,
            levelName: nextLevelEntry.levelName
          });
        }
      }

      return {
        state: {
          ...state,
          graffiti: {
            ...state.graffiti,
            byLevelId: {
              ...state.graffiti.byLevelId,
              [levelId]: nextLevelEntry
            }
          },
          lastUpdatedAt: now
        },
        events: derivedEvents
      };
    }

    case "kill_combo": {
      // Mirror the reference behavior by preserving player identity/location while clearing run progress.
      return {
        state: {
          ...state,
          collectedSoulIds: [],
          unlockedSoulIds: [],
          collectedTapeIds: [],
          unlockedCharacterIds: [],
          graffiti: buildGraffitiState(options.graffitiByLevelId ?? GRAFFITI_BY_LEVEL_ID),
          lastUpdatedAt: now
        },
        events: [
          {
            type: "world_state_reset",
            reason: "kill_combo"
          }
        ]
      };
    }

    default:
      return {
        state,
        events: []
      };
  }
}

export function getCharacterName(characterId) {
  return CHARACTER_NAME_BY_ID[characterId] ?? `Character ${characterId}`;
}
