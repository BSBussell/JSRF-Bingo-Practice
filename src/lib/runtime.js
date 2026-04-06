export function isTauriRuntime() {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}
