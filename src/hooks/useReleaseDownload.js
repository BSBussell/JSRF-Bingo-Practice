import { useEffect, useState } from "react";

import { detectBrowserPlatform, getReleaseDownloadInfo } from "../lib/releases.js";
import { openExternalUrl } from "../lib/runtime.js";

const IDLE_STATE = {
  isChecking: false,
  asset: null,
  release: null
};

export function useReleaseDownload({ enabled = true } = {}) {
  const [state, setState] = useState(IDLE_STATE);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setState(IDLE_STATE);
      return undefined;
    }

    setState({
      isChecking: true,
      asset: null,
      release: null
    });

    async function loadRelease() {
      const platform = await detectBrowserPlatform();
      if (!platform) {
        if (!cancelled) {
          setState(IDLE_STATE);
        }
        return;
      }

      const releaseDownload = await getReleaseDownloadInfo({ platform });
      if (cancelled || !releaseDownload?.asset) {
        if (!cancelled) {
          setState(IDLE_STATE);
        }
        return;
      }

      setState({
        isChecking: false,
        asset: releaseDownload.asset,
        release: releaseDownload.release
      });
    }

    loadRelease();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    isChecking: state.isChecking,
    action: state.asset
      ? {
          label: "Download",
          tone: "default",
          title: state.release?.tagName
            ? `Download ${state.release.tagName}`
            : "Download the latest desktop build",
          onClick() {
            void openExternalUrl(state.asset.browserDownloadUrl);
          }
        }
      : null
  };
}

