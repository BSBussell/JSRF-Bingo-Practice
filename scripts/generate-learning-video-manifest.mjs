#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { allObjectives } from "../src/data/objectives.js";
import { areaLabels, objectiveAreaOrder } from "../src/data/areaMeta.js";
import titleAliases from "./data/learning-video-title-aliases.json" with { type: "json" };

export const DEFAULT_PRIMARY_PLAYLIST_URL =
  "https://youtube.com/playlist?list=PLDHncjR554MyBVGa7Z9WUU-fIC5d_BFrT";
export const DEFAULT_FALLBACK_PLAYLIST_URL =
  "https://youtube.com/playlist?list=PLrqAmeXg8tekWV7QHQb5T3c8TbYxwb-ot";
export const DEFAULT_OUTPUT_PATH = "src/data/generated/learningVideoLibrary.json";

const SOURCE_DEFINITIONS = [
  {
    key: "primary",
    label: "Naestrinus' Bingopedia",
    url: DEFAULT_PRIMARY_PLAYLIST_URL
  },
  {
    key: "fallback",
    label: "Crabbi's Route",
    url: DEFAULT_FALLBACK_PLAYLIST_URL
  }
];

const areaSearchTerms = {
  Dogen: ["dogen", "dogenzaka"],
  Shibuya: ["shibuya"],
  Chuo: ["chuo"],
  Hikage: ["hikage"],
  RDH: ["rdh", "rokkaku dai heights"],
  Sewers: ["sewers", "sewer", "sewage facility", "underground sewage facility"],
  BP: ["bottom point", "btm pt", "btm pt.", "bp"],
  Kibo: ["kibo", "kibogaoka"],
  FRZ: ["frz", "fortified residential zone"],
  _99th: ["99th", "99th street", "stadium"],
  SDPP: ["sdpp", "skyscraper district", "pharaoh park"],
  HWY0: ["hwy0", "hw0", "highway zero"],
  Dino: ["sky dino", "dino"]
};

const typeSearchTerms = {
  grind_count: ["grind"],
  air_count: ["air"],
  trick_count: ["tricks", "trick"],
  points_goal: ["points"],
  special: ["special"],
  unlock: ["unlock"],
  graffiti: ["graffiti"]
};

const weakObjectiveTokens = new Set([
  "a",
  "an",
  "and",
  "area",
  "at",
  "in",
  "of",
  "or",
  "the",
  "to"
]);

function readArgument(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return fallback;
  }

  return process.argv[index + 1];
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(/\s+/) : [];
}

function buildSearchIndex(value) {
  const normalized = normalizeSearchText(value);
  const tokens = new Set(normalized ? normalized.split(/\s+/) : []);

  return {
    normalized,
    compact: normalized.replace(/\s+/g, ""),
    tokens
  };
}

function matchesTerm(searchIndex, term) {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) {
    return false;
  }

  if (normalizedTerm.includes(" ")) {
    return searchIndex.normalized.includes(normalizedTerm);
  }

  return (
    searchIndex.tokens.has(normalizedTerm) ||
    (/\d/.test(normalizedTerm) && searchIndex.compact.includes(normalizedTerm))
  );
}

function targetAliases(target) {
  if (typeof target !== "number" || !Number.isFinite(target)) {
    return [];
  }

  const aliases = [String(target)];
  if (target >= 1000 && target % 1000 === 0) {
    aliases.push(`${target / 1000}k`);
  }

  return aliases;
}

function bestAreaMatchScore(area, searchIndex) {
  const terms = areaSearchTerms[area] ?? [areaLabels[area], area];
  let score = 0;

  for (const term of terms) {
    const normalizedTerm = normalizeSearchText(term);
    if (!normalizedTerm || !matchesTerm(searchIndex, normalizedTerm)) {
      continue;
    }

    score = Math.max(score, 20 + normalizedTerm.length);
  }

  return score;
}

function matchesTarget(searchIndex, target) {
  return targetAliases(target).some((alias) => matchesTerm(searchIndex, alias));
}

function objectiveContentTokens(objective) {
  return tokenize(objective.description)
    .filter((token) => !weakObjectiveTokens.has(token))
    .filter((token) => !(typeSearchTerms[objective.type] ?? []).includes(token))
    .filter((token) => !targetAliases(objective.target).includes(token));
}

function objectiveDescriptionScore(objective, searchIndex) {
  const description = normalizeSearchText(objective.description);
  const tokens = objectiveContentTokens(objective);
  const matchedTokens = tokens.filter((token) => searchIndex.tokens.has(token));
  const phraseMatched = description && searchIndex.normalized.includes(description);

  return {
    tokens,
    matchedTokenCount: matchedTokens.length,
    score: matchedTokens.length * 12 + (phraseMatched ? 30 : 0)
  };
}

function matchesObjectiveCode(objective, searchIndex) {
  if (!objective.code || objective.type === "graffiti") {
    return false;
  }

  return matchesTerm(searchIndex, objective.code);
}

function scoreCountObjectiveVideo(objective, searchIndex) {
  const typeMatched = (typeSearchTerms[objective.type] ?? []).some((term) =>
    matchesTerm(searchIndex, term)
  );
  const targetMatched = matchesTarget(searchIndex, objective.target);

  return typeMatched && targetMatched ? 85 : null;
}

function scoreDefaultObjectiveVideo(objective, searchIndex) {
  const codeMatched = matchesObjectiveCode(objective, searchIndex);
  const descriptionScore = objectiveDescriptionScore(objective, searchIndex);
  const requiredMatches = descriptionScore.tokens.length <= 1 ? 1 : 2;

  if (!codeMatched && descriptionScore.matchedTokenCount < requiredMatches) {
    return null;
  }

  return descriptionScore.score + (codeMatched ? 35 : 0);
}

function scoreTitleAlias(objective, searchIndex, titleAliasesByObjectiveId) {
  const aliases = titleAliasesByObjectiveId?.[objective.id];
  if (!Array.isArray(aliases)) {
    return null;
  }

  let bestScore = null;
  for (const alias of aliases) {
    const normalizedAlias = normalizeSearchText(alias);
    if (!normalizedAlias || !searchIndex.normalized.includes(normalizedAlias)) {
      continue;
    }

    bestScore = Math.max(bestScore ?? 0, 160 + normalizedAlias.length);
  }

  return bestScore;
}

function hasTitleAliases(objective, titleAliasesByObjectiveId) {
  return Array.isArray(titleAliasesByObjectiveId?.[objective.id]);
}

function scoreUnlockObjectiveVideo(objective, searchIndex) {
  const unlockName = normalizeSearchText(objective.description).replace(/^unlock\s+/, "");
  const unlockTokens = tokenize(unlockName);
  const matchedNameTokens = unlockTokens.filter((token) => searchIndex.tokens.has(token));

  if (unlockTokens.length > 0 && matchedNameTokens.length === 0) {
    return null;
  }

  return 70 + matchedNameTokens.length * 15 + (matchesTerm(searchIndex, "unlock") ? 10 : 0);
}

export function scoreObjectiveVideo(
  objective,
  video,
  titleAliasesByObjectiveId = titleAliases.objectives
) {
  const searchIndex = buildSearchIndex(video.title);
  const areaScore = bestAreaMatchScore(objective.area, searchIndex);
  if (areaScore <= 0) {
    return null;
  }

  const aliasScore = scoreTitleAlias(objective, searchIndex, titleAliasesByObjectiveId);
  if (aliasScore !== null) {
    return areaScore + aliasScore;
  }
  if (objective.type === "unlock" && hasTitleAliases(objective, titleAliasesByObjectiveId)) {
    return null;
  }

  let objectiveScore = null;
  if (
    objective.type === "grind_count" ||
    objective.type === "air_count" ||
    objective.type === "trick_count" ||
    objective.type === "points_goal"
  ) {
    objectiveScore = scoreCountObjectiveVideo(objective, searchIndex);
  } else if (objective.type === "special") {
    objectiveScore = matchesTerm(searchIndex, "special") ? 80 : null;
  } else if (objective.type === "unlock") {
    objectiveScore = scoreUnlockObjectiveVideo(objective, searchIndex);
  } else if (objective.type === "graffiti") {
    objectiveScore = matchesTerm(searchIndex, "graffiti") ? 80 : null;
  } else {
    objectiveScore = scoreDefaultObjectiveVideo(objective, searchIndex);
  }

  return objectiveScore === null ? null : areaScore + objectiveScore;
}

export function scoreTapeVideo(area, video) {
  const searchIndex = buildSearchIndex(video.title);
  const areaScore = bestAreaMatchScore(area, searchIndex);
  if (areaScore <= 0 || !matchesTerm(searchIndex, "tape")) {
    return null;
  }

  return areaScore + 80;
}

function extractPlaylistId(value) {
  try {
    const url = new URL(value);
    return url.searchParams.get("list") ?? value;
  } catch {
    return value;
  }
}

function normalizeYtDlpEntry(entry, sourceKey) {
  const videoId = entry?.id ?? entry?.video_id ?? entry?.url;
  const title = entry?.title;
  if (typeof videoId !== "string" || !videoId.trim() || typeof title !== "string" || !title.trim()) {
    return null;
  }

  return {
    videoId: videoId.trim(),
    title: title.trim(),
    sourceKey,
    position: Number.isFinite(entry.playlist_index)
      ? entry.playlist_index
      : Number.isFinite(entry.index)
        ? entry.index
        : 0
  };
}

function findBestVideo(videos, scoreVideo) {
  return findScoredVideos(videos, scoreVideo)[0]?.video ?? null;
}

function findScoredVideos(videos, scoreVideo) {
  const matches = [];

  for (const video of videos) {
    const score = scoreVideo(video);
    if (score === null) {
      continue;
    }

    matches.push({
      score,
      video
    });
  }

  return matches.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.video.position - right.video.position;
  });
}

function uniqueVideos(videos) {
  const seenVideoIds = new Set();
  const unique = [];

  for (const video of videos) {
    if (seenVideoIds.has(video.videoId)) {
      continue;
    }

    seenVideoIds.add(video.videoId);
    unique.push(video);
  }

  return unique;
}

function rememberConsumedVideos(consumedVideoIds, videos) {
  for (const video of videos) {
    consumedVideoIds.add(video.videoId);
  }
}

function ensureAreaEntry(areasManifest, area) {
  if (!areasManifest[area]) {
    areasManifest[area] = {};
  }

  return areasManifest[area];
}

function findBestVideoArea(video, areas) {
  const searchIndex = buildSearchIndex(video.title);
  let bestArea = null;
  let bestScore = 0;

  for (const area of areas) {
    const score = bestAreaMatchScore(area, searchIndex);
    if (score > bestScore) {
      bestArea = area;
      bestScore = score;
    }
  }

  return bestArea;
}

function collectUnconsumedVideos(playlistResults, consumedVideoIds) {
  const seenVideoIds = new Set();
  const videos = [];

  for (const source of playlistResults) {
    for (const video of source.videos) {
      if (seenVideoIds.has(video.videoId) || consumedVideoIds.has(video.videoId)) {
        continue;
      }

      seenVideoIds.add(video.videoId);
      videos.push(video);
    }
  }

  return videos;
}

function findObjectiveManifestVideos(objective, playlistResults, titleAliasesByObjectiveId) {
  let primaryVideo = null;
  const variantVideos = [];

  for (const source of playlistResults) {
    const matches = findScoredVideos(source.videos, (video) =>
      scoreObjectiveVideo(objective, video, titleAliasesByObjectiveId)
    );
    const matchedVideos = uniqueVideos(matches.map((match) => match.video));

    if (matchedVideos.length === 0) {
      continue;
    }

    if (!primaryVideo) {
      const [sourcePrimaryVideo, ...sourceVariantVideos] = matchedVideos;
      primaryVideo = sourcePrimaryVideo;
      variantVideos.push(...sourceVariantVideos);
      continue;
    }

    variantVideos.push(...matchedVideos);
  }

  if (!primaryVideo) {
    return null;
  }

  return {
    primaryVideo,
    variantVideos: uniqueVideos(
      variantVideos.filter((video) => video.videoId !== primaryVideo.videoId)
    )
  };
}

function manifestVideo(video) {
  return {
    videoId: video.videoId,
    title: video.title,
    sourceKey: video.sourceKey
  };
}

export function buildLearningVideoManifest({
  playlistResults,
  objectives = allObjectives,
  areas = objectiveAreaOrder,
  titleAliasesByObjectiveId = titleAliases.objectives,
  generatedAt = new Date().toISOString()
}) {
  const sources = playlistResults.map((result) => ({
    key: result.key,
    label: result.label,
    url: result.url,
    playlistId: result.playlistId ?? extractPlaylistId(result.url),
    entryCount: result.videos.length
  }));
  const objectivesManifest = {};
  const areasManifest = {};
  const consumedVideoIds = new Set();

  for (const objective of objectives) {
    const manifestVideos = findObjectiveManifestVideos(
      objective,
      playlistResults,
      titleAliasesByObjectiveId
    );

    if (manifestVideos) {
      objectivesManifest[objective.id] = {
        primary: manifestVideo(manifestVideos.primaryVideo),
        variants: manifestVideos.variantVideos.map(manifestVideo)
      };
      rememberConsumedVideos(consumedVideoIds, [
        manifestVideos.primaryVideo,
        ...manifestVideos.variantVideos
      ]);
    }
  }

  for (const area of areas) {
    for (const source of playlistResults) {
      const match = findBestVideo(source.videos, (video) => scoreTapeVideo(area, video));
      if (match) {
        ensureAreaEntry(areasManifest, area).tape = manifestVideo(match);
        rememberConsumedVideos(consumedVideoIds, [match]);
        break;
      }
    }
  }

  const unrecognizedMiscTech = [];
  for (const video of collectUnconsumedVideos(playlistResults, consumedVideoIds)) {
    const area = findBestVideoArea(video, areas);
    if (!area) {
      unrecognizedMiscTech.push(manifestVideo(video));
      continue;
    }

    const areaEntry = ensureAreaEntry(areasManifest, area);
    areaEntry.miscTech = [...(areaEntry.miscTech ?? []), manifestVideo(video)];
  }

  return {
    schemaVersion: 1,
    generatedAt,
    sources,
    objectives: objectivesManifest,
    areas: areasManifest,
    miscTech: {
      unrecognized: unrecognizedMiscTech
    },
    diagnostics: {
      unmatchedObjectiveIds: objectives
        .map((objective) => objective.id)
        .filter((objectiveId) => !objectivesManifest[objectiveId]),
      areasMissingTape: areas.filter((area) => !areasManifest[area]?.tape),
      unrecognizedMiscTechVideoIds: unrecognizedMiscTech.map((video) => video.videoId)
    }
  };
}

function runYtDlp(url) {
  const result = spawnSync(
    "yt-dlp",
    ["--skip-download", "--flat-playlist", "--dump-single-json", url],
    {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    }
  );

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "yt-dlp was not found on PATH. Install yt-dlp, then rerun npm run learn-videos:generate."
    );
  }

  if (result.status !== 0) {
    throw new Error(`yt-dlp failed for ${url}\n${result.stderr || result.stdout}`);
  }

  return JSON.parse(result.stdout);
}

function extractPlaylistVideos(metadata, sourceKey) {
  return (Array.isArray(metadata.entries) ? metadata.entries : [])
    .map((entry) => normalizeYtDlpEntry(entry, sourceKey))
    .filter(Boolean);
}

async function main() {
  const primaryUrl = readArgument("--primary", DEFAULT_PRIMARY_PLAYLIST_URL);
  const fallbackUrl = readArgument("--fallback", DEFAULT_FALLBACK_PLAYLIST_URL);
  const outputPath = readArgument("--out", DEFAULT_OUTPUT_PATH);
  const requestedSources = SOURCE_DEFINITIONS.map((source) => ({
    ...source,
    url:
      source.key === "primary"
        ? primaryUrl
        : source.key === "fallback"
          ? fallbackUrl
          : source.url
  }));

  const playlistResults = requestedSources.map((source) => {
    const metadata = runYtDlp(source.url);
    return {
      ...source,
      playlistId: metadata.id ?? extractPlaylistId(source.url),
      videos: extractPlaylistVideos(metadata, source.key)
    };
  });

  const manifest = buildLearningVideoManifest({ playlistResults });
  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Wrote ${outputPath}`);
  console.log(`sources\t${manifest.sources.map((source) => `${source.key}:${source.entryCount}`).join("\t")}`);
  console.log(`objectives\t${Object.keys(manifest.objectives).length}/${allObjectives.length}`);
  console.log(
    `tapeAreas\t${Object.values(manifest.areas).filter((areaEntry) => areaEntry.tape).length}/${objectiveAreaOrder.length}`
  );
  console.log(
    `miscTech\t${Object.values(manifest.areas).reduce(
      (total, areaEntry) => total + (areaEntry.miscTech?.length ?? 0),
      0
    )}`
  );
  console.log(`unmatchedObjectives\t${manifest.diagnostics.unmatchedObjectiveIds.length}`);
  console.log(`areasMissingTape\t${manifest.diagnostics.areasMissingTape.length}`);
  console.log(`unrecognizedMiscTech\t${manifest.miscTech.unrecognized.length}`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
