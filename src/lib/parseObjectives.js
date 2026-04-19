import { areaMeta, getAreaLabel } from "../data/areaMeta.js";
import { normalizeObjectiveType } from "./objectiveTypes.js";

const aliasToArea = {
  "99th": "_99th",
  "Btm pt.": "BP",
  Dogen: "Dogen",
  Shibuya: "Shibuya",
  Chuo: "Chuo",
  Hikage: "Hikage",
  RDH: "RDH",
  Sewers: "Sewers",
  Kibo: "Kibo",
  SDPP: "SDPP",
  HWY0: "HWY0",
  "Sky Dino": "Dino",
  FRZ: "FRZ",
  Stadium: "_99th"
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCount(description) {
  const match = description.match(/x\s+(\d+)(k)?/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  return match[2] ? value * 1000 : value;
}

function formatTargetValue(target) {
  if (target === null || target === undefined) {
    return "";
  }

  if (target >= 1000 && target % 1000 === 0) {
    return `${target / 1000}K`;
  }

  return String(target);
}

function resolveType(description) {
  if (description.includes("Grind x")) return "grind_count";
  if (description.includes("Air x")) return "air_count";
  if (description.includes("Tricks x")) return "trick_count";
  if (description.includes("Points x")) return "points_goal";
  if (description.includes("Special (")) return "special";
  if (description.includes("Unlock")) return "unlock";
  if (description.includes("Spray 100% GRAFFITI")) return "graffiti";
  return "default";
}

function resolveRunClass(type, target, label, sourceGroup) {
  if (type === "graffiti") return "long";
  if (type === "unlock") return "medium";
  if (type === "special") {
    if (/150k|Perimeter|Circle|Crane/i.test(label)) return "long";
    return "medium";
  }
  if (type === "default") {
    if (/floating|Very top|top of T-rex/i.test(label)) return "medium";
    return "short";
  }
  if (type === "points_goal") {
    if ((target ?? 0) <= 60000) return "short";
    if ((target ?? 0) <= 120000) return "medium";
    return "long";
  }
  if (type === "grind_count") {
    if ((target ?? 0) <= 15) return "short";
    if ((target ?? 0) <= 30) return "medium";
    return "long";
  }
  if (type === "air_count") {
    if ((target ?? 0) <= 4) return "short";
    if ((target ?? 0) <= 6) return "medium";
    return "long";
  }
  if (type === "trick_count") {
    if ((target ?? 0) <= 30) return "short";
    if ((target ?? 0) <= 70) return "medium";
    return "long";
  }
  if (sourceGroup === "chars") return "medium";
  return "short";
}

function formatObjectiveTitle(area, type, description, target) {
  const areaLabel = getAreaLabel(area);

  if (type === "grind_count") {
    return `${areaLabel} - ${formatTargetValue(target)} Grind`;
  }

  if (type === "air_count") {
    return `${areaLabel} - ${formatTargetValue(target)} Air`;
  }

  if (type === "trick_count") {
    return `${areaLabel} - ${formatTargetValue(target)} Tricks`;
  }

  if (type === "points_goal") {
    return `${areaLabel} - ${formatTargetValue(target)} Points`;
  }

  if (type === "special") {
    return `${areaLabel} - Special`;
  }

  if (type === "graffiti") {
    return `${areaLabel} - Graffiti`;
  }

  return `${areaLabel} - ${description}`;
}

function buildBaseObjective({
  area,
  code,
  label,
  description,
  sourceGroup
}) {
  const type = resolveType(description);
  const normalizedType = normalizeObjectiveType(type);
  const target =
    normalizedType === "special" ||
    normalizedType === "default" ||
    normalizedType === "unlock" ||
    normalizedType === "graffiti"
      ? null
      : parseCount(description);
  const meta = areaMeta[area];

  return {
    id: code ? `${slugify(area)}_${slugify(code)}` : `${slugify(area)}_${slugify(description)}`,
    area,
    areaLabel: getAreaLabel(area),
    district: meta?.district ?? null,
    depth: meta?.depth ?? null,
    code,
    label,
    type: normalizedType,
    target,
    description,
    sourceGroup,
    runClass: resolveRunClass(normalizedType, target, label, sourceGroup)
  };
}

function parseAreaSquare(area, square) {
  const match = square.match(/^(.*?)\s+(\d+)\s+-\s+(.*)$/);
  if (!match) {
    throw new Error(`Could not parse square: ${square}`);
  }

  const [, , code, description] = match;
  const type = resolveType(description);
  const target = parseCount(description);
  return buildBaseObjective({
    area,
    code,
    label: formatObjectiveTitle(area, type, description, target),
    description,
    sourceGroup: "souls"
  });
}

function parseUnlock(square) {
  const match = square.match(/^(.*?)\s+Unlock\s+(.*)$/);
  if (!match) {
    throw new Error(`Could not parse unlock: ${square}`);
  }

  const [, alias, unlockName] = match;
  const area = aliasToArea[alias];
  return buildBaseObjective({
    area,
    code: `unlock_${slugify(unlockName)}`,
    label: `${getAreaLabel(area)} - Unlock ${unlockName}`,
    description: `Unlock ${unlockName}`,
    sourceGroup: "chars"
  });
}

function parseGraffiti(square) {
  const match = square.match(/^(.*?)\s+Spray 100% GRAFFITI$/);
  if (!match) {
    throw new Error(`Could not parse graffiti: ${square}`);
  }

  const [, alias] = match;
  const area = aliasToArea[alias];
  return buildBaseObjective({
    area,
    code: "graffiti",
    label: `${getAreaLabel(area)} - Graffiti`,
    description: "Spray 100% GRAFFITI",
    sourceGroup: "graffiti"
  });
}

export function parseObjectives({ rawSquares, rawUnlocks, rawGraffiti }) {
  const areaObjectives = Object.entries(rawSquares).flatMap(([area, squares]) =>
    squares.map((square) => parseAreaSquare(area, square))
  );
  const unlockObjectives = rawUnlocks.map(parseUnlock);
  const graffitiObjectives = rawGraffiti.map(parseGraffiti);

  return [...areaObjectives, ...unlockObjectives, ...graffitiObjectives];
}
