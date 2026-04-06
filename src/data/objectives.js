import { areaOrder } from "./areaMeta.js";
import { rawGraffiti, rawSquares, rawUnlocks } from "./rawSquares.js";
import { parseObjectives } from "../lib/parseObjectives.js";

export const allObjectives = parseObjectives({
  rawSquares,
  rawUnlocks,
  rawGraffiti
});

export const objectivesById = Object.fromEntries(
  allObjectives.map((objective) => [objective.id, objective])
);

export const objectivesByArea = allObjectives.reduce((accumulator, objective) => {
  if (!accumulator[objective.area]) {
    accumulator[objective.area] = [];
  }

  accumulator[objective.area].push(objective);
  return accumulator;
}, {});

export const areaOptions = areaOrder.map((area) => ({
  value: area,
  label: objectivesByArea[area]?.[0]?.areaLabel ?? area
}));
