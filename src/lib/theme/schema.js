export const DEFAULT_THEME_ID = "beatrice";
export const CUSTOM_THEME_ID = "custom";
export const BASE_PARTICLE_COUNT = 48;

export const DEFAULT_STATUS_COLORS = {
  success: "#7bd2c1",
  danger: "#ee8a8f",
  warning: "#ffd39b"
};

export const BACKDROP_DIRECTION_OPTIONS = [
  { value: "up", label: "Rise" },
  { value: "down", label: "Fall" },
  { value: "float", label: "Float" }
];

export const BACKDROP_SPAWN_ZONE_OPTIONS = [
  { value: "full", label: "Whole Scene" },
  { value: "top", label: "Upper Band" },
  { value: "middle", label: "Middle Band" },
  { value: "bottom", label: "Lower Band" }
];

export const THEME_CAPS = {
  cornerRadius: { min: 0.2, max: 3, default: 1 },
  glowIntensity: { min: 0, max: 4, default: 1 },
  backdrop: {
    appearance: {
      glow: { min: 0, max: 5, default: 1.15 },
      size: { min: 0.2, max: 2.5, default: 1.15 },
      flicker: { min: 0, max: 3, default: 1 },
      opacity: { min: 0.05, max: 1, default: 0.9 }
    },
    motion: {
      speed: { min: 0, max: 3, default: 1 },
      swayAmplitude: { min: 0, max: 3, default: 1 },
      swayFrequency: { min: 0.1, max: 3, default: 1 },
      drift: { min: 0, max: 3, default: 1 }
    },
    density: {
      amount: { min: 0.1, max: 3, default: 1.45 },
      spread: { min: 0.1, max: 1, default: 1 }
    }
  }
};

export const DEFAULT_BACKDROP = {
  colors: {
    particleColor: "#ffdf00",
    particleCore: "#fff6d6",
    hazeColorA: "#ffd26e",
    hazeColorB: "#de8476"
  },
  appearance: {
    glow: THEME_CAPS.backdrop.appearance.glow.default,
    size: THEME_CAPS.backdrop.appearance.size.default,
    flicker: THEME_CAPS.backdrop.appearance.flicker.default,
    opacity: THEME_CAPS.backdrop.appearance.opacity.default
  },
  motion: {
    direction: "up",
    speed: THEME_CAPS.backdrop.motion.speed.default,
    swayAmplitude: THEME_CAPS.backdrop.motion.swayAmplitude.default,
    swayFrequency: THEME_CAPS.backdrop.motion.swayFrequency.default,
    drift: THEME_CAPS.backdrop.motion.drift.default
  },
  density: {
    amount: THEME_CAPS.backdrop.density.amount.default,
    spread: THEME_CAPS.backdrop.density.spread.default,
    zone: "full"
  }
};

export const DEFAULT_CUSTOM_THEME = {
  background: "#081019",
  surface: "#0f131d",
  text: "#f7efe5",
  accent: "#e6b457",
  border: "#d68d7d",
  cornerRadius: THEME_CAPS.cornerRadius.default,
  glowIntensity: THEME_CAPS.glowIntensity.default,
  backdrop: DEFAULT_BACKDROP
};

const SLIDER_STEP = 0.05;

export const CORE_COLOR_FIELDS = [
  {
    key: "background",
    label: "Primary background",
    description: "The main app backdrop base color."
  },
  {
    key: "surface",
    label: "Panel background",
    description: "The surface tone used for panels and cards."
  },
  {
    key: "text",
    label: "Primary text",
    description: "Main copy and heading color."
  },
  {
    key: "accent",
    label: "Accent color",
    description: "Buttons, highlights, and active states."
  },
  {
    key: "border",
    label: "Border / secondary accent",
    description: "Panel borders and secondary accents."
  }
];

export const PARTICLE_COLOR_FIELDS = [
  {
    key: "particleColor",
    label: "Particle color",
    description: "The main color of each particle."
  },
  {
    key: "particleCore",
    label: "Core highlight",
    description: "The bright inner highlight of each particle."
  }
];

export const HAZE_COLOR_FIELDS = [
  {
    key: "hazeColorA",
    label: "Haze inner color",
    description: "Primary background haze tone."
  },
  {
    key: "hazeColorB",
    label: "Haze outer color",
    description: "Secondary background haze tone."
  }
];

const appearanceCaps = THEME_CAPS.backdrop.appearance;
const motionCaps = THEME_CAPS.backdrop.motion;
const densityCaps = THEME_CAPS.backdrop.density;

export const PARTICLE_APPEARANCE_FIELDS = [
  {
    key: "glow",
    label: "Particle glow",
    description: "Soft halo around each particle.",
    min: appearanceCaps.glow.min,
    max: appearanceCaps.glow.max,
    step: SLIDER_STEP
  },
  {
    key: "size",
    label: "Particle size",
    description: "Overall particle size.",
    min: appearanceCaps.size.min,
    max: appearanceCaps.size.max,
    step: SLIDER_STEP
  },
  {
    key: "flicker",
    label: "Flicker amount",
    description: "Uniform twinkle or pulse over time.",
    min: appearanceCaps.flicker.min,
    max: appearanceCaps.flicker.max,
    step: SLIDER_STEP
  },
  {
    key: "opacity",
    label: "Particle opacity",
    description: "Overall particle brightness and visibility.",
    min: appearanceCaps.opacity.min,
    max: appearanceCaps.opacity.max,
    step: SLIDER_STEP
  }
];

export const BACKDROP_MOTION_FIELDS = [
  {
    key: "speed",
    label: "Vertical speed",
    description: "How quickly particles rise, fall, or drift.",
    min: motionCaps.speed.min,
    max: motionCaps.speed.max,
    step: SLIDER_STEP
  },
  {
    key: "swayAmplitude",
    label: "Sway amplitude",
    description: "How far particles wobble side to side.",
    min: motionCaps.swayAmplitude.min,
    max: motionCaps.swayAmplitude.max,
    step: SLIDER_STEP
  },
  {
    key: "swayFrequency",
    label: "Sway frequency",
    description: "How quickly that side-to-side motion happens.",
    min: motionCaps.swayFrequency.min,
    max: motionCaps.swayFrequency.max,
    step: SLIDER_STEP
  },
  {
    key: "drift",
    label: "Drift randomness",
    description: "How irregular the particle paths feel.",
    min: motionCaps.drift.min,
    max: motionCaps.drift.max,
    step: SLIDER_STEP
  }
];

export const BACKDROP_DENSITY_FIELDS = [
  {
    key: "amount",
    label: "Particle density",
    description: "Approximate number of particles.",
    min: densityCaps.amount.min,
    max: densityCaps.amount.max,
    step: SLIDER_STEP
  },
  {
    key: "spread",
    label: "Spawn spread",
    description: "How wide the particle field starts.",
    min: densityCaps.spread.min,
    max: densityCaps.spread.max,
    step: SLIDER_STEP
  }
];
