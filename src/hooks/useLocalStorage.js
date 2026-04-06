// localStorage persistence with cross-window sync for both browser tabs and
// Tauri windows. The awkward bit is avoiding broadcast echo loops while still
// letting a newly opened window ask the others for the freshest state.
import { useEffect, useRef, useState } from "react";

import { isTauriRuntime } from "../lib/runtime.js";

const STORAGE_SYNC_CHANNEL = "jsrf-bingo-trainer-storage-sync";
const STORAGE_SYNC_EVENT = "jsrf-bingo-trainer:storage-sync";
const STORAGE_SYNC_REQUEST_EVENT = "jsrf-bingo-trainer:storage-sync-request";

function buildInstanceId() {
  return `storage-instance-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeParseStorageValue(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  return JSON.parse(rawValue);
}

function safeSerializeStorageValue(value) {
  return JSON.stringify(value);
}

function createStorageSyncPayload(key, sourceId, value) {
  return {
    key,
    sourceId,
    value
  };
}

function broadcastStorageSync({
  key,
  sourceId,
  value,
  broadcastChannel,
  tauriEmitter,
  warningContext
}) {
  const payload = createStorageSyncPayload(key, sourceId, value);

  broadcastChannel?.postMessage({
    type: "sync",
    payload
  });

  tauriEmitter?.(STORAGE_SYNC_EVENT, payload).catch((error) => {
    console.warn(warningContext, error);
  });
}

export function useLocalStorage(key, initialValue, normalize = (value) => value) {
  const instanceIdRef = useRef(buildInstanceId());
  const lastSerializedValueRef = useRef(null);
  const suppressNextBroadcastRef = useRef(false);
  const broadcastChannelRef = useRef(null);
  const tauriEmitterRef = useRef(null);
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") {
      const normalizedValue = normalize(initialValue);
      lastSerializedValueRef.current = safeSerializeStorageValue(normalizedValue);
      return normalizedValue;
    }

    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue === null) {
        const normalizedValue = normalize(initialValue);
        lastSerializedValueRef.current = safeSerializeStorageValue(normalizedValue);
        return normalizedValue;
      }

      const normalizedValue = normalize(safeParseStorageValue(storedValue));
      lastSerializedValueRef.current = safeSerializeStorageValue(normalizedValue);
      return normalizedValue;
    } catch (error) {
      console.warn(`Failed to read localStorage key "${key}"`, error);
      const normalizedValue = normalize(initialValue);
      lastSerializedValueRef.current = safeSerializeStorageValue(normalizedValue);
      return normalizedValue;
    }
  });
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const serializedValue = safeSerializeStorageValue(value);
    lastSerializedValueRef.current = serializedValue;

    try {
      window.localStorage.setItem(key, serializedValue);
    } catch (error) {
      console.warn(`Failed to write localStorage key "${key}"`, error);
    }

    if (suppressNextBroadcastRef.current) {
      // External updates still need to land locally, but they should not
      // bounce straight back out onto every sync channel.
      suppressNextBroadcastRef.current = false;
      return;
    }

    broadcastStorageSync({
      key,
      sourceId: instanceIdRef.current,
      value,
      broadcastChannel: broadcastChannelRef.current,
      tauriEmitter: tauriEmitterRef.current,
      warningContext: "Failed to broadcast synced app state to Tauri windows"
    });
  }, [key, value]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function applyExternalValue(nextValue, sourceId) {
      if (sourceId === instanceIdRef.current) {
        return;
      }

      const normalizedValue = normalize(nextValue);
      const serializedValue = safeSerializeStorageValue(normalizedValue);
      if (serializedValue === lastSerializedValueRef.current) {
        return;
      }

      // The serialized snapshot check matters because normalize() can rewrite
      // shape during migrations; equal data should still settle quietly.
      suppressNextBroadcastRef.current = true;
      lastSerializedValueRef.current = serializedValue;
      valueRef.current = normalizedValue;
      setValue(normalizedValue);
    }

    function broadcastCurrentValue() {
      broadcastStorageSync({
        key,
        sourceId: instanceIdRef.current,
        value: valueRef.current,
        broadcastChannel: broadcastChannelRef.current,
        tauriEmitter: tauriEmitterRef.current,
        warningContext: "Failed to answer synced app state request"
      });
    }

    function handleStorage(event) {
      if (event.storageArea !== window.localStorage || event.key !== key || event.newValue === null) {
        return;
      }

      try {
        applyExternalValue(safeParseStorageValue(event.newValue), null);
      } catch (error) {
        console.warn(`Failed to sync localStorage key "${key}" from another window`, error);
      }
    }

    window.addEventListener("storage", handleStorage);

    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(STORAGE_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        const message = event.data;
        if (!message) {
          return;
        }

        if (message.type === "request") {
          if (message.key === key && message.sourceId !== instanceIdRef.current) {
            broadcastCurrentValue();
          }
          return;
        }

        if (message.type === "sync" && message.payload?.key === key) {
          applyExternalValue(message.payload.value, message.payload.sourceId);
        }
      };

      broadcastChannelRef.current = channel;
      // New tabs ask first so an already-running window can answer with fresher
      // in-memory state before the user touches stale localStorage.
      channel.postMessage({
        type: "request",
        key,
        sourceId: instanceIdRef.current
      });
    }

    let cancelled = false;
    let unlistenSync = null;
    let unlistenRequest = null;

    if (isTauriRuntime()) {
      import("@tauri-apps/api/event")
        .then(async ({ emit, listen }) => {
          if (cancelled) {
            return;
          }

          tauriEmitterRef.current = emit;
          unlistenSync = await listen(STORAGE_SYNC_EVENT, (event) => {
            const payload = event.payload;
            if (!payload || payload.key !== key) {
              return;
            }

            applyExternalValue(payload.value, payload.sourceId);
          });
          unlistenRequest = await listen(STORAGE_SYNC_REQUEST_EVENT, (event) => {
            const payload = event.payload;
            if (!payload || payload.key !== key || payload.sourceId === instanceIdRef.current) {
              return;
            }

            broadcastCurrentValue();
          });

          await emit(STORAGE_SYNC_REQUEST_EVENT, {
            key,
            sourceId: instanceIdRef.current
          });
        })
        .catch((error) => {
          console.warn("Failed to initialize Tauri state sync", error);
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
      tauriEmitterRef.current = null;
      unlistenSync?.();
      unlistenRequest?.();
    };
  }, [key, normalize]);

  return [value, setValue];
}
