// Desktop-global shortcut registration for the Tauri build.
// We fully resync registrations whenever the effective shortcut set changes
// because partial diffing gets fragile fast once focus state and rebind mode
// are both allowed to suspend native capture.
import { useEffect, useMemo, useRef, useState } from "react";

import { isDrillPopoutView } from "../lib/drill/drillPopout.js";
import {
  getDesktopAcceleratorCandidates,
  formatHotkeyBinding,
  formatHotkeyKey,
  hasHotkeyModifier,
  HOTKEY_ACTIONS,
  normalizeHotkeyBinding
} from "../lib/hotkeys.js";
import { isTauriRuntime } from "../lib/runtime.js";

const MAX_ATTEMPTS = 24;
const DESKTOP_UNSUPPORTED_ACTIONS = new Set(["startCountdown"]);

function buildDesktopShortcutRequest(action, binding) {
  const normalizedBinding = normalizeHotkeyBinding(binding);
  if (!normalizedBinding) {
    return {
      action,
      displayLabel: "Unbound",
      accelerators: [],
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
      accelerators: [],
      accelerator: null,
      eligible: false,
      skipRegistration: false,
      reason: "Desktop global shortcuts require at least one modifier."
    };
  }

  const accelerators = getDesktopAcceleratorCandidates(normalizedBinding);
  if (accelerators.length === 0) {
    return {
      action,
      displayLabel: formatHotkeyBinding(normalizedBinding),
      accelerators: [],
      accelerator: null,
      eligible: false,
      skipRegistration: false,
      reason: `Unsupported desktop key "${formatHotkeyKey(normalizedBinding.code)}".`
    };
  }

  const accelerator = accelerators[0];

  return {
    action,
    displayLabel: formatHotkeyBinding(normalizedBinding),
    accelerators,
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
  const registeredAcceleratorsRef = useRef(new Set());
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

    async function clearKnownRegistrations(reason, allowStateUpdates = true) {
      if (!shortcutPlugin) {
        shortcutPlugin = await import("@tauri-apps/plugin-global-shortcut");
      }

      const acceleratorsToClear = new Set(registeredAcceleratorsRef.current);
      for (const requestedShortcut of requestedShortcuts) {
        for (const acceleratorCandidate of requestedShortcut.accelerators) {
          acceleratorsToClear.add(acceleratorCandidate);
        }
      }

      pushAttempt("unregister", "*", "pending", reason);

      let firstFailureMessage = null;
      const stillRegisteredAccelerators = new Set();
      for (const accelerator of acceleratorsToClear) {
        if (typeof shortcutPlugin.isRegistered === "function") {
          try {
            const isRegisteredByApp = await shortcutPlugin.isRegistered(accelerator);
            if (!isRegisteredByApp) {
              pushAttempt("unregister", accelerator, "success", "Already clear.");
              continue;
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            pushAttempt("unregister-check", accelerator, "failed", message);
            // Continue with unregister; this fallback keeps cleanup resilient if
            // the registration check itself is unavailable on a platform build.
          }
        }

        try {
          await shortcutPlugin.unregister(accelerator);
          pushAttempt("unregister", accelerator, "success", "Cleared prior registration.");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const alreadyClear = /not registered|unregistered|unknown shortcut/i.test(message);
          if (alreadyClear) {
            pushAttempt("unregister", accelerator, "success", "Already clear.");
            continue;
          }

          pushAttempt("unregister", accelerator, "failed", message);
          if (!firstFailureMessage) {
            firstFailureMessage = message;
          }
          stillRegisteredAccelerators.add(accelerator);
        }
      }

      registeredAcceleratorsRef.current = stillRegisteredAccelerators;

      if (!firstFailureMessage) {
        pushAttempt("unregister", "*", "success", reason);
        return true;
      }

      if (allowStateUpdates && !cancelled) {
        setWarningMessage(
          `Some native shortcuts could not be cleared cleanly: ${firstFailureMessage}`
        );
      }
      // Continue with registration attempts even when cleanup is partial. This
      // lets the sync loop surface actionable register conflicts per shortcut.
      pushAttempt("unregister", "*", "failed", reason);
      return true;
    }

    async function syncNativeShortcuts() {
      shortcutPlugin = await import("@tauri-apps/plugin-global-shortcut");

      // Clearing first is a little blunt, but it keeps native registration
      // state deterministic across focus changes, failed binds, and rebinding.
      const cleared = await clearKnownRegistrations(
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
      const nextRegisteredAccelerators = new Set();

      for (const requestedShortcut of requestedShortcuts) {
        if (cancelled) {
          return;
        }

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

        let registeredAccelerator = null;
        let failureMessage = null;

        for (const acceleratorCandidate of requestedShortcut.accelerators) {
          if (cancelled) {
            return;
          }

          try {
            await shortcutPlugin.register(acceleratorCandidate, (event) => {
              // The plugin reports both press and release transitions. The app's
              // actions are edge-triggered, so release events should be ignored.
              if (event.state !== "Pressed") {
                return;
              }

              const handler = handlersRef.current[requestedShortcut.action];
              handler?.();
            });

            if (cancelled) {
              try {
                await shortcutPlugin.unregister(acceleratorCandidate);
              } catch {
                // Best effort only; the next sync pass starts by unregistering all.
              }
              return;
            }

            registeredAccelerator = acceleratorCandidate;
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const alreadyRegistered = /already registered/i.test(message);

            if (alreadyRegistered && typeof shortcutPlugin.isRegistered === "function") {
              let isRegisteredByApp = false;

              try {
                isRegisteredByApp = await shortcutPlugin.isRegistered(acceleratorCandidate);
              } catch {
                isRegisteredByApp = false;
              }

              if (isRegisteredByApp) {
                pushAttempt(
                  "register",
                  acceleratorCandidate,
                  "pending",
                  "Shortcut already existed in this app; re-registering."
                );

                try {
                  await shortcutPlugin.unregister(acceleratorCandidate);
                  await shortcutPlugin.register(acceleratorCandidate, (event) => {
                    if (event.state !== "Pressed") {
                      return;
                    }

                    const handler = handlersRef.current[requestedShortcut.action];
                    handler?.();
                  });

                  if (cancelled) {
                    try {
                      await shortcutPlugin.unregister(acceleratorCandidate);
                    } catch {
                      // Best effort only; the next sync pass starts by unregistering all.
                    }
                    return;
                  }

                  registeredAccelerator = acceleratorCandidate;
                  break;
                } catch (retryError) {
                  const retryMessage =
                    retryError instanceof Error ? retryError.message : String(retryError);
                  pushAttempt("register", acceleratorCandidate, "failed", retryMessage);
                  failureMessage = retryMessage;
                  continue;
                }
              }

              const externalConflictMessage =
                `${message} (likely reserved by another application).`;
              pushAttempt("register", acceleratorCandidate, "failed", externalConflictMessage);
              failureMessage = externalConflictMessage;
              continue;
            }

            pushAttempt("register", acceleratorCandidate, "failed", message);
            failureMessage = message;
          }
        }

        if (registeredAccelerator) {
          nextRegisteredAccelerators.add(registeredAccelerator);
          pushAttempt(
            "register",
            registeredAccelerator,
            "success",
            `${requestedShortcut.action} registered.`
          );
          nextRegistrations[requestedShortcut.action] = createRegistrationEntry(
            requestedShortcut.action,
            registeredAccelerator,
            "registered",
            "Registered natively."
          );
          continue;
        }

        const fallbackFailureMessage =
          failureMessage ??
          "Registration failed for all accelerator formats.";
        const attemptedAccelerators = requestedShortcut.accelerators.join(", ");
        nextRegistrations[requestedShortcut.action] = createRegistrationEntry(
          requestedShortcut.action,
          requestedShortcut.accelerator,
          "failed",
          fallbackFailureMessage
        );
        failureMessages.push(
          `${requestedShortcut.action} (${attemptedAccelerators}): ${fallbackFailureMessage}`
        );
      }

      if (cancelled) {
        return;
      }

      registeredAcceleratorsRef.current = nextRegisteredAccelerators;
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
      // Do not unregister during cleanup: this async teardown can race with the
      // next effect run and wipe freshly-registered shortcuts.
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
