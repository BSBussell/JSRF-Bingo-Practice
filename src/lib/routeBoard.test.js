import assert from "node:assert/strict";
import test from "node:test";

import {
  VISION_TRAINING_GRID_SLOT_COUNT,
  buildVisionTrainingBoard
} from "./session/routeBoard.js";

test("buildVisionTrainingBoard creates a full 25-cell board with placeholders", () => {
  const board = buildVisionTrainingBoard(
    [
      { slotIndex: 0, objectiveId: "a" },
      { slotIndex: 1, objectiveId: "b" },
      { slotIndex: 2, objectiveId: "c" }
    ],
    "route-session-1"
  );

  assert.equal(board.length, VISION_TRAINING_GRID_SLOT_COUNT);
  assert.equal(board.filter((cell) => cell.kind === "slot").length, 3);
  assert.equal(board.filter((cell) => cell.kind === "placeholder").length, 22);
});

test("buildVisionTrainingBoard is deterministic for a session seed", () => {
  const routeSlots = [
    { slotIndex: 0, objectiveId: "a" },
    { slotIndex: 1, objectiveId: "b" },
    { slotIndex: 2, objectiveId: "c" },
    { slotIndex: 3, objectiveId: "d" }
  ];
  const firstBoard = buildVisionTrainingBoard(routeSlots, "route-session-2");
  const secondBoard = buildVisionTrainingBoard(routeSlots, "route-session-2");

  assert.deepEqual(firstBoard, secondBoard);
});

test("buildVisionTrainingBoard changes placement when the board seed changes", () => {
  const routeSlots = [
    { slotIndex: 0, objectiveId: "a" },
    { slotIndex: 1, objectiveId: "b" },
    { slotIndex: 2, objectiveId: "c" }
  ];
  const firstBoard = buildVisionTrainingBoard(routeSlots, "route-session-3a");
  const secondBoard = buildVisionTrainingBoard(routeSlots, "route-session-3b");

  assert.notDeepEqual(firstBoard, secondBoard);
});

test("buildVisionTrainingBoard changes placement when the visible slot state changes", () => {
  const firstBoard = buildVisionTrainingBoard(
    [
      { slotIndex: 0, objectiveId: "a" },
      { slotIndex: 1, objectiveId: "b" },
      { slotIndex: 2, objectiveId: "c" }
    ],
    "route-session-4"
  );
  const secondBoard = buildVisionTrainingBoard(
    [
      { slotIndex: 0, objectiveId: "a" },
      { slotIndex: 1, objectiveId: "d" },
      { slotIndex: 2, objectiveId: "c" }
    ],
    "route-session-4",
    VISION_TRAINING_GRID_SLOT_COUNT,
    firstBoard
  );

  const firstPositions = Object.fromEntries(
    firstBoard
      .filter((cell) => cell.kind === "slot")
      .map((cell) => [cell.slot.objectiveId, cell.boardIndex])
  );
  const secondPositions = Object.fromEntries(
    secondBoard
      .filter((cell) => cell.kind === "slot")
      .map((cell) => [cell.slot.objectiveId, cell.boardIndex])
  );

  assert.equal(secondPositions.a, firstPositions.a);
  assert.equal(secondPositions.c, firstPositions.c);
  assert.equal(secondBoard.filter((cell) => cell.kind === "slot").length, 3);
  assert.ok(!Object.prototype.hasOwnProperty.call(secondPositions, "b"));
  assert.ok(Object.prototype.hasOwnProperty.call(secondPositions, "d"));
});

test("buildVisionTrainingBoard keeps cleared burst slots in place until a new burst", () => {
  const firstBoard = buildVisionTrainingBoard(
    [
      { slotIndex: 0, objectiveId: "a" },
      { slotIndex: 1, objectiveId: "b" },
      { slotIndex: 2, objectiveId: "c" }
    ],
    "route-session-5"
  );
  const secondBoard = buildVisionTrainingBoard(
    [
      { slotIndex: 0, objectiveId: "a" },
      { slotIndex: 1, objectiveId: null },
      { slotIndex: 2, objectiveId: "c" }
    ],
    "route-session-5",
    VISION_TRAINING_GRID_SLOT_COUNT,
    firstBoard
  );

  const firstCellByObjectiveId = Object.fromEntries(
    firstBoard
      .filter((cell) => cell.kind === "slot" && typeof cell.slot.objectiveId === "string")
      .map((cell) => [cell.slot.objectiveId, cell.boardIndex])
  );
  const secondEmptyCell = secondBoard.find(
    (cell) => cell.kind === "slot" && cell.slot.slotIndex === 1 && cell.slot.objectiveId === null
  );

  assert.equal(
    secondBoard.find((cell) => cell.kind === "slot" && cell.slot.objectiveId === "a")?.boardIndex,
    firstCellByObjectiveId.a
  );
  assert.equal(
    secondBoard.find((cell) => cell.kind === "slot" && cell.slot.objectiveId === "c")?.boardIndex,
    firstCellByObjectiveId.c
  );
  assert.equal(secondEmptyCell?.boardIndex, firstCellByObjectiveId.b);
});
