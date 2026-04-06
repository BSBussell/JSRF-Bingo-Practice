import { useEffect, useState } from "react";

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

export function useTimer(startedAt, pausedAt = null, accumulatedPausedMs = 0) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt) {
      return undefined;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [startedAt]);

  const referenceNow = pausedAt ?? now;
  const elapsedMs = startedAt
    ? Math.max(0, referenceNow - startedAt - accumulatedPausedMs)
    : 0;

  return {
    elapsedMs,
    formattedElapsed: formatDuration(elapsedMs),
    isRunning: Boolean(startedAt) && !pausedAt,
    isPaused: Boolean(startedAt) && Boolean(pausedAt)
  };
}
