// Desktop-global shortcut registration for the Tauri build.
// We fully resync registrations whenever the effective shortcut set changes
// because partial diffing gets fragile fast once focus state and rebind mode
// are both allowed to suspend native capture.
import { useEffect, useMemo, useRef, useState } from "react";

import { isDrillPopoutView } from "../lib/drill/drillPopout.js";
import {
  formatHotkeyBinding,
  formatHotkeyKey,
  getDesktopModifierParts,
  hasHotkeyModifier,
  HOTKEY_ACTIONS,
  normalizeHotkeyBinding
} from "../lib/hotkeys.js";
import { isTauriRuntime } from "../lib/runtime.js";

const MAX_ATTEMPTS = 24;
const DESKTOP_UNSUPPORTED_ACTIONS = new Set(["startCountdown"]);

function toDesktopMainKey(code) {
  if (!code) {
    return null;
  }

  if (code.startsWith("Key")) {
    return code;
  }

  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  if (code.startsWith("Numpad")) {
    return code;
  }

  switch (code) {
    case "Enter":
    case "Space":
    case "Tab":
    case "Backspace":
    case "Delete":
    case "Escape":
    case "Home":
    case "End":
    case "PageUp":
    case "PageDown":
    case "Insert":
    case "Pause":
    case "PrintScreen":
      return code;
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "Minus":
      return "-";
    case "Equal":
      return "=";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    case "Backslash":
    case "IntlBackslash":
      return "Backslash";
    case "Semicolon":
      return ";";
    case "Quote":
      return "'";
    case "Backquote":
      return "`";
    case "Comma":
      return ",";
    case "Period":
      return ".";
    case "Slash":
      return "/";
    default:
      // Function keys are the only open-ended family we currently accept.
      return /^F\d{1,2}$/.test(code) ? code : null;
  }
}

function buildDesktopShortcutRequest(action, binding) {
  const normalizedBinding = normalizeHotkeyBinding(binding);
  if (!normalizedBinding) {
    return {
      action,
      displayLabel: "Unbound",
      accelerator: null,
      eligible: false,
      skipRegistration: true,
      reason: "No binding set."
    };
  }

  if (!hasHotkeyModifier(normalizedBinding)) {
    return {
      action,
      displayLabel: formatHotkeyBinding(normalizedBinding),
      accelerator: null,
      eligible: false,
      skipRegistration: false,
      reason: "Desktop global shortcuts require at least one modifier."
    };
  }

  const mainKey = toDesktopMainKey(normalizedBinding.code);
  if (!mainKey) {
    return {
      action,
      displayLabel: formatHotkeyBinding(normalizedBinding),
      accelerator: null,
      eligible: false,
      skipRegistration: false,
      reason: `Unsupported desktop key "${formatHotkeyKey(normalizedBinding.code)}".`
    };
  }

  const accelerator = [...getDesktopModifierParts(normalizedBinding), mainKey].join("+");

  return {
    action,
    displayLabel: formatHotkeyBinding(normalizedBinding),
    accelerator,
    eligible: true,
    skipRegistration: false,
    reason: null
  };
}

function createRegistrationEntry(action, accelerator, status, message) {
  return {
    action,
    accelerator,
    status,
    message
  };
}

export function useDesktopGlobalShortcuts({
  enabled,
  hasWindowFocus,
  suspendNative,
  suspendReason,
  hotkeys,
  onSplit,
  onSkip,
  onPause,
  onRunBack,
  onSkipSplit,
  onToggleGuide,
  onEnd
}) {
  const [attempts, setAttempts] = useState([]);
  const [registrations, setRegistrations] = useState({});
  const [warningMessage, setWarningMessage] = useState(null);
  const handlersRef = useRef({
    split: onSplit,
    skip: onSkip,
    pause: onPause,
    runBack: onRunBack,
    skipSplit: onSkipSplit,
    toggleGuide: onToggleGuide,
    end: onEnd
  });
  const requestedShortcuts = useMemo(
    () =>
      HOTKEY_ACTIONS
        .filter((action) => !DESKTOP_UNSUPPORTED_ACTIONS.has(action.key))
        .map((action) => buildDesktopShortcutRequest(action.key, hotkeys[action.key])),
    [hotkeys]
  );
  const requestedSignature = useMemo(
    () => JSON.stringify(requestedShortcuts),
    [requestedShortcuts]
  );
  const nativeModeActive =
    enabled && !hasWindowFocus && !suspendNative && isTauriRuntime() && !isDrillPopoutView();

  useEffect(() => {
    handlersRef.current = {
      split: onSplit,
      skip: onSkip,
      pause: onPause,
      runBack: onRunBack,
      skipSplit: onSkipSplit,
      toggleGuide: onToggleGuide,
      end: onEnd
    };
  }, [onEnd, onPause, onRunBack, onSkip, onSkipSplit, onSplit, onToggleGuide]);

  useEffect(() => {
    if (!isTauriRuntime() || isDrillPopoutView()) {
      return undefined;
    }

    let cancelled = false;
    let shortcutPlugin = null;

    function pushAttempt(type, accelerator, status, message) {
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        accelerator,
        status,
        message
      };

      const logMethod = status === "failed" ? console.warn : console.info;
      logMethod(
        `[desktop-shortcut] ${type} ${status} ${accelerator}${message ? ` :: ${message}` : ""}`
      );

      if (!cancelled) {
        setAttempts((previousAttempts) => [entry, ...previousAttempts].slice(0, MAX_ATTEMPTS));
      }
    }

    async function unregisterAll(reason, allowStateUpdates = true) {
      if (!shortcutPlugin) {
        shortcutPlugin = await import("@tauri-apps/plugin-global-shortcut");
      }

      pushAttempt("unregisterAll", "*", "pending", reason);
      try {
        await shortcutPlugin.unregisterAll();
        pushAttempt("unregisterAll", "*", "success", reason);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushAttempt("unregisterAll", "*", "failed", message);
        if (allowStateUpdates && !cancelled) {
          setWarningMessage(`Failed to clear native global shortcuts: ${message}`);
        }
        return false;
      }
    }

    async function syncNativeShortcuts() {
      shortcutPlugin = await import("@tauri-apps/plugin-global-shortcut");

      // Clearing first is a little blunt, but it keeps native registration
      // state deterministic across focus changes, failed binds, and rebinding.
      const cleared = await unregisterAll(
        nativeModeActive
          ? "Preparing native registrations for unfocused mode."
          : suspendNative
            ? `Native shortcuts suspended: ${suspendReason ?? "rebinding in progress."}`
            : hasWindowFocus
              ? "Window focused; native global shortcuts disabled."
              : "Native global shortcuts disabled."
      );

      if (cancelled) {
        return;
      }

      if (!cleared) {
        return;
      }

      if (!nativeModeActive) {
        setRegistrations({});
        setWarningMessage(null);
        return;
      }

      const nextRegistrations = {};
      const failureMessages = [];

      for (const requestedShortcut of requestedShortcuts) {
        if (!requestedShortcut.eligible) {
          if (requestedShortcut.skipRegistration) {
            nextRegistrations[requestedShortcut.action] = createRegistrationEntry(
              requestedShortcut.action,
              null,
              "idle",
              requestedShortcut.reason
            );
            continue;
          }

          pushAttempt(
            "register",
            requestedShortcut.accelerator ?? requestedShortcut.displayLabel,
            "failed",
            requestedShortcut.reason
          );
          nextRegistrations[requestedShortcut.action] = createRegistrationEntry(
            requestedShortcut.action,
            requestedShortcut.accelerator ?? requestedShortcut.displayLabel,
            "failed",
            requestedShortcut.reason
          );
          failureMessages.push(requestedShortcut.reason);
          continue;
        }

        pushAttempt(
          "register",
          requestedShortcut.accelerator,
          "pending",
          `${requestedShortcut.action} native registration requested.`
        );

        try {
          await shortcutPlugin.register(requestedShortcut.accelerator, (event) => {
            // The plugin reports both press and release transitions. The app's
            // actions are edge-triggered, so release events should be ignored.
            if (event.state !== "Pressed") {
              return;
            }

            const handler = handlersRef.current[requestedShortcut.action];
            handler?.();
          });

          pushAttempt(
            "register",
            requestedShortcut.accelerator,
            "success",
            `${requestedShortcut.action} registered.`
          );
          nextRegistrations[requestedShortcut.action] = createRegistrationEntry(
            requestedShortcut.action,
            requestedShortcut.accelerator,
            "registered",
            "Registered natively."
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pushAttempt("register", requestedShortcut.accelerator, "failed", message);
          nextRegistrations[requestedShortcut.action] = createRegistrationEntry(
            requestedShortcut.action,
            requestedShortcut.accelerator,
            "failed",
            message
          );
          failureMessages.push(`${requestedShortcut.accelerator}: ${message}`);
        }
      }

      if (cancelled) {
        return;
      }

      setRegistrations(nextRegistrations);
      setWarningMessage(
        failureMessages.length > 0 ? `Native shortcut registration failed: ${failureMessages[0]}` : null
      );
    }

    syncNativeShortcuts().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      pushAttempt("sync", "*", "failed", message);
      setWarningMessage(`Failed to initialize native global shortcuts: ${message}`);
    });

    return () => {
      cancelled = true;

      if (!shortcutPlugin) {
        return;
      }

      // Best-effort cleanup only; surfacing teardown failures during unmount is
      // usually more noise than signal.
      unregisterAll("Effect cleanup.", false).catch(() => {});
    };
  }, [hasWindowFocus, nativeModeActive, requestedSignature, suspendNative, suspendReason]);

  return {
    focusState: hasWindowFocus ? "focused" : "unfocused",
    desktopGlobalModeActive: nativeModeActive,
    requestedShortcuts,
    registrations: HOTKEY_ACTIONS.map((action) =>
      DESKTOP_UNSUPPORTED_ACTIONS.has(action.key)
        ? createRegistrationEntry(action.key, null, "idle", "Not available in desktop-global mode.")
        : registrations[action.key] ??
            createRegistrationEntry(action.key, null, "idle", "Not registered.")
    ),
    attempts,
    warningMessage
  };
}
