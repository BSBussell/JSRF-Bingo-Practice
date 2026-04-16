import { PRESET_THEME_ORDER, PRESET_THEMES } from "./presets.js";
import {
  BACKDROP_DIRECTION_OPTIONS,
  BACKDROP_SPAWN_ZONE_OPTIONS,
  BASE_PARTICLE_COUNT,
  CUSTOM_THEME_ID,
  DEFAULT_BACKDROP,
  DEFAULT_CUSTOM_THEME,
  DEFAULT_STATUS_COLORS,
  DEFAULT_THEME_ID,
  THEME_CAPS
} from "./schema.js";

const DEFAULT_SUCCESS = DEFAULT_STATUS_COLORS.success;
const DEFAULT_DANGER = DEFAULT_STATUS_COLORS.danger;
const DEFAULT_WARNING = DEFAULT_STATUS_COLORS.warning;
const CORNER_RADIUS_CAPS = THEME_CAPS.cornerRadius;
const GLOW_INTENSITY_CAPS = THEME_CAPS.glowIntensity;
const BACKDROP_APPEARANCE_CAPS = THEME_CAPS.backdrop.appearance;
const BACKDROP_MOTION_CAPS = THEME_CAPS.backdrop.motion;
const BACKDROP_DENSITY_CAPS = THEME_CAPS.backdrop.density;

function cloneBackdrop(backdrop) {
  return {
    colors: {
      ...backdrop.colors
    },
    appearance: {
      ...backdrop.appearance
    },
    motion: {
      ...backdrop.motion
    },
    density: {
      ...backdrop.density
    }
  };
}

export function createDefaultCustomTheme() {
  return {
    ...DEFAULT_CUSTOM_THEME,
    backdrop: cloneBackdrop(DEFAULT_BACKDROP)
  };
}

export const THEME_OPTIONS = [
  ...PRESET_THEME_ORDER.map((themeId) => {
    const theme = PRESET_THEMES[themeId];
    return {
      value: theme.id,
      label: theme.label,
      description: theme.description
    };
  }),
  {
    value: CUSTOM_THEME_ID,
    label: "Custom",
    description: "Adjust a stable set of core colors and backdrop moods."
  }
];

// Flicker intensity: 0 = none, 1 = subtle, 2 = moderate, 3 = firefly-like

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) {
    return fallback;
  }

  const expanded = normalized.length === 3
    ? normalized
      .split("")
      .map((character) => `${character}${character}`)
      .join("")
    : normalized;

  return `#${expanded.toLowerCase()}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbString(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function mixColors(left, right, amount) {
  const ratio = Math.max(0, Math.min(1, amount));
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);

  return rgbToHex({
    r: leftRgb.r + (rightRgb.r - leftRgb.r) * ratio,
    g: leftRgb.g + (rightRgb.g - leftRgb.g) * ratio,
    b: leftRgb.b + (rightRgb.b - leftRgb.b) * ratio
  });
}

function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function rgbChannelToHslChannel(channel) {
  return channel / 255;
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const red = rgbChannelToHslChannel(r);
  const green = rgbChannelToHslChannel(g);
  const blue = rgbChannelToHslChannel(b);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return {
      h: 0,
      s: 0,
      l: lightness
    };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: saturation,
    l: lightness
  };
}

function hueToRgbChannel(p, q, t) {
  let channel = t;
  if (channel < 0) {
    channel += 1;
  }
  if (channel > 1) {
    channel -= 1;
  }
  if (channel < 1 / 6) {
    return p + (q - p) * 6 * channel;
  }
  if (channel < 1 / 2) {
    return q;
  }
  if (channel < 2 / 3) {
    return p + (q - p) * (2 / 3 - channel) * 6;
  }

  return p;
}

function hslToHex({ h, s, l }) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(1, s));
  const lightness = Math.max(0, Math.min(1, l));

  if (saturation === 0) {
    const channel = lightness * 255;
    return rgbToHex({ r: channel, g: channel, b: channel });
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return rgbToHex({
    r: hueToRgbChannel(p, q, hue / 360 + 1 / 3) * 255,
    g: hueToRgbChannel(p, q, hue / 360) * 255,
    b: hueToRgbChannel(p, q, hue / 360 - 1 / 3) * 255
  });
}

function getContrastRatio(left, right) {
  const leftLuminance = getRelativeLuminance(left);
  const rightLuminance = getRelativeLuminance(right);
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function getHueDistance(left, right) {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function resolveButtonText(accent, background) {
  return getRelativeLuminance(accent) > 0.44
    ? mixColors(background, "#000000", 0.22)
    : "#fff7ea";
}

function resolveReadableHslColor({
  hue,
  saturation,
  lightness,
  background,
  minimumContrast = 4.5
}) {
  const backgroundIsDark = getRelativeLuminance(background) < 0.38;
  let nextLightness = lightness;
  let color = hslToHex({ h: hue, s: saturation, l: nextLightness });

  for (
    let attempt = 0;
    attempt < 24 && getContrastRatio(color, background) < minimumContrast;
    attempt += 1
  ) {
    nextLightness = backgroundIsDark
      ? Math.min(0.86, nextLightness + 0.025)
      : Math.max(0.18, nextLightness - 0.025);
    color = hslToHex({ h: hue, s: saturation, l: nextLightness });
  }

  return color;
}

function findNearestPaletteColor(targetHue, paletteColors) {
  return paletteColors
    .map((color) => ({
      color,
      hsl: hexToHsl(color)
    }))
    .sort((left, right) =>
      getHueDistance(targetHue, left.hsl.h) - getHueDistance(targetHue, right.hsl.h)
    )[0];
}

function resolveDistrictColor({
  hue,
  saturation,
  lightness,
  surface,
  paletteColors
}) {
  const readableBaseColor = resolveReadableHslColor({
    hue,
    saturation,
    lightness,
    background: surface
  });
  const nearestPaletteColor = findNearestPaletteColor(hue, paletteColors);
  const paletteHuePull = nearestPaletteColor
    ? Math.max(0, 1 - getHueDistance(hue, nearestPaletteColor.hsl.h) / 120) * 0.18
    : 0;
  const paletteMix = 0.04 + paletteHuePull;
  const harmonizedColor = nearestPaletteColor
    ? mixColors(readableBaseColor, nearestPaletteColor.color, paletteMix)
    : readableBaseColor;

  return getContrastRatio(harmonizedColor, surface) >= 4.5
    ? harmonizedColor
    : resolveReadableHslColor({
        hue,
        saturation,
        lightness,
        background: surface
      });
}

function resolveDistrictColors({
  surface,
  text,
  accent,
  accentSoft,
  secondaryAccent
}) {
  const accentHsl = hexToHsl(accent);
  const accentSoftHsl = hexToHsl(accentSoft);
  const secondaryHsl = hexToHsl(secondaryAccent);
  const textHsl = hexToHsl(text);
  const paletteColors = [accent, accentSoft, secondaryAccent];
  const surfaceIsDark = getRelativeLuminance(surface) < getRelativeLuminance(text);
  const paletteSaturation =
    accentHsl.s * 0.42 + accentSoftHsl.s * 0.28 + secondaryHsl.s * 0.3;
  const paletteLightness =
    accentHsl.l * 0.38 + accentSoftHsl.l * 0.24 + secondaryHsl.l * 0.38;
  const saturation = surfaceIsDark
    ? Math.max(0.46, Math.min(0.95, paletteSaturation * 0.68 + 0.18))
    : Math.max(0.62, Math.min(0.95, paletteSaturation * 0.74 + 0.22));
  const lightness = surfaceIsDark
    ? Math.max(
        0.56,
        Math.min(0.78, paletteLightness * 0.52 + textHsl.l * 0.22 + 0.16)
      )
    : Math.max(
        0.32,
        Math.min(0.4, paletteLightness * 0.24 + textHsl.l * 0.2 + 0.2)
      );

  return {
    ShibuyaCho: resolveDistrictColor({
      hue: 136,
      saturation,
      lightness,
      surface,
      paletteColors
    }),
    Kogane: resolveDistrictColor({
      hue: 6,
      saturation,
      lightness,
      surface,
      paletteColors
    }),
    Benten: resolveDistrictColor({
      hue: 214,
      saturation,
      lightness,
      surface,
      paletteColors
    })
  };
}

function normalizeBackdropDirection(value, fallback = DEFAULT_BACKDROP.motion.direction) {
  return BACKDROP_DIRECTION_OPTIONS.some((option) => option.value === value)
    ? value
    : fallback;
}

function normalizeBackdropZone(value, fallback = DEFAULT_BACKDROP.density.zone) {
  return BACKDROP_SPAWN_ZONE_OPTIONS.some((option) => option.value === value)
    ? value
    : fallback;
}

function normalizeBackdropConfig(value, legacySource = value) {
  const colorsSource = value?.colors && typeof value.colors === "object" ? value.colors : {};
  const appearanceSource = value?.appearance && typeof value.appearance === "object" ? value.appearance : {};
  const motionSource = value?.motion && typeof value.motion === "object" ? value.motion : {};
  const densitySource = value?.density && typeof value.density === "object" ? value.density : {};

  const legacySpeed = Number.isFinite(legacySource?.baseLift)
    ? legacySource.baseLift
    : legacySource?.motionIntensity;
  const legacyZone = Number.isFinite(legacySource?.spawnBias ?? legacySource?.particleSpawnBias)
    ? (legacySource.spawnBias ?? legacySource.particleSpawnBias) > 0.72
      ? "bottom"
      : (legacySource.spawnBias ?? legacySource.particleSpawnBias) < 0.3
        ? "top"
        : "middle"
    : undefined;

  return {
    colors: {
      particleColor: normalizeHexColor(
        colorsSource.particleColor ?? legacySource?.particleColor,
        DEFAULT_BACKDROP.colors.particleColor
      ),
      particleCore: normalizeHexColor(
        colorsSource.particleCore ?? legacySource?.particleCore,
        DEFAULT_BACKDROP.colors.particleCore
      ),
      hazeColorA: normalizeHexColor(
        colorsSource.hazeColorA ?? legacySource?.hazeColorA,
        DEFAULT_BACKDROP.colors.hazeColorA
      ),
      hazeColorB: normalizeHexColor(
        colorsSource.hazeColorB ?? legacySource?.hazeColorB,
        DEFAULT_BACKDROP.colors.hazeColorB
      )
    },
    appearance: {
      glow: clampNumber(
        appearanceSource.glow ?? legacySource?.particleGlow,
        BACKDROP_APPEARANCE_CAPS.glow.min,
        BACKDROP_APPEARANCE_CAPS.glow.max,
        DEFAULT_BACKDROP.appearance.glow
      ),
      size: clampNumber(
        appearanceSource.size ?? legacySource?.particleSize,
        BACKDROP_APPEARANCE_CAPS.size.min,
        BACKDROP_APPEARANCE_CAPS.size.max,
        DEFAULT_BACKDROP.appearance.size
      ),
      flicker: clampNumber(
        appearanceSource.flicker ?? legacySource?.flickerIntensity,
        BACKDROP_APPEARANCE_CAPS.flicker.min,
        BACKDROP_APPEARANCE_CAPS.flicker.max,
        DEFAULT_BACKDROP.appearance.flicker
      ),
      opacity: clampNumber(
        appearanceSource.opacity ?? legacySource?.particleOpacity,
        BACKDROP_APPEARANCE_CAPS.opacity.min,
        BACKDROP_APPEARANCE_CAPS.opacity.max,
        DEFAULT_BACKDROP.appearance.opacity
      )
    },
    motion: {
      direction: normalizeBackdropDirection(
        motionSource.direction ?? legacySource?.motionDirection,
        DEFAULT_BACKDROP.motion.direction
      ),
      speed: clampNumber(
        motionSource.speed ?? legacySpeed,
        BACKDROP_MOTION_CAPS.speed.min,
        BACKDROP_MOTION_CAPS.speed.max,
        DEFAULT_BACKDROP.motion.speed
      ),
      swayAmplitude: clampNumber(
        motionSource.swayAmplitude ?? legacySource?.amplitude,
        BACKDROP_MOTION_CAPS.swayAmplitude.min,
        BACKDROP_MOTION_CAPS.swayAmplitude.max,
        DEFAULT_BACKDROP.motion.swayAmplitude
      ),
      swayFrequency: clampNumber(
        motionSource.swayFrequency ?? legacySource?.frequency,
        BACKDROP_MOTION_CAPS.swayFrequency.min,
        BACKDROP_MOTION_CAPS.swayFrequency.max,
        DEFAULT_BACKDROP.motion.swayFrequency
      ),
      drift: clampNumber(
        motionSource.drift ?? legacySource?.driftRandomness ?? legacySource?.motionIntensity,
        BACKDROP_MOTION_CAPS.drift.min,
        BACKDROP_MOTION_CAPS.drift.max,
        DEFAULT_BACKDROP.motion.drift
      )
    },
    density: {
      amount: clampNumber(
        densitySource.amount ?? legacySource?.particleDensity,
        BACKDROP_DENSITY_CAPS.amount.min,
        BACKDROP_DENSITY_CAPS.amount.max,
        DEFAULT_BACKDROP.density.amount
      ),
      spread: clampNumber(
        densitySource.spread ?? legacySource?.spawnSpread,
        BACKDROP_DENSITY_CAPS.spread.min,
        BACKDROP_DENSITY_CAPS.spread.max,
        DEFAULT_BACKDROP.density.spread
      ),
      zone: normalizeBackdropZone(
        densitySource.zone ?? legacySource?.spawnZone ?? legacyZone,
        DEFAULT_BACKDROP.density.zone
      )
    }
  };
}

const FALLBACK_PRESET_THEME =
  PRESET_THEMES[DEFAULT_THEME_ID] ?? PRESET_THEMES[PRESET_THEME_ORDER[0]];

function normalizePresetThemeDefinition(themeDefinitionInput) {
  const themeDefinition = themeDefinitionInput ?? FALLBACK_PRESET_THEME;
  const palette = themeDefinition?.palette ?? {};
  const fallbackPalette = FALLBACK_PRESET_THEME.palette;

  return {
    id: themeDefinition?.id ?? FALLBACK_PRESET_THEME.id,
    label: themeDefinition?.label ?? FALLBACK_PRESET_THEME.label,
    description: themeDefinition?.description ?? FALLBACK_PRESET_THEME.description,
    palette: {
      background: normalizeHexColor(palette.background, fallbackPalette.background),
      backgroundMid: normalizeHexColor(palette.backgroundMid, fallbackPalette.backgroundMid),
      backgroundEnd: normalizeHexColor(palette.backgroundEnd, fallbackPalette.backgroundEnd),
      surface: normalizeHexColor(palette.surface, fallbackPalette.surface),
      text: normalizeHexColor(palette.text, fallbackPalette.text),
      textSecondary: normalizeHexColor(palette.textSecondary, fallbackPalette.textSecondary),
      textMuted: normalizeHexColor(palette.textMuted, fallbackPalette.textMuted),
      accent: normalizeHexColor(palette.accent, fallbackPalette.accent),
      accentStrong: normalizeHexColor(palette.accentStrong, fallbackPalette.accentStrong),
      accentSoft: normalizeHexColor(palette.accentSoft, fallbackPalette.accentSoft),
      secondaryAccent: normalizeHexColor(
        palette.secondaryAccent,
        fallbackPalette.secondaryAccent
      ),
      border: normalizeHexColor(palette.border, fallbackPalette.border),
      cornerRadius: clampNumber(
        palette.cornerRadius,
        CORNER_RADIUS_CAPS.min,
        CORNER_RADIUS_CAPS.max,
        fallbackPalette.cornerRadius ?? CORNER_RADIUS_CAPS.default
      ),
      success: normalizeHexColor(
        palette.success,
        fallbackPalette.success ?? DEFAULT_SUCCESS
      ),
      danger: normalizeHexColor(
        palette.danger,
        fallbackPalette.danger ?? DEFAULT_DANGER
      ),
      warning: normalizeHexColor(
        palette.warning,
        fallbackPalette.warning ?? DEFAULT_WARNING
      ),
      glowIntensity: clampNumber(
        palette.glowIntensity,
        GLOW_INTENSITY_CAPS.min,
        GLOW_INTENSITY_CAPS.max,
        fallbackPalette.glowIntensity ?? GLOW_INTENSITY_CAPS.default
      )
    },
    backdrop: normalizeBackdropConfig(themeDefinition?.backdrop)
  };
}

const NORMALIZED_PRESET_THEMES = Object.fromEntries(
  PRESET_THEME_ORDER.map((themeId) => [
    themeId,
    normalizePresetThemeDefinition(PRESET_THEMES[themeId])
  ])
);

function createCustomThemeDefinition(customTheme) {
  const normalizedCustomTheme = normalizeCustomTheme(customTheme);
  const accentStrong = mixColors(normalizedCustomTheme.accent, normalizedCustomTheme.text, 0.36);
  const accentSoft = mixColors(normalizedCustomTheme.accent, normalizedCustomTheme.border, 0.5);
  const secondaryAccent = mixColors(normalizedCustomTheme.border, normalizedCustomTheme.text, 0.1);

  return {
    id: CUSTOM_THEME_ID,
    label: "Custom",
    description: "User-configured trainer colors and backdrop tuning.",
    palette: {
      background: normalizedCustomTheme.background,
      backgroundMid: mixColors(normalizedCustomTheme.background, normalizedCustomTheme.surface, 0.42),
      backgroundEnd: mixColors(normalizedCustomTheme.background, normalizedCustomTheme.border, 0.16),
      surface: normalizedCustomTheme.surface,
      text: normalizedCustomTheme.text,
      textSecondary: mixColors(normalizedCustomTheme.text, normalizedCustomTheme.background, 0.14),
      textMuted: mixColors(normalizedCustomTheme.text, normalizedCustomTheme.border, 0.42),
      accent: normalizedCustomTheme.accent,
      accentStrong,
      accentSoft,
      secondaryAccent,
      border: normalizedCustomTheme.border,
      cornerRadius: normalizedCustomTheme.cornerRadius,
      success: mixColors(DEFAULT_SUCCESS, normalizedCustomTheme.accent, 0.15),
      danger: mixColors(DEFAULT_DANGER, normalizedCustomTheme.border, 0.18),
      warning: mixColors(DEFAULT_WARNING, normalizedCustomTheme.text, 0.12),
      glowIntensity: normalizedCustomTheme.glowIntensity
    },
    backdrop: normalizedCustomTheme.backdrop
  };
}

function buildCssVariables(palette) {
  const background = palette.background;
  const backgroundMid = palette.backgroundMid ?? mixColors(background, palette.surface, 0.42);
  const backgroundEnd = palette.backgroundEnd ?? mixColors(background, palette.border, 0.16);
  const surface = palette.surface;
  const surfaceStrong = mixColors(surface, background, 0.18);
  const surfaceDeep = mixColors(surface, background, 0.32);
  const text = palette.text;
  const textSecondary = palette.textSecondary ?? mixColors(text, background, 0.14);
  const textMuted = palette.textMuted ?? mixColors(text, palette.border, 0.42);
  const accent = palette.accent;
  const accentStrong = palette.accentStrong ?? mixColors(accent, text, 0.36);
  const accentSoft = palette.accentSoft ?? mixColors(accent, palette.border, 0.5);
  const secondaryAccent = palette.secondaryAccent ?? mixColors(palette.border, text, 0.1);
  const success = palette.success ?? DEFAULT_SUCCESS;
  const danger = palette.danger ?? DEFAULT_DANGER;
  const warning = palette.warning ?? DEFAULT_WARNING;
  const glow = clampNumber(
    palette.glowIntensity,
    GLOW_INTENSITY_CAPS.min,
    GLOW_INTENSITY_CAPS.max,
    GLOW_INTENSITY_CAPS.default
  );
  const radiusScale = clampNumber(
    palette.cornerRadius,
    CORNER_RADIUS_CAPS.min,
    CORNER_RADIUS_CAPS.max,
    CORNER_RADIUS_CAPS.default
  );
  const learnBase = mixColors(text, accent, 0.12);
  const learnGlow = mixColors(text, accent, 0.28);
  const learnWarm = mixColors(learnBase, accent, 0.35);
  const buttonText = resolveButtonText(accent, background);
  const buttonBase = mixColors(accent, background, 0.2);
  const districtColors = resolveDistrictColors({
    surface,
    text,
    accent,
    accentSoft,
    secondaryAccent
  });

  return {
    "--text-primary": text,
    "--text-secondary": textSecondary,
    "--text-muted": textMuted,
    "--panel-border": rgba(palette.border, 0.11),
    "--panel-shadow": `0 20px 46px ${rgba("#000000", 0.34)}`,
    "--accent": accent,
    "--accent-strong": accentStrong,
    "--accent-soft": accentSoft,
    "--atmo-cool": secondaryAccent,
    "--muted": textMuted,
    "--success": success,
    "--danger": danger,
    "--radius-panel": `calc(1.35rem * ${radiusScale})`,
    "--radius-card-lg": `calc(1.15rem * ${radiusScale})`,
    "--radius-card": `calc(1rem * ${radiusScale})`,
    "--radius-button": `calc(0.95rem * ${radiusScale})`,
    "--radius-control": `calc(0.9rem * ${radiusScale})`,
    "--radius-frame": `calc(1.25rem * ${radiusScale})`,
    "--radius-media": `calc(0.8rem * ${radiusScale})`,
    "--body-background": background,
    "--app-shell-background": `radial-gradient(circle at 14% 12%, ${rgba(accent, 0.2 * glow)}, transparent 24%), radial-gradient(circle at 82% 18%, ${rgba(secondaryAccent, 0.1 * glow)}, transparent 28%), radial-gradient(circle at 52% 100%, ${rgba(accentSoft, 0.16 * glow)}, transparent 34%), linear-gradient(180deg, ${background} 0%, ${backgroundMid} 44%, ${backgroundEnd} 100%)`,
    "--app-shell-before-background": `radial-gradient(circle at 18% 20%, ${rgba(accentStrong, 0.04 * glow)}, transparent 18%), radial-gradient(circle at 74% 26%, ${rgba(accentSoft, 0.05 * glow)}, transparent 22%), radial-gradient(circle at 64% 82%, ${rgba(secondaryAccent, 0.035 * glow)}, transparent 18%)`,
    "--app-shell-after-background": `linear-gradient(${rgba(text, 0.018)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(text, 0.015)} 1px, transparent 1px), linear-gradient(180deg, ${rgba(text, 0.055)} 0%, ${rgba(text, 0.028)} 18%, ${rgba(text, 0.014)} 42%, ${rgba(text, 0.006)} 70%, transparent 100%)`,
    "--background-glow-left-bg": rgba(accent, 0.24 * glow),
    "--background-glow-right-bg": rgba(accentSoft, 0.18 * glow),
    "--header-background": `linear-gradient(180deg, ${rgba(mixColors(background, "#000000", 0.14), 0.86)}, ${rgba(mixColors(background, "#000000", 0.22), 0.68)}), radial-gradient(circle at left top, ${rgba(accent, 0.1 * glow)}, transparent 42%)`,
    "--header-border": rgba(palette.border, 0.08),
    "--header-shadow": `0 10px 28px ${rgba("#000000", 0.22)}`,
    "--primary-text-shadow": `0 0 1px ${rgba(text, 0.9)}, 0 0 6px ${rgba(accentStrong, 0.72 * glow)}, 0 0 14px ${rgba(accent, 0.52 * glow)}, 0 0 28px ${rgba(accent, 0.3 * glow)}, 0 0 42px ${rgba(accentSoft, 0.18 * glow)}`,
    "--accent-text-shadow": `0 0 1px ${rgba(text, 0.72)}, 0 0 5px ${rgba(accentStrong, 0.48 * glow)}, 0 0 14px ${rgba(accentSoft, 0.16 * glow)}`,
    "--muted-text-shadow": `0 0 1px ${rgba(text, 0.34)}, 0 0 8px ${rgba(accentStrong, 0.14 * glow)}`,
    "--nav-background": `linear-gradient(180deg, ${rgba(text, 0.05)}, ${rgba(text, 0.025)})`,
    "--nav-border": rgba(palette.border, 0.06),
    "--nav-active-background": `linear-gradient(135deg, ${rgba(accent, 0.2 * glow)}, ${rgba(accentSoft, 0.16 * glow)})`,
    "--nav-active-border": rgba(accentStrong, 0.2),
    "--nav-active-shadow": `inset 0 0 0 1px ${rgba(accentStrong, 0.06)}`,
    "--badge-background": rgba(text, 0.08),
    "--panel-background": `linear-gradient(180deg, ${rgba(text, 0.03)}, ${rgba(text, 0.01)}), linear-gradient(180deg, ${rgba(surface, 0.84)}, ${rgba(surfaceStrong, 0.78)})`,
    "--panel-before-background": `radial-gradient(circle at top left, ${rgba(accent, 0.13 * glow)}, transparent 28%), radial-gradient(circle at bottom right, ${rgba(accentSoft, 0.08 * glow)}, transparent 26%), linear-gradient(300deg, ${rgba(secondaryAccent, 0.06 * glow)}, transparent 20%)`,
    "--panel-inner-shadow": `inset 0 1px 0 ${rgba(text, 0.05)}, inset 0 0 28px ${rgba(accentStrong, 0.035 * glow)}`,
    "--surface-card-background": rgba(text, 0.04),
    "--surface-card-border": rgba(palette.border, 0.06),
    "--settings-section-background": `linear-gradient(135deg, ${rgba(accent, 0.1 * glow)}, ${rgba(accentSoft, 0.08 * glow)}), ${rgba(text, 0.015)}`,
    "--settings-section-border": rgba(palette.border, 0.08),
    "--warning-text": warning,
    "--toggle-track-background": rgba(text, 0.08),
    "--toggle-track-border": rgba(palette.border, 0.08),
    "--toggle-thumb-background": mixColors(text, accent, 0.08),
    "--toggle-thumb-shadow": `0 0 12px ${rgba(accentStrong, 0.26 * glow)}`,
    "--toggle-track-active-background": `linear-gradient(135deg, ${rgba(accent, 0.34 * glow)}, ${rgba(accentSoft, 0.26 * glow)})`,
    "--toggle-track-active-border": rgba(accentStrong, 0.22),
    "--danger-zone-background": `linear-gradient(135deg, ${rgba(danger, 0.1)}, ${rgba(accentSoft, 0.08)}), ${rgba(text, 0.015)}`,
    "--danger-zone-border": rgba(danger, 0.2),
    "--learn-frame-background": `radial-gradient(circle at 18% 14%, ${rgba("#ffffff", 0.46)}, transparent 36%), radial-gradient(circle at 82% 20%, ${rgba(learnGlow, 0.4)}, transparent 34%), radial-gradient(circle at 50% 64%, ${rgba(learnBase, 0.96)} 0%, ${rgba(learnBase, 0.9)} 48%, ${rgba(learnWarm, 0.46)} 75%, ${rgba(accent, 0.24)} 100%), linear-gradient(135deg, ${rgba(learnBase, 0.98)}, ${rgba(learnBase, 0.92)} 58%, ${rgba(learnWarm, 0.34)})`,
    "--learn-frame-border": rgba(accent, 0.68),
    "--learn-frame-shadow": `inset 0 0 0 1px ${rgba(learnBase, 0.64)}, inset 0 1px 0 ${rgba("#ffffff", 0.72)}, inset 0 -12px 26px ${rgba(accent, 0.18 * glow)}, 0 0 20px ${rgba(learnBase, 0.7)}, 0 0 42px ${rgba(accent, 0.4 * glow)}, 0 0 88px ${rgba(accentSoft, 0.24 * glow)}, 0 22px 42px ${rgba("#000000", 0.3)}`,
    "--learn-frame-after-background": `linear-gradient(125deg, ${rgba("#ffffff", 0.32)}, transparent 24%, transparent 72%, ${rgba(learnGlow, 0.16)}), radial-gradient(circle at 50% 0%, ${rgba("#ffffff", 0.34)}, transparent 52%), radial-gradient(circle at 50% 100%, ${rgba(accent, 0.22)}, transparent 44%)`,
    "--learn-frame-iframe-shadow": `0 0 0 1px ${rgba("#ffffff", 0.34)}, 0 18px 30px ${rgba(background, 0.28)}`,
    "--learn-empty-background": rgba(text, 0.05),
    "--learn-empty-border": rgba(palette.border, 0.07),
    "--dropdown-background": rgba(surfaceDeep, 0.96),
    "--dropdown-border": rgba(palette.border, 0.09),
    "--dropdown-shadow": `0 14px 28px ${rgba("#000000", 0.3)}`,
    "--input-background": `linear-gradient(180deg, ${rgba(accentStrong, 0.05)}, ${rgba(text, 0.01)}), ${rgba("#000000", 0.22)}`,
    "--input-border": rgba(palette.border, 0.14),
    "--danger-input-background": `linear-gradient(180deg, ${rgba(danger, 0.14)}, ${rgba(text, 0.01)}), ${rgba(mixColors(background, danger, 0.24), 0.34)}`,
    "--danger-input-border": rgba(danger, 0.24),
    "--danger-input-text": mixColors(text, danger, 0.24),
    "--button-hotkey-background": rgba("#000000", 0.14),
    "--primary-button-background": `linear-gradient(180deg, ${rgba(text, 0.18)}, ${rgba("#ffffff", 0)} 44%), linear-gradient(135deg, ${buttonBase}, ${accent} 58%, ${accentStrong})`,
    "--primary-button-text": buttonText,
    "--primary-button-shadow": `inset 0 1px 0 ${rgba(text, 0.28)}, 0 0 0 1px ${rgba(palette.border, 0.09)}, 0 10px 20px ${rgba(buttonBase, 0.24)}`,
    "--secondary-button-background": `linear-gradient(180deg, ${rgba(accentStrong, 0.06)}, ${rgba(text, 0.02)}), ${rgba(text, 0.02)}`,
    "--secondary-button-border": rgba(accentStrong, 0.08),
    "--danger-button-text": mixColors(text, danger, 0.15),
    "--danger-button-border": rgba(danger, 0.25),
    "--timer-pill-background": `linear-gradient(180deg, ${rgba(accentStrong, 0.06)}, ${rgba(text, 0.02)}), ${rgba(text, 0.025)}`,
    "--timer-pill-border": rgba(palette.border, 0.06),
    "--timer-pill-shadow": `inset 0 1px 0 ${rgba(text, 0.03)}`,
    "--timer-pill-text": mixColors(text, accent, 0.12),
    "--timer-pill-running-border": rgba(secondaryAccent, 0.24),
    "--timer-pill-running-shadow": `inset 0 0 0 1px ${rgba(secondaryAccent, 0.06)}`,
    "--timer-pill-accent-border": rgba(accent, 0.28),
    "--timer-pill-accent-shadow": `inset 0 0 0 1px ${rgba(accent, 0.08)}`,
    "--timer-pill-primary-background": `radial-gradient(circle at top left, ${rgba(accentStrong, 0.14 * glow)}, transparent 34%), linear-gradient(135deg, ${rgba(accent, 0.15 * glow)}, ${rgba(accentSoft, 0.08 * glow)} 68%, ${rgba(text, 0.04)})`,
    "--timer-pill-primary-shadow": `inset 0 1px 0 ${rgba(learnBase, 0.06)}, inset 0 0 24px ${rgba(accentStrong, 0.04 * glow)}`,
    "--split-board-background": `linear-gradient(180deg, ${rgba(accentStrong, 0.05)}, ${rgba(text, 0.02)}), ${rgba(text, 0.02)}`,
    "--split-board-border": rgba(palette.border, 0.09),
    "--split-board-shadow": `inset 0 1px 0 ${rgba(text, 0.03)}, inset 0 0 18px ${rgba(accentStrong, 0.03 * glow)}`,
    "--split-card-background": `linear-gradient(180deg, ${rgba(accentStrong, 0.05)}, ${rgba(text, 0.02)}), ${rgba(text, 0.02)}`,
    "--split-card-border": rgba(palette.border, 0.07),
    "--split-live-background": `linear-gradient(180deg, ${rgba(accentStrong, 0.12 * glow)}, ${rgba(accent, 0.04 * glow)})`,
    "--split-live-border": rgba(accent, 0.35),
    "--split-done-background": `linear-gradient(180deg, ${rgba(secondaryAccent, 0.08)}, ${rgba(secondaryAccent, 0.03)})`,
    "--split-done-border": rgba(secondaryAccent, 0.28),
    "--route-district-shibuya": rgbString(districtColors.ShibuyaCho),
    "--route-district-shibuya-glow": rgba(districtColors.ShibuyaCho, 0.3 * glow),
    "--route-district-kogane": rgbString(districtColors.Kogane),
    "--route-district-kogane-glow": rgba(districtColors.Kogane, 0.3 * glow),
    "--route-district-benten": rgbString(districtColors.Benten),
    "--route-district-benten-glow": rgba(districtColors.Benten, 0.3 * glow),
    "--popout-background": `radial-gradient(circle at 14% 12%, ${rgba(accent, 0.18 * glow)}, transparent 26%), radial-gradient(circle at 80% 84%, ${rgba(secondaryAccent, 0.08 * glow)}, transparent 32%), radial-gradient(circle at 52% 100%, ${rgba(accentSoft, 0.1 * glow)}, transparent 30%), linear-gradient(180deg, ${rgba(mixColors(background, "#ffffff", 0.03), 0.98)}, ${rgba(mixColors(background, "#000000", 0.1), 1)})`,
    "--popout-learn-frame-shadow": `inset 0 0 0 1px ${rgba(learnBase, 0.14)}, 0 0 20px ${rgba(learnBase, 0.3)}, 0 0 42px ${rgba(accent, 0.2 * glow)}`,
    "--history-row-background": rgba(text, 0.04),
    "--history-row-text": mixColors(text, background, 0.08),
    "--result-complete-background": rgba(success, 0.18),
    "--result-skip-background": rgba(accentSoft, 0.18),
    "--result-fail-background": rgba(danger, 0.18),
    "--completion-stat-background": rgba(text, 0.04),
    "--completion-stat-border": rgba(palette.border, 0.06),
    "--modal-backdrop-background": rgba(background, 0.72),
    "--danger-modal-border": rgba(danger, 0.24),
    "--danger-modal-shadow": `0 20px 46px ${rgba("#000000", 0.42)}, 0 0 36px ${rgba(danger, 0.12)}`,
    "--modal-warning-background": rgba(danger, 0.12),
    "--modal-warning-border": rgba(danger, 0.18)
  };
}

function buildBackdropTheme(backdrop) {
  const normalizedBackdrop = normalizeBackdropConfig(backdrop);

  const density = {
    particleCount: Math.round(
      BASE_PARTICLE_COUNT *
      normalizedBackdrop.density.amount
    ),
    spread: normalizedBackdrop.density.spread,
    zone: normalizedBackdrop.density.zone
  };

  return {
    colors: normalizedBackdrop.colors,
    appearance: normalizedBackdrop.appearance,
    motion: normalizedBackdrop.motion,
    density
  };
}

export function normalizeThemeId(value) {
  if (value === "jetset") {
    return "xbox";
  }

  if (value === CUSTOM_THEME_ID) {
    return CUSTOM_THEME_ID;
  }

  return typeof value === "string" && NORMALIZED_PRESET_THEMES[value]
    ? value
    : DEFAULT_THEME_ID;
}

export function normalizeCustomTheme(value) {
  if (!value || typeof value !== "object") {
    return createDefaultCustomTheme();
  }

  return {
    background: normalizeHexColor(value.background, DEFAULT_CUSTOM_THEME.background),
    surface: normalizeHexColor(value.surface, DEFAULT_CUSTOM_THEME.surface),
    text: normalizeHexColor(value.text, DEFAULT_CUSTOM_THEME.text),
    accent: normalizeHexColor(value.accent, DEFAULT_CUSTOM_THEME.accent),
    border: normalizeHexColor(value.border, DEFAULT_CUSTOM_THEME.border),
    cornerRadius: clampNumber(
      value.cornerRadius,
      CORNER_RADIUS_CAPS.min,
      CORNER_RADIUS_CAPS.max,
      DEFAULT_CUSTOM_THEME.cornerRadius
    ),
    glowIntensity: clampNumber(
      value.glowIntensity,
      GLOW_INTENSITY_CAPS.min,
      GLOW_INTENSITY_CAPS.max,
      DEFAULT_CUSTOM_THEME.glowIntensity
    ),
    backdrop: normalizeBackdropConfig(value.backdrop, value)
  };
}

export function resolveTheme(themeId, customTheme) {
  const resolvedThemeId = normalizeThemeId(themeId);
  const definition = resolvedThemeId === CUSTOM_THEME_ID
    ? createCustomThemeDefinition(customTheme)
    : NORMALIZED_PRESET_THEMES[resolvedThemeId] ?? NORMALIZED_PRESET_THEMES[DEFAULT_THEME_ID];

  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    cssVariables: buildCssVariables(definition.palette),
    backdrop: buildBackdropTheme(definition.backdrop)
  };
}
