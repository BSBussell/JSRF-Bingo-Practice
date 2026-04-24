import assert from "node:assert/strict";
import test from "node:test";

import { createHotkeyBinding, getDesktopAcceleratorCandidates } from "./hotkeys.js";

test("getDesktopAcceleratorCandidates expands letter bindings to parser-friendly variants", () => {
  const accelerators = getDesktopAcceleratorCandidates(
    createHotkeyBinding("KeyS", { ctrl: true, shift: true })
  );

  assert.deepEqual(accelerators, [
    "Ctrl+Shift+S",
    "Ctrl+Shift+KeyS",
    "CommandOrControl+Shift+S",
    "CommandOrControl+Shift+KeyS"
  ]);
});

test("getDesktopAcceleratorCandidates includes arrow aliases", () => {
  const accelerators = getDesktopAcceleratorCandidates(
    createHotkeyBinding("ArrowUp", { ctrl: true })
  );

  assert.deepEqual(accelerators, [
    "Ctrl+Up",
    "Ctrl+ArrowUp",
    "CommandOrControl+Up",
    "CommandOrControl+ArrowUp"
  ]);
});

test("getDesktopAcceleratorCandidates returns empty for unsupported keys", () => {
  const accelerators = getDesktopAcceleratorCandidates(
    createHotkeyBinding("AudioVolumeUp", { ctrl: true })
  );

  assert.deepEqual(accelerators, []);
});

