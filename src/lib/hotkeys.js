export const HOTKEY_ACTIONS = [
  {
    key: "split",
    label: "Phase Action",
    description: "Triggers the live phase action for travel, tape, or square completion."
  },
  {
    key: "skip",
    label: "Skip Square",
    description: "Skips the current square and rolls the next square."
  },
  {
    key: "pause",
    label: "Pause / Resume",
    description: "Toggles the current session between paused and running."
  },
  {
    key: "runBack",
    label: "Run It Back",
    description: "Restarts the current run immediately from the same seed and session spec."
  },
  {
    key: "skipSplit",
    label: "Skip Split",
    description: "Skips the current travel/tape split in practice mode."
  },
  {
    key: "toggleGuide",
    label: "Toggle Guide",
    description: "Shows or hides the embedded route guide in practice mode."
  },
  {
    key: "startCountdown",
    label: "Start Countdown",
    description: "Starts the run countdown from the Ready prompt."
  },
  {
    key: "end",
    label: "End",
    description: "Ends the current session immediately."
  }
];

const MODIFIER_ONLY_CODES = new Set([
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight"
]);

const KEY_LABELS = {
  Enter: "Enter",
  Space: "Space",
  Escape: "Esc",
  Backspace: "Backspace",
  Delete: "Delete",
  Tab: "Tab",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  IntlBackslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right"
};

const MODIFIER_LABELS = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  meta: "Meta"
};

export function createEmptyModifiers() {
  return {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false
  };
}

function normalizeModifiers(value) {
  if (!value || typeof value !== "object") {
    return createEmptyModifiers();
  }

  return {
    ctrl: Boolean(value.ctrl),
    alt: Boolean(value.alt),
    shift: Boolean(value.shift),
    meta: Boolean(value.meta)
  };
}

export function normalizeHotkeyBinding(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      code: value,
      modifiers: createEmptyModifiers()
    };
  }

  if (typeof value !== "object" || typeof value.code !== "string" || !value.code) {
    return null;
  }

  return {
    code: value.code,
    modifiers: normalizeModifiers(value.modifiers)
  };
}

export function createHotkeyBinding(code, modifiers = createEmptyModifiers()) {
  return normalizeHotkeyBinding({
    code,
    modifiers
  });
}

export function hasHotkeyModifier(binding) {
  const normalizedBinding = normalizeHotkeyBinding(binding);
  if (!normalizedBinding) {
    return false;
  }

  return Object.values(normalizedBinding.modifiers).some(Boolean);
}

export function isModifierOnlyCode(code) {
  return MODIFIER_ONLY_CODES.has(code);
}

export function formatHotkeyKey(code) {
  if (!code) {
    return "Unbound";
  }

  if (KEY_LABELS[code]) {
    return KEY_LABELS[code];
  }

  if (code.startsWith("Key")) {
    return code.slice(3).toUpperCase();
  }

  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  if (code.startsWith("Numpad")) {
    return `Num ${code.slice(6)}`;
  }

  return code;
}

export function formatHotkeyBinding(binding) {
  const normalizedBinding = normalizeHotkeyBinding(binding);
  if (!normalizedBinding) {
    return "Unbound";
  }

  const modifierParts = Object.entries(normalizedBinding.modifiers)
    .filter(([, active]) => active)
    .map(([modifier]) => MODIFIER_LABELS[modifier]);

  return [...modifierParts, formatHotkeyKey(normalizedBinding.code)].join("+");
}

export function eventMatchesHotkeyBinding(binding, event) {
  const normalizedBinding = normalizeHotkeyBinding(binding);
  if (!normalizedBinding) {
    return false;
  }

  return (
    normalizedBinding.code === event.code &&
    normalizedBinding.modifiers.ctrl === Boolean(event.ctrlKey) &&
    normalizedBinding.modifiers.alt === Boolean(event.altKey) &&
    normalizedBinding.modifiers.shift === Boolean(event.shiftKey) &&
    normalizedBinding.modifiers.meta === Boolean(event.metaKey)
  );
}

export function getDesktopModifierParts(binding) {
  const normalizedBinding = normalizeHotkeyBinding(binding);
  if (!normalizedBinding) {
    return [];
  }

  return [
    normalizedBinding.modifiers.ctrl ? "Ctrl" : null,
    normalizedBinding.modifiers.alt ? "Alt" : null,
    normalizedBinding.modifiers.shift ? "Shift" : null,
    normalizedBinding.modifiers.meta ? "Cmd" : null
  ].filter(Boolean);
}
