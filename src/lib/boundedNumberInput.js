function defaultParseValue(value) {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return Number.NaN;
  }

  return Number(trimmedValue);
}

function clampNumber(value, min, max) {
  let nextValue = value;

  if (typeof min === "number" && Number.isFinite(min)) {
    nextValue = Math.max(min, nextValue);
  }

  if (typeof max === "number" && Number.isFinite(max)) {
    nextValue = Math.min(max, nextValue);
  }

  return nextValue;
}

export function resolveBoundedNumberCommit({
  draftValue,
  committedValue,
  min,
  max,
  parseValue = defaultParseValue,
  normalizeValue = (value) => value
}) {
  const parsedValue = parseValue(draftValue);

  if (!Number.isFinite(parsedValue)) {
    return committedValue;
  }

  return normalizeValue(clampNumber(parsedValue, min, max));
}
