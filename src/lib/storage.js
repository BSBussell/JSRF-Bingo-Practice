import { createHotkeyBinding, normalizeHotkeyBinding } from "./hotkeys.js";
import { OBJECTIVE_FRESHNESS_WINDOW } from "./drillSessionConstants.js";
import { normalizeObjectiveType } from "./objectiveTypes.js";
import {
  DEFAULT_DRILL_SETTINGS,
  normalizeDrillSettings
} from "./drillSettings.js";

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
  learnVideoAutoplay: false,
  learnAudioMuted: true,
  popoutAlwaysOnTop: false
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

function normalizeSettings(value) {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_SETTINGS,
      drillSettings: normalizeDrillSettings(DEFAULT_DRILL_SETTINGS),
      hotkeys: {
        ...DEFAULT_HOTKEYS
      }
    };
  }

  return {
    startingArea:
      typeof value.startingArea === "string" && value.startingArea
        ? value.startingArea
        : DEFAULT_SETTINGS.startingArea,
    drillSettings: normalizeDrillSettings(value.drillSettings),
    hotkeys: normalizeHotkeys(value.hotkeys),
    learnVideoAutoplay:
      typeof value.learnVideoAutoplay === "boolean"
        ? value.learnVideoAutoplay
        : DEFAULT_SETTINGS.learnVideoAutoplay,
    learnAudioMuted:
      typeof value.learnAudioMuted === "boolean"
        ? value.learnAudioMuted
        : DEFAULT_SETTINGS.learnAudioMuted,
    popoutAlwaysOnTop:
      typeof value.popoutAlwaysOnTop === "boolean"
        ? value.popoutAlwaysOnTop
        : DEFAULT_SETTINGS.popoutAlwaysOnTop
  };
}

function normalizeCurrentSession(currentSession) {
  if (!currentSession || typeof currentSession !== "object") {
    return null;
  }

  if (!currentSession.currentObjectiveId || !currentSession.currentArea) {
    return null;
  }

  const objectiveStartedAt =
    currentSession.objectiveStartedAt ??
    currentSession.timerStartedAt ??
    currentSession.currentObjectiveGeneratedAt ??
    Date.now();
  const phase = currentSession.phase ?? "challenge";
  const phaseStartedAt = currentSession.phaseStartedAt ?? objectiveStartedAt;

  return {
    ...currentSession,
    drillSettings: normalizeDrillSettings(currentSession.drillSettings),
    objectiveStartedAt,
    phaseStartedAt,
    phase,
    challengeStartedAt:
      currentSession.challengeStartedAt ??
      (phase === "challenge" ? phaseStartedAt : null),
    usedObjectiveIds: Array.isArray(currentSession.usedObjectiveIds)
      ? currentSession.usedObjectiveIds.slice(-OBJECTIVE_FRESHNESS_WINDOW)
      : [],
    enteredLevelAt: currentSession.enteredLevelAt ?? null,
    tapeStartedAt: currentSession.tapeStartedAt ?? null,
    tapeUnlockedAt: currentSession.tapeUnlockedAt ?? null,
    unlockedTapeAreas: Array.isArray(currentSession.unlockedTapeAreas)
      ? currentSession.unlockedTapeAreas
      : [],
    pausedAt: currentSession.pausedAt ?? null,
    totalPausedMs: currentSession.totalPausedMs ?? 0,
    travelPausedMs: currentSession.travelPausedMs ?? 0,
    tapePausedMs: currentSession.tapePausedMs ?? 0,
    challengePausedMs: currentSession.challengePausedMs ?? 0
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

export function createDefaultAppState() {
  return {
    selectedMode: null,
    settings: {
      ...DEFAULT_SETTINGS,
      drillSettings: normalizeDrillSettings(DEFAULT_DRILL_SETTINGS),
      hotkeys: {
        ...DEFAULT_HOTKEYS
      }
    },
    currentSession: null,
    history: [],
    bestTimesByObjective: {},
    aggregateStats: {
      squareByArea: {},
      tapeByArea: {},
      graffitiByArea: {}
    }
  };
}

export function normalizeAppState(value) {
  const defaults = createDefaultAppState();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  return {
    ...defaults,
    ...value,
    settings: normalizeSettings(value.settings),
    currentSession: normalizeCurrentSession(value.currentSession),
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
