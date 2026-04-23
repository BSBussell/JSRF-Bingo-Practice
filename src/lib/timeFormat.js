export function formatDuration(durationMs) {
  if (typeof durationMs !== "number" || Number.isNaN(durationMs)) {
    return "00:00.0";
  }

  const totalTenths = Math.floor(durationMs / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function formatOptionalDuration(durationMs, fallback = "n/a") {
  return typeof durationMs === "number" && Number.isFinite(durationMs)
    ? formatDuration(durationMs)
    : fallback;
}

export function formatDurationDelta(durationMs, fallback = "n/a") {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return fallback;
  }

  const prefix = durationMs > 0 ? "+" : durationMs < 0 ? "-" : "";
  return `${prefix}${formatDuration(Math.abs(durationMs))}`;
}

export function formatTimestamp(timestamp, fallback = "Unknown") {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
