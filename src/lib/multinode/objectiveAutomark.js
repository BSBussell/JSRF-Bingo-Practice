const AREA_TO_LEVEL_ID = Object.freeze({
  Dogen: 65538,
  Shibuya: 65536,
  Chuo: 65537,
  Hikage: 65539,
  RDH: 131072,
  Sewers: 131073,
  BP: 131075,
  Kibo: 131074,
  FRZ: 131076,
  _99th: 196608,
  Dino: 196609,
  HWY0: 196611,
  SDPP: 196612
});

const AREA_TO_TAPE_ID = Object.freeze({
  Shibuya: 0,
  Chuo: 1,
  Dogen: 2,
  Hikage: 3,
  RDH: 4,
  Sewers: 5,
  Kibo: 6,
  BP: 7,
  FRZ: 8,
  _99th: 9,
  Dino: 10,
  HWY0: 11,
  SDPP: 12
});

const CHARACTER_ID_BY_UNLOCK_SLUG = Object.freeze({
  cube: 10,
  rhyth: 4,
  jazz: 21,
  soda: 5,
  boogie: 9
});

function toNumericCode(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRuleFromObjective(objective) {
  if (!objective || typeof objective !== "object") {
    return {
      supported: false,
      rule: null,
      reason: "Objective is missing or invalid."
    };
  }

  if (objective.sourceGroup === "souls") {
    const soulId = toNumericCode(objective.code);
    if (soulId === null) {
      return {
        supported: false,
        rule: null,
        reason: "Soul objective is missing a numeric soul code."
      };
    }

    return {
      supported: true,
      rule: {
        type: "soul_collected",
        soulId
      },
      reason: "Soul objectives complete when the matching soul is collected."
    };
  }

  if (objective.type === "unlock") {
    const unlockSlug =
      typeof objective.code === "string" && objective.code.startsWith("unlock_")
        ? objective.code.slice("unlock_".length)
        : null;
    const characterId = unlockSlug ? CHARACTER_ID_BY_UNLOCK_SLUG[unlockSlug] : undefined;

    if (typeof characterId !== "number") {
      return {
        supported: false,
        rule: null,
        reason: "Unlock objective does not have a known MultiNode character mapping."
      };
    }

    return {
      supported: true,
      rule: {
        type: "character_unlocked",
        characterId
      },
      reason: "Character unlock objective can be detected from MultiNode character unlock events."
    };
  }

  if (objective.type === "graffiti") {
    const levelId = AREA_TO_LEVEL_ID[objective.area];
    if (typeof levelId !== "number") {
      return {
        supported: false,
        rule: null,
        reason: "Graffiti objective area does not have a known MultiNode level mapping."
      };
    }

    return {
      supported: true,
      rule: {
        type: "graffiti_area_completed",
        levelId
      },
      reason: "Full-area graffiti objective can be detected from MultiNode graffiti-area completion events."
    };
  }

  return {
    supported: false,
    rule: null,
    reason: "No MultiNode automark rule is known for this objective."
  };
}

function getTravelRuleFromObjective(objective) {
  if (!objective || typeof objective !== "object") {
    return {
      supported: false,
      rule: null,
      reason: "Objective is missing or invalid."
    };
  }

  const levelId = AREA_TO_LEVEL_ID[objective.area];
  if (typeof levelId !== "number") {
    return {
      supported: false,
      rule: null,
      reason: "Objective area does not have a known MultiNode level mapping."
    };
  }

  return {
    supported: true,
    rule: {
      type: "area_changed",
      levelId
    },
    reason: "Travel phase can be detected from MultiNode area change events."
  };
}

function getTapeRuleFromObjective(objective) {
  if (!objective || typeof objective !== "object") {
    return {
      supported: false,
      rule: null,
      reason: "Objective is missing or invalid."
    };
  }

  const tapeId = AREA_TO_TAPE_ID[objective.area];
  if (typeof tapeId !== "number") {
    return {
      supported: false,
      rule: null,
      reason: "Objective area does not have a known MultiNode tape mapping."
    };
  }

  return {
    supported: true,
    rule: {
      type: "tape_collected",
      tapeId
    },
    reason: "Tape phase can be detected from MultiNode tape collection events."
  };
}

export function getObjectiveAutomarkRule(objective, options = {}) {
  if (options?.phase === "travel" || options?.eventType === "area_changed") {
    return getTravelRuleFromObjective(objective);
  }

  if (options?.phase === "tape" || options?.eventType === "tape_collected") {
    return getTapeRuleFromObjective(objective);
  }

  return getRuleFromObjective(objective);
}

export function getObjectiveAutomarkStatus(objective, worldState) {
  const ruleResult = getRuleFromObjective(objective);
  if (!ruleResult.supported || !ruleResult.rule) {
    return {
      supported: false,
      complete: false,
      rule: null,
      reason: ruleResult.reason
    };
  }

  if (!worldState || typeof worldState !== "object") {
    return {
      supported: true,
      complete: false,
      rule: ruleResult.rule,
      reason: "Objective is automarkable, but no perceived world state was provided."
    };
  }

  const { rule } = ruleResult;

  switch (rule.type) {
    case "tape_collected": {
      const complete = Array.isArray(worldState.collectedTapeIds)
        ? worldState.collectedTapeIds.includes(rule.tapeId)
        : false;
      return {
        supported: true,
        complete,
        rule,
        reason: complete
          ? `Tape ${rule.tapeId} is already present in perceived world state.`
          : `Tape ${rule.tapeId} is not yet present in perceived world state.`
      };
    }

    case "soul_collected": {
      const complete = Array.isArray(worldState.collectedSoulIds)
        ? worldState.collectedSoulIds.includes(rule.soulId)
        : false;
      return {
        supported: true,
        complete,
        rule,
        reason: complete
          ? `Soul ${rule.soulId} is already present in perceived world state.`
          : `Soul ${rule.soulId} is not yet present in perceived world state.`
      };
    }

    case "character_unlocked": {
      const complete = Array.isArray(worldState.unlockedCharacterIds)
        ? worldState.unlockedCharacterIds.includes(rule.characterId)
        : false;
      return {
        supported: true,
        complete,
        rule,
        reason: complete
          ? `Character ${rule.characterId} is already present in perceived world state.`
          : `Character ${rule.characterId} is not yet present in perceived world state.`
      };
    }

    case "graffiti_area_completed": {
      const levelGraffiti = worldState.graffiti?.byLevelId?.[rule.levelId];
      const complete = Boolean(levelGraffiti?.isComplete);
      return {
        supported: true,
        complete,
        rule,
        reason: complete
          ? `Level ${rule.levelId} graffiti is already complete in perceived world state.`
          : `Level ${rule.levelId} graffiti is not yet complete in perceived world state.`
      };
    }

    default:
      return {
        supported: true,
        complete: false,
        rule,
        reason: "Automark rule type is not yet supported by status checks."
      };
  }
}

export function doesEventMatchObjectiveAutomark(event, objective, worldState, options = {}) {
  const ruleResult =
    event?.type === "area_changed" && options.allowAreaChange !== false
      ? getTravelRuleFromObjective(objective)
      : event?.type === "tape_collected" && options.phase === "tape"
        ? getTapeRuleFromObjective(objective)
      : getRuleFromObjective(objective);

  if (!ruleResult.supported || !ruleResult.rule) {
    return {
      matched: false,
      supported: false,
      reason: ruleResult.reason
    };
  }

  const { rule } = ruleResult;

  if (!event || typeof event.type !== "string") {
    return {
      matched: false,
      supported: true,
      reason: "No event was provided for automark comparison."
    };
  }

  if (event.type !== rule.type) {
    return {
      matched: false,
      supported: true,
      reason: "Event did not match the objective automark rule."
    };
  }

  if (rule.type === "tape_collected") {
    if (event.tapeId === rule.tapeId) {
      return {
        matched: true,
        supported: true,
        reason: `Collected matching tape ${rule.tapeId}.`
      };
    }

    return {
      matched: false,
      supported: true,
      reason: `Collected tape ${event.tapeId}, but objective expects tape ${rule.tapeId}.`
    };
  }

  if (rule.type === "soul_collected") {
    if (event.soulId === rule.soulId) {
      return {
        matched: true,
        supported: true,
        reason: `Collected matching soul ${rule.soulId}.`
      };
    }

    return {
      matched: false,
      supported: true,
      reason: `Collected soul ${event.soulId}, but objective expects soul ${rule.soulId}.`
    };
  }

  if (rule.type === "character_unlocked") {
    if (event.characterId === rule.characterId) {
      return {
        matched: true,
        supported: true,
        reason: `Unlocked matching character ${rule.characterId}.`
      };
    }

    return {
      matched: false,
      supported: true,
      reason: `Unlocked character ${event.characterId}, but objective expects character ${rule.characterId}.`
    };
  }

  if (rule.type === "graffiti_area_completed") {
    if (event.levelId === rule.levelId) {
      return {
        matched: true,
        supported: true,
        reason: `Completed matching graffiti area ${rule.levelId}.`
      };
    }

    return {
      matched: false,
      supported: true,
      reason: `Completed graffiti area ${event.levelId}, but objective expects ${rule.levelId}.`
    };
  }

  if (rule.type === "area_changed") {
    if (event.levelId === rule.levelId) {
      return {
        matched: true,
        supported: true,
        reason: `Entered matching area ${rule.levelId}.`
      };
    }

    return {
      matched: false,
      supported: true,
      reason: `Entered area ${event.levelId}, but objective expects ${rule.levelId}.`
    };
  }

  const status = getObjectiveAutomarkStatus(objective, worldState);
  return {
    matched: status.complete,
    supported: true,
    reason: status.complete
      ? "Objective is already complete in perceived world state."
      : "Event did not match the objective automark rule."
  };
}

export function findFirstObjectiveAutomarkCandidateMatch(
  event,
  candidates,
  worldState,
  options = {}
) {
  if (!Array.isArray(candidates)) {
    return null;
  }

  for (const candidate of candidates) {
    const objective = candidate?.objective ?? candidate;
    const matchResult = doesEventMatchObjectiveAutomark(
      event,
      objective,
      worldState,
      options
    );

    if (matchResult.matched) {
      return {
        candidate,
        objective,
        matchResult
      };
    }
  }

  return null;
}
