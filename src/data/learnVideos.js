import learningVideoLibrary from "./generated/learningVideoLibrary.json" with { type: "json" };

export const PRIMARY_LEARNING_VIDEO_PLAYLIST_URL =
  "https://youtube.com/playlist?list=PLDHncjR554MyBVGa7Z9WUU-fIC5d_BFrT";

/*
Expected generated manifest shape:
{
  schemaVersion: 1,
  generatedAt: string,
  sources: [{ key, label, url, playlistId, entryCount }],
  objectives: {
    [objectiveId]: {
      primary: { videoId, title, sourceKey },
      variants: [{ videoId, title, sourceKey, label? }]
    }
  },
  areas: {
    [area]: {
      tape: { videoId, title, sourceKey },
      miscTech: [{ videoId, title, sourceKey }]
    }
  },
  miscTech: {
    unrecognized: [{ videoId, title, sourceKey }]
  },
  diagnostics: {
    unmatchedObjectiveIds: string[],
    areasMissingTape: string[],
    unrecognizedMiscTechVideoIds: string[]
  }
}

The runtime owns only interpretation of this generated data. Playlist fetching,
title inference, and source precedence belong to scripts/generate-learning-video-manifest.mjs.
*/

export function getLearningVideoLibrary() {
  return learningVideoLibrary;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeVideoEntry(entry) {
  if (!isObject(entry) || typeof entry.videoId !== "string" || !entry.videoId.trim()) {
    return null;
  }

  const label =
    typeof entry.label === "string" && entry.label.trim()
      ? entry.label.trim()
      : typeof entry.title === "string" && entry.title.trim()
        ? entry.title.trim()
        : entry.videoId.trim();

  return {
    videoId: entry.videoId.trim(),
    label,
    ...(typeof entry.sourceKey === "string" && entry.sourceKey.trim()
      ? { sourceKey: entry.sourceKey.trim() }
      : {})
  };
}

function buildManifest(primary, variants = []) {
  const primaryVideo = normalizeVideoEntry(primary);
  if (!primaryVideo) {
    return null;
  }

  return {
    primaryVideoId: primaryVideo.videoId,
    primaryLabel: primaryVideo.label,
    variants: (Array.isArray(variants) ? variants : [])
      .map(normalizeVideoEntry)
      .filter(Boolean)
  };
}

function normalizeVideoEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map(normalizeVideoEntry).filter(Boolean);
}

function buildManifestFromVideoList(entries) {
  const videos = normalizeVideoEntries(entries);
  const [primaryVideo, ...variantVideos] = videos;

  if (!primaryVideo) {
    return null;
  }

  return {
    primaryVideoId: primaryVideo.videoId,
    primaryLabel: primaryVideo.label,
    variants: variantVideos
  };
}

export function resolveLearningVideoManifest(objective, library = learningVideoLibrary) {
  if (!objective?.id || !isObject(library?.objectives)) {
    return null;
  }

  const entry = library.objectives[objective.id];
  if (!isObject(entry)) {
    return null;
  }

  return buildManifest(entry.primary, entry.variants);
}

export function resolveTapeVideoManifest(area, library = learningVideoLibrary) {
  if (!area || !isObject(library?.areas)) {
    return null;
  }

  const areaEntry = library.areas[area];
  if (!isObject(areaEntry)) {
    return null;
  }

  return buildManifest(areaEntry.tape);
}

export function resolveAreaMiscTechManifest(area, library = learningVideoLibrary) {
  if (!area || !isObject(library?.areas)) {
    return null;
  }

  const areaEntry = library.areas[area];
  if (!isObject(areaEntry)) {
    return null;
  }

  return buildManifestFromVideoList(areaEntry.miscTech);
}

export function resolveUnrecognizedMiscTechManifest(library = learningVideoLibrary) {
  if (!isObject(library?.miscTech)) {
    return null;
  }

  return buildManifestFromVideoList(library.miscTech.unrecognized);
}

export function buildLearningVideoSources({
  objective,
  phaseInfo,
  includeTape = true,
  library = learningVideoLibrary
}) {
  if (!objective) {
    return [];
  }

  const squareVideo = resolveLearningVideoManifest(objective, library);
  const tapeVideo = includeTape ? resolveTapeVideoManifest(objective.area, library) : null;

  if (phaseInfo?.phase === "tape" && tapeVideo) {
    return [{ key: "tape", label: "Tape Guide", manifest: tapeVideo }];
  }

  const sources = [];

  if (squareVideo) {
    sources.push({
      key: "square",
      label: "Square Guide",
      manifest: squareVideo
    });
  }

  if (phaseInfo?.needsTape && tapeVideo && !squareVideo) {
    sources.push({
      key: "tape",
      label: "Tape Guide",
      manifest: tapeVideo
    });
  }

  return sources;
}

export function buildBingopediaLearningVideoSources(row, library = learningVideoLibrary) {
  if (!row?.objective) {
    return [];
  }

  const squareVideo = resolveLearningVideoManifest(row.objective, library);

  return [
    squareVideo
      ? {
          key: "square",
          label: "Square Guide",
          manifest: squareVideo
        }
      : null,
  ].filter(Boolean);
}

export function buildBingopediaTapeRow(area, library = learningVideoLibrary) {
  const tapeVideo = resolveTapeVideoManifest(area, library);
  if (!tapeVideo) {
    return null;
  }

  return {
    id: `tape:${area}`,
    area,
    title: tapeVideo.primaryLabel,
    sources: [
      {
        key: "tape",
        label: "Tape Guide",
        manifest: tapeVideo
      }
    ]
  };
}

function buildMiscTechRow(video, {
  area,
  groupKey,
  groupLabel
}) {
  const normalizedVideo = normalizeVideoEntry(video);
  if (!normalizedVideo) {
    return null;
  }

  return {
    id: `misc-tech:${groupKey}:${normalizedVideo.videoId}`,
    area,
    title: normalizedVideo.label,
    groupKey,
    groupLabel,
    sources: [
      {
        key: "misc-tech",
        label: "Misc. Tech",
        manifest: {
          primaryVideoId: normalizedVideo.videoId,
          primaryLabel: normalizedVideo.label,
          variants: []
        }
      }
    ]
  };
}

export function buildBingopediaMiscTechRows(area, library = learningVideoLibrary) {
  const rows = [];
  const areaEntry = area && isObject(library?.areas) ? library.areas[area] : null;

  if (isObject(areaEntry)) {
    rows.push(
      ...normalizeVideoEntries(areaEntry.miscTech)
        .map((video) =>
          buildMiscTechRow(video, {
            area,
            groupKey: `area:${area}`,
            groupLabel: "Misc. Tech"
          })
        )
        .filter(Boolean)
    );
  }

  rows.push(
    ...normalizeVideoEntries(library?.miscTech?.unrecognized)
      .map((video) =>
        buildMiscTechRow(video, {
          area: null,
          groupKey: "unrecognized",
          groupLabel: "Unrecognized"
        })
      )
      .filter(Boolean)
  );

  return rows;
}

export function getLearningVideoEmptyLabel(defaultLabel = "No mapped video for this square.") {
  return defaultLabel;
}
