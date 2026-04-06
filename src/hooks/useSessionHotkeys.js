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
  onEnd
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
  }, [enabled, currentSession, hotkeys, onEnd, onPause, onSkip, onSplit]);
}
