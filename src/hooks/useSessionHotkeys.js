import { useEffect } from "react";
import { eventMatchesHotkeyBinding, HOTKEY_ACTIONS } from "../lib/hotkeys.js";

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

export function useSessionHotkeys({
  enabled,
  currentSession,
  startCountdown,
  hotkeys,
  onSplit,
  onSkip,
  onPause,
  onRunBack,
  onSkipSplit,
  onToggleGuide,
  onStartCountdown,
  onEnd,
  onRouteSlot
}) {
  useEffect(() => {
    if (!enabled || (!currentSession && !startCountdown)) {
      return undefined;
    }

    const isRouteSession = currentSession?.sessionType === "route";
    const isPracticeSession = Boolean(currentSession) && !isRouteSession;
    const hasActiveSession = Boolean(currentSession);
    const isCountdownPendingReady =
      Boolean(startCountdown) && !Number.isFinite(startCountdown?.startedAt);
    const actionIsEnabled = {
      split: isPracticeSession,
      skip: isPracticeSession,
      pause: hasActiveSession,
      runBack: hasActiveSession,
      skipSplit: isPracticeSession,
      toggleGuide: isPracticeSession,
      startCountdown: isCountdownPendingReady,
      end: hasActiveSession || Boolean(startCountdown)
    };
    const handlersByAction = {
      split: onSplit,
      skip: onSkip,
      pause: onPause,
      runBack: onRunBack,
      skipSplit: onSkipSplit,
      toggleGuide: onToggleGuide,
      startCountdown: onStartCountdown,
      end: onEnd
    };

    function handleKeyDown(event) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (
        isRouteSession &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.metaKey
      ) {
        const routeSlotIndex =
          event.code === "Digit0"
            ? 9
            : /^Digit[1-9]$/.test(event.code)
              ? Number(event.code.slice(5)) - 1
              : null;

        if (routeSlotIndex !== null) {
          event.preventDefault();
          onRouteSlot?.(routeSlotIndex);
          return;
        }
      }

      const matchedAction = HOTKEY_ACTIONS.find((action) => {
        if (!actionIsEnabled[action.key]) {
          return false;
        }

        return eventMatchesHotkeyBinding(hotkeys[action.key], event);
      })?.key;
      if (!matchedAction) {
        return;
      }

      const handler = handlersByAction[matchedAction];
      if (!handler) {
        return;
      }

      event.preventDefault();
      handler();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    enabled,
    currentSession,
    hotkeys,
    onEnd,
    onPause,
    onRouteSlot,
    onRunBack,
    onSkip,
    onSkipSplit,
    onSplit,
    onStartCountdown,
    onToggleGuide,
    startCountdown
  ]);
}
