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

export async function getDesktopPlatformInfo() {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke("get_desktop_platform_info");
  } catch {
    return null;
  }
}

export async function getDesktopAppVersion() {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return null;
  }
}

export async function openExternalUrl(url) {
  if (typeof window === "undefined" || typeof url !== "string" || !url.trim()) {
    return false;
  }

  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_external_url", { url });
      return true;
    } catch (error) {
      console.warn("Failed to open external URL", error);
      return false;
    }
  }

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
  return true;
}
