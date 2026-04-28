export const VISION_TRAINING_GRID_SLOT_COUNT = 25;
export const VISION_TRAINING_GRID_COLUMNS = 5;

function buildRouteSlotStateSignature(routeSlots) {
  if (!Array.isArray(routeSlots) || routeSlots.length === 0) {
    return "empty";
  }

  return routeSlots
    .map((slot) => `${slot?.slotIndex ?? "x"}:${slot?.objectiveId ?? "empty"}`)
    .join("|");
}

function hashString(value) {
  const input = typeof value === "string" ? value : "";
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash >>> 0;
}

function createSeededNumberGenerator(seed) {
  let state = hashString(seed) || 0x9e3779b9;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildShuffledIndices(length, seed) {
  const shuffled = Array.from({ length }, (_, index) => index);
  const nextRandom = createSeededNumberGenerator(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function buildPreviousBoardPositionMaps(previousBoardCells) {
  if (!Array.isArray(previousBoardCells)) {
    return {
      objectivePositions: new Map(),
      slotPositions: new Map()
    };
  }

  return previousBoardCells.reduce((maps, cell) => {
    if (cell?.kind !== "slot") {
      return maps;
    }

    const objectiveId = cell.slot?.objectiveId;
    if (typeof objectiveId === "string") {
      maps.objectivePositions.set(objectiveId, cell.boardIndex);
    }

    if (Number.isInteger(cell.slot?.slotIndex)) {
      maps.slotPositions.set(cell.slot.slotIndex, cell.boardIndex);
    }

    return maps;
  }, {
    objectivePositions: new Map(),
    slotPositions: new Map()
  });
}

export function buildVisionTrainingBoard(
  routeSlots,
  boardSeed,
  slotCount = VISION_TRAINING_GRID_SLOT_COUNT,
  previousBoardCells = null
) {
  const safeSlotCount = Math.max(1, Math.min(VISION_TRAINING_GRID_SLOT_COUNT, Math.round(slotCount)));
  const safeRouteSlots = Array.isArray(routeSlots) ? routeSlots.slice(0, safeSlotCount) : [];
  const slotStateSignature = buildRouteSlotStateSignature(safeRouteSlots);
  const { objectivePositions, slotPositions } = buildPreviousBoardPositionMaps(previousBoardCells);
  const assignedPositions = buildShuffledIndices(
    VISION_TRAINING_GRID_SLOT_COUNT,
    `${boardSeed ?? "route-board"}:${safeSlotCount}:${slotStateSignature}`
  );
  const boardCells = Array.from({ length: VISION_TRAINING_GRID_SLOT_COUNT }, (_, boardIndex) => ({
    boardIndex,
    kind: "placeholder"
  }));
  const occupiedPositions = new Set();
  const remainingSlots = [];

  safeRouteSlots.forEach((slot) => {
    const boardIndex =
      typeof slot?.objectiveId === "string"
        ? objectivePositions.get(slot.objectiveId)
        : Number.isInteger(slot?.slotIndex)
          ? slotPositions.get(slot.slotIndex)
          : undefined;

    if (
      Number.isInteger(boardIndex) &&
      boardIndex >= 0 &&
      boardIndex < VISION_TRAINING_GRID_SLOT_COUNT &&
      !occupiedPositions.has(boardIndex)
    ) {
      boardCells[boardIndex] = {
        boardIndex,
        kind: "slot",
        slot
      };
      occupiedPositions.add(boardIndex);
      return;
    }

    remainingSlots.push(slot);
  });

  const availablePositions = assignedPositions.filter((boardIndex) => !occupiedPositions.has(boardIndex));

  remainingSlots.forEach((slot, slotIndex) => {
    const boardIndex = availablePositions[slotIndex];
    boardCells[boardIndex] = {
      boardIndex,
      kind: "slot",
      slot
    };
  });

  return boardCells;
}
