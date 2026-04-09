import { normalizeObjectiveType } from "../objectiveTypes.js";

export const DRILL_CATEGORIES = [
  {
    key: "graffiti",
    label: "Graffiti",
    settingKey: "graffitiVariance"
  },
  {
    key: "unlock",
    label: "Character Unlocks",
    settingKey: "unlockVariance"
  },
  {
    key: "default",
    label: "Default Souls",
    settingKey: "defaultVariance"
  },
  {
    key: "notebook",
    label: "Notebook Souls",
    settingKey: "notebookVariance"
  }
];

export const DRILL_CATEGORY_KEYS = DRILL_CATEGORIES.map((category) => category.key);

export const DRILL_CATEGORY_BY_KEY = Object.fromEntries(
  DRILL_CATEGORIES.map((category) => [category.key, category])
);

export function getObjectiveCategory(type) {
  const normalizedType = normalizeObjectiveType(type);

  if (normalizedType === "graffiti") return "graffiti";
  if (normalizedType === "unlock") return "unlock";
  if (normalizedType === "default") return "default";
  return "notebook";
}
