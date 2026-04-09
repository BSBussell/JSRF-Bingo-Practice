const RELEASES_API_URL =
  "https://api.github.com/repos/BSBussell/JSRF-Bingo-Practice/releases/latest";

const IGNORE_NAME_TOKENS = [".sig", ".blockmap", ".sha256", ".sha512", "checksum"];
const MAC_ARM64_TOKENS = ["arm64", "aarch64", "apple-silicon"];
const MAC_X64_TOKENS = ["x64", "x86_64", "amd64", "intel"];
const MAC_UNIVERSAL_TOKENS = ["universal", "univ", "all"];

let latestReleasePromise = null;

function normalizeStringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArchitecture(arch) {
  const normalized = normalizeStringValue(arch).toLowerCase();

  if (["arm64", "aarch64"].includes(normalized)) {
    return "arm64";
  }

  if (["x64", "x86_64", "amd64"].includes(normalized)) {
    return "x64";
  }

  return "unknown";
}

function normalizeOperatingSystem(os) {
  const normalized = normalizeStringValue(os).toLowerCase();

  if (normalized.includes("win")) {
    return "windows";
  }

  if (
    normalized.includes("mac") ||
    normalized.includes("darwin") ||
    normalized.includes("osx")
  ) {
    return "macos";
  }

  if (normalized.includes("linux")) {
    return "linux";
  }

  return null;
}

function hasMatchingToken(value, tokens) {
  return tokens.some((token) => value.includes(token));
}

function getFileExtensionScore(fileName, suffixes) {
  for (let index = 0; index < suffixes.length; index += 1) {
    if (fileName.endsWith(suffixes[index])) {
      return suffixes.length - index;
    }
  }

  return 0;
}

function parseVersionIdentifier(identifier) {
  return /^\d+$/.test(identifier) ? Number(identifier) : identifier.toLowerCase();
}

function parseVersion(value) {
  const normalized = normalizeVersion(value);
  if (!normalized) {
    return null;
  }

  const [corePart, prereleasePart = ""] = normalized.split("-", 2);
  if (!/^\d+(?:\.\d+)*$/.test(corePart)) {
    return null;
  }

  return {
    core: corePart.split(".").map((part) => Number(part)),
    prerelease: prereleasePart
      ? prereleasePart
          .split(".")
          .filter(Boolean)
          .map((part) => parseVersionIdentifier(part))
      : []
  };
}

function compareVersionIdentifier(left, right) {
  const leftIsNumber = typeof left === "number";
  const rightIsNumber = typeof right === "number";

  if (leftIsNumber && rightIsNumber) {
    return left - right;
  }

  if (leftIsNumber) {
    return -1;
  }

  if (rightIsNumber) {
    return 1;
  }

  return left.localeCompare(right);
}

function parseReleaseAsset(asset) {
  const name = normalizeStringValue(asset?.name);
  const browserDownloadUrl = normalizeStringValue(asset?.browser_download_url);

  if (!name || !browserDownloadUrl) {
    return null;
  }

  return {
    id: asset?.id ?? null,
    name,
    browserDownloadUrl,
    contentType: normalizeStringValue(asset?.content_type) || null,
    size: typeof asset?.size === "number" ? asset.size : 0
  };
}

function parseLatestRelease(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return {
    id: payload.id ?? null,
    name: normalizeStringValue(payload.name) || null,
    tagName: normalizeStringValue(payload.tag_name) || null,
    version: normalizeVersion(payload.tag_name),
    htmlUrl: normalizeStringValue(payload.html_url) || null,
    assets: Array.isArray(payload.assets) ? payload.assets.map(parseReleaseAsset).filter(Boolean) : []
  };
}

function detectMacAssetArchitecture(fileName) {
  if (hasMatchingToken(fileName, MAC_UNIVERSAL_TOKENS)) {
    return "universal";
  }

  if (hasMatchingToken(fileName, MAC_ARM64_TOKENS)) {
    return "arm64";
  }

  if (hasMatchingToken(fileName, MAC_X64_TOKENS)) {
    return "x64";
  }

  return "generic";
}

function getMacArchitectureScore(assetArchitecture, requestedArchitecture) {
  if (requestedArchitecture === "arm64") {
    switch (assetArchitecture) {
      case "arm64":
        return 80;
      case "universal":
        return 70;
      case "generic":
        return 45;
      case "x64":
        return 10;
      default:
        return 0;
    }
  }

  if (requestedArchitecture === "x64") {
    switch (assetArchitecture) {
      case "x64":
        return 80;
      case "universal":
        return 70;
      case "generic":
        return 45;
      case "arm64":
        return 10;
      default:
        return 0;
    }
  }

  switch (assetArchitecture) {
    case "universal":
      return 80;
    case "arm64":
      return 70;
    case "generic":
      return 45;
    case "x64":
      return 35;
    default:
      return 0;
  }
}

function rankWindowsAsset(asset) {
  const fileName = asset.name.toLowerCase();
  const extensionScore = getFileExtensionScore(fileName, [".exe", ".msi"]);

  if (!extensionScore) {
    return null;
  }

  return 300 + extensionScore * 10;
}

function rankMacAsset(asset, platform) {
  const fileName = asset.name.toLowerCase();
  const extensionScore = getFileExtensionScore(fileName, [".dmg", ".pkg", ".app.tar.gz", ".zip"]);

  if (!extensionScore) {
    return null;
  }

  const assetArchitecture = detectMacAssetArchitecture(fileName);
  const architectureScore = getMacArchitectureScore(assetArchitecture, platform.arch);

  if (!architectureScore) {
    return null;
  }

  return 200 + architectureScore + extensionScore * 10;
}

function rankLinuxAsset(asset) {
  const fileName = asset.name.toLowerCase();
  const extensionScore = getFileExtensionScore(fileName, [".appimage", ".deb", ".rpm"]);

  if (!extensionScore) {
    return null;
  }

  return 250 + extensionScore * 10;
}

function rankAssetForPlatform(asset, platform) {
  const fileName = asset.name.toLowerCase();

  if (hasMatchingToken(fileName, IGNORE_NAME_TOKENS)) {
    return null;
  }

  switch (platform?.os) {
    case "windows":
      return rankWindowsAsset(asset);
    case "macos":
      return rankMacAsset(asset, platform);
    case "linux":
      return rankLinuxAsset(asset);
    default:
      return null;
  }
}

export function normalizeVersion(value) {
  const normalized = normalizeStringValue(value)
    .replace(/^v/i, "")
    .split("+", 1)[0];

  return normalized || null;
}

export function compareVersions(left, right) {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);

  if (!parsedLeft || !parsedRight) {
    return 0;
  }

  const maxCoreLength = Math.max(parsedLeft.core.length, parsedRight.core.length);
  for (let index = 0; index < maxCoreLength; index += 1) {
    const leftPart = parsedLeft.core[index] ?? 0;
    const rightPart = parsedRight.core[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  const leftHasPrerelease = parsedLeft.prerelease.length > 0;
  const rightHasPrerelease = parsedRight.prerelease.length > 0;

  if (!leftHasPrerelease && !rightHasPrerelease) {
    return 0;
  }

  if (!leftHasPrerelease) {
    return 1;
  }

  if (!rightHasPrerelease) {
    return -1;
  }

  const maxPrereleaseLength = Math.max(parsedLeft.prerelease.length, parsedRight.prerelease.length);
  for (let index = 0; index < maxPrereleaseLength; index += 1) {
    const leftPart = parsedLeft.prerelease[index];
    const rightPart = parsedRight.prerelease[index];

    if (leftPart === undefined) {
      return -1;
    }

    if (rightPart === undefined) {
      return 1;
    }

    const comparison = compareVersionIdentifier(leftPart, rightPart);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

export function normalizePlatform({ os, arch = "unknown", source = "unknown" } = {}) {
  const normalizedOs = normalizeOperatingSystem(os);
  if (!normalizedOs) {
    return null;
  }

  return {
    os: normalizedOs,
    arch: normalizeArchitecture(arch),
    source
  };
}

export async function detectBrowserPlatform() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const userAgent = normalizeStringValue(navigator.userAgent);
  if (/android|iphone|ipad|ipod/i.test(userAgent)) {
    return null;
  }

  const platformHint = [
    normalizeStringValue(navigator.userAgentData?.platform),
    normalizeStringValue(navigator.platform),
    userAgent
  ]
    .filter(Boolean)
    .join(" ");

  const normalizedPlatform = normalizePlatform({
    os: platformHint,
    source: "web"
  });

  if (!normalizedPlatform) {
    return null;
  }

  if (normalizedPlatform.os !== "macos") {
    return normalizedPlatform;
  }

  let architecture = "unknown";

  // Browser APIs often hide Mac CPU details, especially in Safari.
  // We keep that ambiguity explicit so ranking can prefer universal builds
  // first and fall back to arm64 before x64 when the browser cannot tell us.
  if (typeof navigator.userAgentData?.getHighEntropyValues === "function") {
    try {
      const details = await navigator.userAgentData.getHighEntropyValues(["architecture"]);
      architecture = normalizeArchitecture(details.architecture);
    } catch {
      architecture = "unknown";
    }
  }

  if (architecture === "unknown") {
    if (/\b(?:arm64|aarch64)\b/i.test(userAgent)) {
      architecture = "arm64";
    } else if (/\b(?:x64|x86_64|amd64|intel)\b/i.test(userAgent)) {
      architecture = "x64";
    }
  }

  return {
    ...normalizedPlatform,
    arch: architecture
  };
}

export function selectBestReleaseAsset(assets, platform) {
  if (!platform || !Array.isArray(assets) || assets.length === 0) {
    return null;
  }

  const candidates = assets
    .map((asset) => ({
      asset,
      score: rankAssetForPlatform(asset, platform)
    }))
    .filter((candidate) => candidate.score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if ((right.asset.size ?? 0) !== (left.asset.size ?? 0)) {
        return (right.asset.size ?? 0) - (left.asset.size ?? 0);
      }

      return left.asset.name.localeCompare(right.asset.name);
    });

  return candidates[0]?.asset ?? null;
}

export async function fetchLatestRelease({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    return null;
  }

  if (fetchImpl === globalThis.fetch && latestReleasePromise) {
    return latestReleasePromise;
  }

  const request = (async () => {
    try {
      const response = await fetchImpl(RELEASES_API_URL, {
        headers: {
          Accept: "application/vnd.github+json"
        }
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      return parseLatestRelease(payload);
    } catch {
      return null;
    }
  })();

  if (fetchImpl === globalThis.fetch) {
    latestReleasePromise = request.then((release) => {
      if (!release) {
        latestReleasePromise = null;
      }

      return release;
    });
    return latestReleasePromise;
  }

  return request;
}

export async function getReleaseDownloadInfo({
  platform,
  currentVersion = null,
  fetchImpl = globalThis.fetch
} = {}) {
  const release = await fetchLatestRelease({ fetchImpl });
  if (!release) {
    return null;
  }

  const asset = selectBestReleaseAsset(release.assets, platform);
  if (!asset) {
    return null;
  }

  const normalizedCurrentVersion = normalizeVersion(currentVersion);
  const isUpdateAvailable = normalizedCurrentVersion
    ? compareVersions(release.version, normalizedCurrentVersion) > 0
    : true;

  return {
    release,
    asset,
    isUpdateAvailable
  };
}
