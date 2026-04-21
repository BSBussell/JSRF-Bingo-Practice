import assert from "node:assert/strict";
import test from "node:test";

import { allObjectives } from "../data/objectives.js";
import {
  BINGOPEDIA_FILTERS,
  buildBingopediaViewModel,
  filterBingopediaSquares,
  groupBingopediaSquaresByArea
} from "./stats/bingopedia.js";

const dogenGraffiti = allObjectives.find((objective) => objective.id === "dogen_graffiti");
const dogenDefault = allObjectives.find((objective) => objective.id === "dogen_005");
const dogenTapeRequired = allObjectives.find((objective) => objective.id === "dogen_092");
const rdhSquare = allObjectives.find((objective) => objective.id === "rdh_010");
const rdhUnlock = allObjectives.find((objective) => objective.id === "rdh_unlock_rhyth");

test("buildBingopediaViewModel groups squares by district and area with derived stats", () => {
  const history = [
    {
      sessionType: "practice",
      objectiveId: dogenGraffiti.id,
      result: "complete",
      durationMs: 12000,
      endedAt: 1000,
      sessionId: "old"
    },
    {
      sessionType: "practice",
      objectiveId: dogenGraffiti.id,
      result: "skip",
      durationMs: null,
      endedAt: 2000,
      sessionId: "skip"
    },
    {
      sessionType: "practice",
      objectiveId: dogenGraffiti.id,
      result: "complete",
      durationMs: 9000,
      endedAt: 3000,
      sessionId: "new"
    },
    {
      sessionType: "route",
      objectiveId: dogenGraffiti.id,
      result: "complete",
      durationMs: 1,
      endedAt: 4000,
      sessionId: "ignored"
    }
  ];
  const viewModel = buildBingopediaViewModel({
    objectives: [dogenGraffiti, rdhSquare],
    history,
    bestTimesByObjective: {
      [dogenGraffiti.id]: {
        durationMs: 8000
      }
    }
  });

  const shibuyaDistrict = viewModel.districts.find((district) => district.district === "ShibuyaCho");
  const dogenArea = shibuyaDistrict.areas.find((area) => area.area === "Dogen");
  const row = viewModel.squares.find((square) => square.id === dogenGraffiti.id);

  assert.equal(dogenArea.squareCount, 1);
  assert.equal(dogenArea.clearedCount, 1);
  assert.equal(row.attempts, 3);
  assert.equal(row.clears, 2);
  assert.equal(row.skips, 1);
  assert.equal(row.pbMs, 8000);
  assert.equal(row.averageMs, 10500);
  assert.equal(row.lastClearAt, 3000);
  assert.equal(row.recentAttempts.length, 3);
});

test("filterBingopediaSquares applies search and chips", () => {
  const viewModel = buildBingopediaViewModel({
    objectives: [dogenGraffiti, dogenDefault, dogenTapeRequired, rdhSquare, rdhUnlock],
    history: [
      {
        sessionType: "practice",
        objectiveId: dogenGraffiti.id,
        result: "complete",
        durationMs: 12000,
        endedAt: 1000
      }
    ]
  });

  assert.deepEqual(
    filterBingopediaSquares(viewModel.squares, {
      search: "dogen graffiti",
      filter: BINGOPEDIA_FILTERS.GRAFFITI
    }).map((row) => row.id),
    [dogenGraffiti.id]
  );
  assert.ok(
    filterBingopediaSquares(viewModel.squares, {
      filter: BINGOPEDIA_FILTERS.DEFAULT_SOULS
    }).some((row) => row.id === dogenDefault.id)
  );
  assert.ok(
    filterBingopediaSquares(viewModel.squares, {
      filter: BINGOPEDIA_FILTERS.TAPE_SOULS
    }).some((row) => row.id === dogenTapeRequired.id)
  );
  assert.deepEqual(
    filterBingopediaSquares(viewModel.squares, {
      filter: BINGOPEDIA_FILTERS.UNLOCKS
    }).map((row) => row.id),
    [rdhUnlock.id]
  );
  assert.deepEqual(
    filterBingopediaSquares(viewModel.squares, {
      filter: BINGOPEDIA_FILTERS.NEVER_PRACTICED
    }).map((row) => row.id),
    [dogenDefault.id, dogenTapeRequired.id, rdhSquare.id, rdhUnlock.id]
  );
});

test("groupBingopediaSquaresByArea keeps filtered square rows grouped for global results", () => {
  const viewModel = buildBingopediaViewModel({
    objectives: [dogenGraffiti, rdhSquare]
  });
  const groups = groupBingopediaSquaresByArea(viewModel.squares);

  assert.deepEqual(groups.map((group) => group.area), ["Dogen", "RDH"]);
  assert.deepEqual(groups.map((group) => group.squares.length), [1, 1]);
});
