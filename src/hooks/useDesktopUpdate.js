import { useEffect, useState } from "react";

import {
  getReleaseDownloadInfo,
  normalizePlatform
} from "../lib/releases.js";
import {
  getDesktopAppVersion,
  getDesktopPlatformInfo,
  openExternalUrl
} from "../lib/runtime.js";

const IDLE_STATE = {
  isChecking: false,
  asset: null,
  release: null,
  installedVersion: null
};

export function useDesktopUpdate({ enabled = true } = {}) {
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
      release: null,
      installedVersion: null
    });

    async function loadUpdate() {
      const [desktopPlatformInfo, installedVersion] = await Promise.all([
        getDesktopPlatformInfo(),
        getDesktopAppVersion()
      ]);

      const platform = normalizePlatform({
        os: desktopPlatformInfo?.os,
        arch: desktopPlatformInfo?.arch,
        source: "desktop"
      });

      if (!platform || !installedVersion) {
        if (!cancelled) {
          setState(IDLE_STATE);
        }
        return;
      }

      const releaseDownload = await getReleaseDownloadInfo({
        platform,
        currentVersion: installedVersion
      });

      if (cancelled || !releaseDownload?.asset || !releaseDownload.isUpdateAvailable) {
        if (!cancelled) {
          setState(IDLE_STATE);
        }
        return;
      }

      setState({
        isChecking: false,
        asset: releaseDownload.asset,
        release: releaseDownload.release,
        installedVersion
      });
    }

    loadUpdate();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    isChecking: state.isChecking,
    action: state.asset
      ? {
          label: "Update!",
          tone: "highlight",
          title:
            state.release?.tagName && state.installedVersion
              ? `Update from ${state.installedVersion} to ${state.release.tagName}`
              : "Download the latest desktop build",
          onClick() {
            void openExternalUrl(state.asset.browserDownloadUrl);
          }
        }
      : null
  };
}
