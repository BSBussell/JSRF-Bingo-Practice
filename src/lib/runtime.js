export function isTauriRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  // `isTauri` is set by the runtime even when the global Tauri API object
  // is not exposed. Keep both checks so desktop detection remains stable
  // across Tauri config/runtime differences.
  return (
    typeof window.__TAURI_INTERNALS__ !== "undefined" ||
    (typeof globalThis !== "undefined" && Boolean(globalThis.isTauri))
  );
}
