import { areaOrder } from "../data/areaMeta.js";
import { createHotkeyBinding, normalizeHotkeyBinding } from "./hotkeys.js";
import { normalizeObjectiveType } from "./objectiveTypes.js";
import { createEmptyAggregateStats } from "./stats/stats.js";
import {
  DEFAULT_DRILL_SETTINGS,
  normalizeDrillSettings
} from "./drill/drillSettings.js";
import {
  SEED_BUILDER_MODE,
  createDefaultSeedBuilderDraft,
  normalizeSeedBuilderDraft
} from "./seedBuilder.js";
import { encodeSessionSeed } from "./seed/sessionSeed.js";
import { normalizeSessionConfig } from "./session/sessionConfig.js";
import {
  PRACTICE_SESSION_TYPE,
  ROUTE_SESSION_TYPE,
  normalizeSessionType
} from "./session/sessionTypes.js";
import { normalizeRouteRevealMode } from "./session/routeRevealMode.js";
import {
  DEFAULT_THEME_ID,
  createDefaultCustomTheme,
  normalizeCustomTheme,
  normalizeThemeId
} from "./theme/index.js";

export const APP_STORAGE_KEY = "jsrf-bingo-trainer";
const LEGACY_DEFAULT_HOTKEYS = {
  split: createHotkeyBinding("Enter"),
  skip: createHotkeyBinding("KeyS"),
  pause: createHotkeyBinding("KeyP"),
  end: createHotkeyBinding("KeyE")
};
export const DEFAULT_HOTKEYS = {
  split: createHotkeyBinding("Enter", { ctrl: true, shift: true }),
  skip: createHotkeyBinding("KeyS", { ctrl: true, shift: true }),
  pause: createHotkeyBinding("KeyP", { ctrl: true, shift: true }),
  runBack: null,
  skipSplit: null,
  toggleGuide: null,
  startCountdown: null,
  end: createHotkeyBinding("KeyE", { ctrl: true, shift: true })
};
export const DEFAULT_SETTINGS = {
  startingArea: "Garage",
  drillSettings: DEFAULT_DRILL_SETTINGS,
  hotkeys: DEFAULT_HOTKEYS,
  learnPanelDefaultVisible: false,
  learnVideoAutoplay: false,
  learnAudioMuted: true,
  routeDistrictColorsEnabled: true,
  autoOpenPopout: false,
  popoutAlwaysOnTop: false,
  themeId: DEFAULT_THEME_ID,
  customTheme: createDefaultCustomTheme()
};
const OBJECTIVE_ID_MIGRATIONS = {
  sdpp_unlock_jazz: "99th_unlock_jazz"
};

function normalizeObjectiveId(objectiveId) {
  return OBJECTIVE_ID_MIGRATIONS[objectiveId] ?? objectiveId;
}

function hotkeyBindingsMatch(left, right) {
  if (!left || !right) {
    return false;
  }

  return (
    left.code === right.code &&
    left.modifiers.ctrl === right.modifiers.ctrl &&
    left.modifiers.alt === right.modifiers.alt &&
    left.modifiers.shift === right.modifiers.shift &&
    left.modifiers.meta === right.modifiers.meta
  );
}

function normalizeHotkeyWithMigration(value, action) {
  const normalizedValue = normalizeHotkeyBinding(value);
  if (!normalizedValue) {
    return DEFAULT_HOTKEYS[action];
  }

  return LEGACY_DEFAULT_HOTKEYS[action] &&
    hotkeyBindingsMatch(normalizedValue, LEGACY_DEFAULT_HOTKEYS[action])
    ? DEFAULT_HOTKEYS[action]
    : normalizedValue;
}

function normalizeHotkeys(value) {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_HOTKEYS
    };
  }

  return {
    split: normalizeHotkeyWithMigration(value.split, "split"),
    skip: normalizeHotkeyWithMigration(value.skip, "skip"),
    pause: normalizeHotkeyWithMigration(value.pause, "pause"),
    runBack: normalizeHotkeyWithMigration(value.runBack, "runBack"),
    skipSplit: normalizeHotkeyWithMigration(value.skipSplit, "skipSplit"),
    toggleGuide: normalizeHotkeyWithMigration(value.toggleGuide, "toggleGuide"),
    startCountdown: normalizeHotkeyWithMigration(value.startCountdown, "startCountdown"),
    end: normalizeHotkeyWithMigration(value.end, "end")
  };
}

function normalizeSettings(value, legacySelectedMode = null) {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_SETTINGS,
      drillSettings: normalizeDrillSettings(DEFAULT_DRILL_SETTINGS),
      hotkeys: {
        ...DEFAULT_HOTKEYS
      },
      customTheme: createDefaultCustomTheme()
    };
  }

  return {
    startingArea:
      typeof value.startingArea === "string" && areaOrder.includes(value.startingArea)
        ? value.startingArea
        : DEFAULT_SETTINGS.startingArea,
    drillSettings: normalizeDrillSettings(value.drillSettings),
    hotkeys: normalizeHotkeys(value.hotkeys),
    learnPanelDefaultVisible:
      typeof value.learnPanelDefaultVisible === "boolean"
        ? value.learnPanelDefaultVisible
        : legacySelectedMode === "learn"
          ? true
          : DEFAULT_SETTINGS.learnPanelDefaultVisible,
    learnVideoAutoplay:
      typeof value.learnVideoAutoplay === "boolean"
        ? value.learnVideoAutoplay
        : DEFAULT_SETTINGS.learnVideoAutoplay,
    learnAudioMuted:
      typeof value.learnAudioMuted === "boolean"
        ? value.learnAudioMuted
        : DEFAULT_SETTINGS.learnAudioMuted,
    routeDistrictColorsEnabled:
      typeof value.routeDistrictColorsEnabled === "boolean"
        ? value.routeDistrictColorsEnabled
        : DEFAULT_SETTINGS.routeDistrictColorsEnabled,
    autoOpenPopout:
      typeof value.autoOpenPopout === "boolean"
        ? value.autoOpenPopout
        : DEFAULT_SETTINGS.autoOpenPopout,
    popoutAlwaysOnTop:
      typeof value.popoutAlwaysOnTop === "boolean"
        ? value.popoutAlwaysOnTop
        : DEFAULT_SETTINGS.popoutAlwaysOnTop,
    themeId: normalizeThemeId(value.themeId),
    customTheme: normalizeCustomTheme(value.customTheme)
  };
}

function normalizeCurrentSession(currentSession, settings) {
  if (!currentSession || typeof currentSession !== "object") {
    return null;
  }

  const sessionType = normalizeSessionType(
    currentSession.sessionType ?? currentSession.sessionSpec?.sessionType
  );
  const objectiveIds = Array.isArray(currentSession.objectiveIds)
    ? currentSession.objectiveIds
        .filter((objectiveId) => typeof objectiveId === "string")
        .map(normalizeObjectiveId)
    : [];
  if (objectiveIds.length === 0) {
    return null;
  }

  const sessionSpec =
    currentSession.sessionSpec &&
    typeof currentSession.sessionSpec === "object" &&
    typeof currentSession.sessionSpec.rngSeed === "string"
      ? {
          version: currentSession.sessionSpec.version ?? 1,
          sessionType: normalizeSessionType(currentSession.sessionSpec.sessionType),
          rngSeed: currentSession.sessionSpec.rngSeed,
          config: normalizeSessionConfig(currentSession.sessionSpec.config),
          objectiveIds: objectiveIds.slice()
        }
      : null;
  if (!sessionSpec) {
    return null;
  }

  if (sessionType === ROUTE_SESSION_TYPE) {
    const visibleCount = sessionSpec.config.routeVisibleCount;
    const visibleObjectiveIds = Array.isArray(currentSession.visibleObjectiveIds)
      ? Array.from({ length: visibleCount }, (_, index) => {
          const objectiveId = currentSession.visibleObjectiveIds[index];
          return typeof objectiveId === "string" ? normalizeObjectiveId(objectiveId) : null;
        })
      : Array.from({ length: visibleCount }, (_, index) => objectiveIds[index] ?? null);
    const nonNullVisibleCount = visibleObjectiveIds.filter(Boolean).length;
    const nextRevealFloor = Math.min(visibleCount, objectiveIds.length);
    const nextRevealIndex = Number.isInteger(currentSession.nextRevealIndex)
      ? Math.max(nextRevealFloor, Math.min(objectiveIds.length, currentSession.nextRevealIndex))
      : nextRevealFloor;
    const derivedCompletedCount = Math.max(0, nextRevealIndex - nonNullVisibleCount);

    return {
      ...currentSession,
      sessionType,
      objectiveIds,
      sessionSpec,
      exportSeed:
        typeof currentSession.exportSeed === "string" && currentSession.exportSeed
          ? currentSession.exportSeed
          : encodeSessionSeed(sessionSpec),
      visibleObjectiveIds,
      nextRevealIndex,
      completedCount: Number.isInteger(currentSession.completedCount)
        ? Math.max(0, Math.min(objectiveIds.length, currentSession.completedCount))
        : derivedCompletedCount,
      routeClearEvents: normalizeRouteClearEvents(currentSession.routeClearEvents),
      sessionStartedAt: currentSession.sessionStartedAt ?? Date.now(),
      sessionTotalPausedMs: currentSession.sessionTotalPausedMs ?? 0,
      pausedAt: currentSession.pausedAt ?? null,
      totalPausedMs: currentSession.totalPausedMs ?? 0
    };
  }

  const currentObjectiveIndex = Number.isInteger(currentSession.currentObjectiveIndex)
    ? currentSession.currentObjectiveIndex
    : 0;

  if (
    !currentSession.currentArea ||
    currentObjectiveIndex < 0 ||
    currentObjectiveIndex >= objectiveIds.length
  ) {
    return null;
  }

  const objectiveStartedAt =
    currentSession.objectiveStartedAt ??
    currentSession.timerStartedAt ??
    currentSession.currentObjectiveGeneratedAt ??
    Date.now();
  const phase = currentSession.phase ?? "challenge";
  const phaseStartedAt = currentSession.phaseStartedAt ?? objectiveStartedAt;
  const sessionUi = currentSession.ui && typeof currentSession.ui === "object" ? currentSession.ui : {};
  const learnPanelVisible =
    typeof sessionUi.learnPanelVisible === "boolean"
      ? sessionUi.learnPanelVisible
      : typeof currentSession.learnPanelVisible === "boolean"
        ? currentSession.learnPanelVisible
        : settings.learnPanelDefaultVisible;

  return {
    ...currentSession,
    sessionType,
    currentObjectiveId: objectiveIds[currentObjectiveIndex],
    currentObjectiveIndex,
    objectiveIds,
    sessionSpec,
    exportSeed:
      typeof currentSession.exportSeed === "string" && currentSession.exportSeed
        ? currentSession.exportSeed
        : encodeSessionSeed(sessionSpec),
    drillSettings: normalizeDrillSettings(currentSession.drillSettings ?? sessionSpec.config),
    objectiveStartedAt,
    phaseStartedAt,
    phase,
    challengeStartedAt:
      currentSession.challengeStartedAt ??
      (phase === "challenge" ? phaseStartedAt : null),
    enteredLevelAt: currentSession.enteredLevelAt ?? null,
    tapeStartedAt: currentSession.tapeStartedAt ?? null,
    tapeUnlockedAt: currentSession.tapeUnlockedAt ?? null,
    unlockedTapeAreas: Array.isArray(currentSession.unlockedTapeAreas)
      ? currentSession.unlockedTapeAreas
      : [],
    sessionStartedAt: currentSession.sessionStartedAt ?? objectiveStartedAt,
    sessionTotalPausedMs: currentSession.sessionTotalPausedMs ?? 0,
    pausedAt: currentSession.pausedAt ?? null,
    totalPausedMs: currentSession.totalPausedMs ?? 0,
    travelPausedMs: currentSession.travelPausedMs ?? 0,
    tapePausedMs: currentSession.tapePausedMs ?? 0,
    challengePausedMs: currentSession.challengePausedMs ?? 0,
    ui: {
      ...sessionUi,
      learnPanelVisible
    }
  };
}

function normalizeRouteClearEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((event) => ({
      objectiveId:
        typeof event?.objectiveId === "string"
          ? normalizeObjectiveId(event.objectiveId)
          : null,
      slotIndex: Number.isInteger(event?.slotIndex) ? Math.max(0, event.slotIndex) : null,
      endedAt: Number.isFinite(event?.endedAt) ? Math.max(0, event.endedAt) : null,
      elapsedMs: Number.isFinite(event?.elapsedMs) ? Math.max(0, event.elapsedMs) : null
    }))
    .filter((event) => event.objectiveId && event.endedAt !== null && event.elapsedMs !== null);
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return entry;
  }

  const sessionType = normalizeSessionType(entry.sessionType);

  return {
    ...entry,
    sessionType,
    type: sessionType === ROUTE_SESSION_TYPE ? entry.type ?? null : normalizeObjectiveType(entry.type),
    visibleCount: Number.isInteger(entry.visibleCount) ? Math.max(0, entry.visibleCount) : null,
    routeRevealMode:
      sessionType === ROUTE_SESSION_TYPE
        ? normalizeRouteRevealMode(entry.routeRevealMode)
        : null,
    objectiveCount:
      Number.isInteger(entry.objectiveCount) ? Math.max(0, entry.objectiveCount) : null,
    squaresCleared:
      Number.isInteger(entry.squaresCleared) ? Math.max(0, entry.squaresCleared) : null,
    objectiveId:
      typeof entry.objectiveId === "string"
        ? normalizeObjectiveId(entry.objectiveId)
        : entry.objectiveId
  };
}

function normalizeBestTimesByObjective(bestTimesByObjective) {
  if (!bestTimesByObjective || typeof bestTimesByObjective !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bestTimesByObjective).map(([objectiveId, record]) => [
      normalizeObjectiveId(objectiveId),
      record && typeof record === "object"
        ? {
            ...record,
            type: normalizeObjectiveType(record.type)
          }
        : record
    ])
  );
}

function normalizeSeedNamesByExportSeed(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([exportSeed, name]) => [
        typeof exportSeed === "string" ? exportSeed : "",
        typeof name === "string" ? name.trim().slice(0, 60) : ""
      ])
      .filter(([exportSeed, name]) => exportSeed && name)
  );
}

function normalizePendingCompletion(pendingCompletion) {
  if (!pendingCompletion || typeof pendingCompletion !== "object") {
    return null;
  }

  const sessionSpecInput = pendingCompletion.sessionSpec;
  if (
    !sessionSpecInput ||
    typeof sessionSpecInput !== "object" ||
    typeof sessionSpecInput.rngSeed !== "string"
  ) {
    return null;
  }

  const objectiveIds = Array.isArray(sessionSpecInput.objectiveIds)
    ? sessionSpecInput.objectiveIds
        .filter((objectiveId) => typeof objectiveId === "string")
        .map(normalizeObjectiveId)
    : [];

  if (objectiveIds.length === 0) {
    return null;
  }

  const sessionSpec = {
    version: sessionSpecInput.version ?? 1,
    sessionType: normalizeSessionType(sessionSpecInput.sessionType),
    rngSeed: sessionSpecInput.rngSeed,
    config: normalizeSessionConfig(sessionSpecInput.config),
    objectiveIds: objectiveIds.slice()
  };
  const objectiveCount = Number.isInteger(pendingCompletion.objectiveCount)
    ? Math.max(0, pendingCompletion.objectiveCount)
    : objectiveIds.length;
  const squaresCleared = Number.isInteger(pendingCompletion.squaresCleared)
    ? Math.min(objectiveCount, Math.max(0, pendingCompletion.squaresCleared))
    : 0;
  const finishedAt = Number.isFinite(pendingCompletion.finishedAt)
    ? Math.max(0, pendingCompletion.finishedAt)
    : 0;
  const totalDurationMs = Number.isFinite(pendingCompletion.totalDurationMs)
    ? Math.max(0, pendingCompletion.totalDurationMs)
    : 0;
  const sessionType = normalizeSessionType(
    pendingCompletion.sessionType ?? sessionSpecInput.sessionType
  );

  return {
    sessionId:
      typeof pendingCompletion.sessionId === "string" ? pendingCompletion.sessionId : "",
    sessionType,
    finishedAt,
    objectiveCount,
    squaresCleared,
    totalDurationMs,
    visibleCount:
      Number.isInteger(pendingCompletion.visibleCount) && pendingCompletion.visibleCount >= 0
        ? pendingCompletion.visibleCount
        : sessionSpec.config.routeVisibleCount,
    routeRevealMode:
      sessionType === ROUTE_SESSION_TYPE
        ? normalizeRouteRevealMode(
            pendingCompletion.routeRevealMode ?? sessionSpec.config.routeRevealMode
          )
        : null,
    routeClearEvents:
      sessionType === ROUTE_SESSION_TYPE
        ? normalizeRouteClearEvents(pendingCompletion.routeClearEvents)
        : [],
    exportSeed:
      typeof pendingCompletion.exportSeed === "string" && pendingCompletion.exportSeed
        ? pendingCompletion.exportSeed
        : encodeSessionSeed(sessionSpec),
    sessionSpec
  };
}

function normalizeStartCountdown(startCountdown) {
  if (!startCountdown || typeof startCountdown !== "object") {
    return null;
  }

  const sessionSpecInput = startCountdown.sessionSpec;
  if (
    !sessionSpecInput ||
    typeof sessionSpecInput !== "object" ||
    typeof sessionSpecInput.rngSeed !== "string"
  ) {
    return null;
  }

  const objectiveIds = Array.isArray(sessionSpecInput.objectiveIds)
    ? sessionSpecInput.objectiveIds
        .filter((objectiveId) => typeof objectiveId === "string")
        .map(normalizeObjectiveId)
    : [];

  if (objectiveIds.length === 0) {
    return null;
  }

  return {
    id:
      typeof startCountdown.id === "string" && startCountdown.id
        ? startCountdown.id
        : `countdown_${Date.now()}`,
    sessionId:
      typeof startCountdown.sessionId === "string" && startCountdown.sessionId
        ? startCountdown.sessionId
        : `session_${Date.now()}`,
    startedAt:
      Number.isFinite(startCountdown.startedAt) && startCountdown.startedAt >= 0
        ? startCountdown.startedAt
        : startCountdown.startedAt === null
          ? null
          : Date.now(),
    exportSeed:
      typeof startCountdown.exportSeed === "string" ? startCountdown.exportSeed : "",
    sessionSpec: {
      version: sessionSpecInput.version ?? 1,
      sessionType: normalizeSessionType(sessionSpecInput.sessionType),
      rngSeed: sessionSpecInput.rngSeed,
      config: normalizeSessionConfig(sessionSpecInput.config),
      objectiveIds: objectiveIds.slice()
    }
  };
}

export function createDefaultAppState() {
  return {
    selectedMode: null,
    settings: {
      ...DEFAULT_SETTINGS,
      drillSettings: normalizeDrillSettings(DEFAULT_DRILL_SETTINGS),
      hotkeys: {
        ...DEFAULT_HOTKEYS
      },
      customTheme: createDefaultCustomTheme()
    },
    currentSession: null,
    startCountdown: null,
    pendingCompletion: null,
    seedBuilderDraft: createDefaultSeedBuilderDraft(),
    history: [],
    seedNamesByExportSeed: {},
    bestTimesByObjective: {},
    aggregateStats: createEmptyAggregateStats()
  };
}

export function normalizeAppState(value) {
  const defaults = createDefaultAppState();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const rawSelectedMode =
    typeof value.selectedMode === "string"
      ? value.selectedMode
      : typeof value.selectedView === "string"
        ? value.selectedView
        : null;
  const selectedMode =
    rawSelectedMode === "settings"
      ? "settings"
      : rawSelectedMode === "stats"
        ? "stats"
      : rawSelectedMode === "bingopedia"
        ? "bingopedia"
      : rawSelectedMode === SEED_BUILDER_MODE
        ? SEED_BUILDER_MODE
      : rawSelectedMode === ROUTE_SESSION_TYPE
        ? ROUTE_SESSION_TYPE
      : rawSelectedMode === PRACTICE_SESSION_TYPE ||
          rawSelectedMode === "drills" ||
          rawSelectedMode === "learn"
        ? PRACTICE_SESSION_TYPE
        : null;
  const settings = normalizeSettings(value.settings, rawSelectedMode);

  return {
    ...defaults,
    ...value,
    selectedMode,
    settings,
    currentSession: normalizeCurrentSession(value.currentSession, settings),
    startCountdown: normalizeStartCountdown(value.startCountdown),
    pendingCompletion: normalizePendingCompletion(value.pendingCompletion),
    seedBuilderDraft: normalizeSeedBuilderDraft(value.seedBuilderDraft),
    history: Array.isArray(value.history) ? value.history.map(normalizeHistoryEntry) : [],
    seedNamesByExportSeed: normalizeSeedNamesByExportSeed(value.seedNamesByExportSeed),
    bestTimesByObjective: normalizeBestTimesByObjective(value.bestTimesByObjective),
    aggregateStats: {
      squareByArea:
        value.aggregateStats?.squareByArea &&
        typeof value.aggregateStats.squareByArea === "object"
          ? value.aggregateStats.squareByArea
          : value.aggregateStats?.byArea && typeof value.aggregateStats.byArea === "object"
            ? value.aggregateStats.byArea
          : {},
      tapeByArea:
        value.aggregateStats?.tapeByArea &&
        typeof value.aggregateStats.tapeByArea === "object"
          ? value.aggregateStats.tapeByArea
          : {},
      graffitiByArea:
        value.aggregateStats?.graffitiByArea &&
        typeof value.aggregateStats.graffitiByArea === "object"
          ? value.aggregateStats.graffitiByArea
          : {}
    }
  };
}
