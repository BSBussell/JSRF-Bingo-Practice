import { objectivesById } from "../../data/objectives.js";
import {
  buildSessionSpecFromObjectiveIds,
  createRandomSeed
} from "../seed/sessionSeed.js";
import { PRACTICE_SESSION_TYPE } from "./sessionTypes.js";

export function buildObjectivePracticeLaunch(objectiveId, options = {}) {
  const objective = objectivesById[objectiveId];
  if (!objective) {
    return null;
  }

  return buildSessionSpecFromObjectiveIds(
    [objective.id],
    {
      ...(options.drillSettings ?? {}),
      startingArea: objective.area,
      numberOfObjectives: 1
    },
    options.rngSeed ?? createRandomSeed(),
    PRACTICE_SESSION_TYPE
  );
}
