import { useEffect } from "react";
import { eventMatchesHotkeyBinding } from "../lib/hotkeys.js";

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

export function useSessionHotkeys({
  enabled,
  currentSession,
  hotkeys,
  onSplit,
  onSkip,
  onPause,
  onEnd,
  onRouteSlot
}) {
  useEffect(() => {
    if (!enabled || !currentSession) {
      return undefined;
    }

    const handlersByAction = {
      split: onSplit,
      skip: onSkip,
      pause: onPause,
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
        currentSession?.sessionType === "route" &&
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

      const matchedAction = Object.entries(hotkeys).find(([, binding]) =>
        eventMatchesHotkeyBinding(binding, event)
      )?.[0];
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
  }, [enabled, currentSession, hotkeys, onEnd, onPause, onRouteSlot, onSkip, onSplit]);
}
