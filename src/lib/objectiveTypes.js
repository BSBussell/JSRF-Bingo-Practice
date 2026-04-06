export function normalizeObjectiveType(type) {
  return type === "location" ? "default" : type;
}

export function formatObjectiveTypeLabel(type) {
  return normalizeObjectiveType(type);
}
