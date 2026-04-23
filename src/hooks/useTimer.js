import { useEffect, useState } from "react";

import { formatDuration } from "../lib/timeFormat.js";

export { formatDuration };

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
