import { isTauriRuntime } from "./runtime.js";

export const DRILL_POPOUT_LABEL = "drill-popout";
export const DRILL_POPOUT_VIEW = "drill-popout";

function buildDrillPopoutUrl() {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("view", DRILL_POPOUT_VIEW);
  return currentUrl.toString();
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

  const popoutUrl = buildDrillPopoutUrl();

  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_drill_popout", { url: popoutUrl, alwaysOnTop });
    return DRILL_POPOUT_LABEL;
  }

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

  return new URLSearchParams(window.location.search).get("view") === DRILL_POPOUT_VIEW;
}
