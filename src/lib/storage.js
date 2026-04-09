import { areaOrder } from "../data/areaMeta.js";
import { createHotkeyBinding, normalizeHotkeyBinding } from "./hotkeys.js";
import { normalizeObjectiveType } from "./objectiveTypes.js";
import { createEmptyAggregateStats } from "./stats/stats.js";
import {
  DEFAULT_DRILL_SETTINGS,
  normalizeDrillSettings
} from "./drill/drillSettings.js";
import { encodeSessionSeed, normalizeSessionConfig } from "./seed/sessionSeed.js";
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
  end: createHotkeyBinding("KeyE", { ctrl: true, shift: true })
};
export const DEFAULT_SETTINGS = {
  startingArea: "Garage",
  drillSettings: DEFAULT_DRILL_SETTINGS,
  hotkeys: DEFAULT_HOTKEYS,
  learnPanelDefaultVisible: false,
  learnVideoAutoplay: false,
  learnAudioMuted: true,
  autoOpenPopout: false,
  popoutAlwaysOnTop: false,
  themeId: DEFAULT_THEME_ID,
  customTheme: createDefaultCustomTheme()
};

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

  return hotkeyBindingsMatch(normalizedValue, LEGACY_DEFAULT_HOTKEYS[action])
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

  const objectiveIds = Array.isArray(currentSession.objectiveIds)
    ? currentSession.objectiveIds.filter((objectiveId) => typeof objectiveId === "string")
    : [];
  const currentObjectiveIndex = Number.isInteger(currentSession.currentObjectiveIndex)
    ? currentSession.currentObjectiveIndex
    : 0;

  if (
    !currentSession.currentArea ||
    objectiveIds.length === 0 ||
    currentObjectiveIndex < 0 ||
    currentObjectiveIndex >= objectiveIds.length
  ) {
    return null;
  }

  const sessionSpec =
    currentSession.sessionSpec &&
    typeof currentSession.sessionSpec === "object" &&
    typeof currentSession.sessionSpec.rngSeed === "string"
      ? {
          version: currentSession.sessionSpec.version ?? 1,
          rngSeed: currentSession.sessionSpec.rngSeed,
          config: normalizeSessionConfig(currentSession.sessionSpec.config),
          objectiveIds: objectiveIds.slice()
        }
      : null;
  if (!sessionSpec) {
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

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return entry;
  }

  return {
    ...entry,
    type: normalizeObjectiveType(entry.type)
  };
}

function normalizeBestTimesByObjective(bestTimesByObjective) {
  if (!bestTimesByObjective || typeof bestTimesByObjective !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bestTimesByObjective).map(([objectiveId, record]) => [
      objectiveId,
      record && typeof record === "object"
        ? {
            ...record,
            type: normalizeObjectiveType(record.type)
          }
        : record
    ])
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
    ? sessionSpecInput.objectiveIds.filter((objectiveId) => typeof objectiveId === "string")
    : [];

  if (objectiveIds.length === 0) {
    return null;
  }

  const sessionSpec = {
    version: sessionSpecInput.version ?? 1,
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

  return {
    sessionId:
      typeof pendingCompletion.sessionId === "string" ? pendingCompletion.sessionId : "",
    finishedAt,
    objectiveCount,
    squaresCleared,
    totalDurationMs,
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
    ? sessionSpecInput.objectiveIds.filter((objectiveId) => typeof objectiveId === "string")
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
        : Date.now(),
    exportSeed:
      typeof startCountdown.exportSeed === "string" ? startCountdown.exportSeed : "",
    sessionSpec: {
      version: sessionSpecInput.version ?? 1,
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
    history: [],
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
      : rawSelectedMode === "practice" ||
          rawSelectedMode === "drills" ||
          rawSelectedMode === "learn"
        ? "practice"
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
    history: Array.isArray(value.history) ? value.history.map(normalizeHistoryEntry) : [],
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
