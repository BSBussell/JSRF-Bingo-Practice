import { isTauriRuntime } from "../runtime.js";

export const DRILL_POPOUT_LABEL = "drill-popout";
export const DRILL_POPOUT_VIEW = "drill-popout";

function buildDrillPopoutUrl() {
  return new URL("/popout.html", window.location.href).toString();
}

function openBrowserDrillPopout(url) {
  const popupWindow = window.open(
    url,
    DRILL_POPOUT_LABEL,
    "popup=yes,resizable=yes,scrollbars=yes,width=760,height=920"
  );

  popupWindow?.focus();
  return popupWindow;
}

export async function openDrillPopoutWindow(alwaysOnTop = false) {
  if (typeof window === "undefined") {
    return null;
  }

  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_drill_popout", { alwaysOnTop });
      return DRILL_POPOUT_LABEL;
    } catch (error) {
      throw new Error(
        `Unable to open desktop popout via rust command: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const popoutUrl = buildDrillPopoutUrl();
  return openBrowserDrillPopout(popoutUrl);
}

export async function syncDrillPopoutAlwaysOnTop(alwaysOnTop) {
  if (!isTauriRuntime()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_drill_popout_always_on_top", { alwaysOnTop });
}

export function isDrillPopoutView() {
  if (typeof window === "undefined") {
    return false;
  }

  const currentUrl = new URL(window.location.href);
  return currentUrl.pathname.endsWith("/popout.html") || currentUrl.pathname.endsWith("popout.html");
}
