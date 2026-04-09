export const PRESET_THEME_DEFINITIONS = [
  {
    id: "beatrice",
    label: "Beatrice's Theme",
    description: "bee theme bee theme bee theme",
    palette: {
      background: "#050b13",
      backgroundMid: "#0d1520",
      backgroundEnd: "#1b1823",
      surface: "#0f131d",
      text: "#f7efe5",
      textSecondary: "#e6ddd0",
      textMuted: "#d2c0ae",
      accent: "#e0a63a",
      accentStrong: "#ffd27a",
      accentSoft: "#df8a5b",
      secondaryAccent: "#74ddd0",
      border: "#c9785f",
      cornerRadius: 0.4,
      success: "#7bd2c1",
      danger: "#ee8a8f",
      warning: "#ffd39b",
      glowIntensity: 1.14
    },
    backdrop: {
      colors: {
        particleColor: "#ffdf00",
        particleCore: "#fff6d6",
        hazeColorA: "#ffcb68",
        hazeColorB: "#dc7f63"
      },
      appearance: {
        glow: 1.2,
        size: 1.25,
        flicker: 3.05,
        opacity: 0.9
      },
      motion: {
        direction: "float",
        speed: 1.35,
        swayAmplitude: 1.65,
        swayFrequency: 1.15,
        drift: 1.35
      },
      density: {
        amount: 0.88,
        spread: 0.88,
        zone: "middle"
      }
    }
  },
  {
    id: "xbox",
    label: "Xbox",
    description: "Xbox-inspired theme!",
    palette: {
      background: "#050705",
      backgroundMid: "#0a110a",
      backgroundEnd: "#121b12",
      surface: "#0c140d",
      text: "#edf8e6",
      textSecondary: "#d3e5cc",
      textMuted: "#9fbf95",
      accent: "#7cff2f",
      accentStrong: "#baff8f",
      accentSoft: "#3e8f2d",
      secondaryAccent: "#8dff5e",
      border: "#5ec934",
      cornerRadius: 1,
      success: "#82ffa8",
      danger: "#ff8f72",
      warning: "#d8ff9a",
      glowIntensity: 1.28
    },
    backdrop: {
      colors: {
        particleColor: "#7fff39",
        particleCore: "#ebff9a",
        hazeColorA: "#7cff2f",
        hazeColorB: "#2f6b24"
      },
      appearance: {
        glow: 0.62,
        size: 1.32,
        flicker: 2.1,
        opacity: 0.82
      },
      motion: {
        direction: "up",
        speed: 152.35,
        swayAmplitude: 5.48,
        swayFrequency: 2.7,
        drift: 5.15
      },
      density: {
        amount: 1.55,
        spread: 1,
        zone: "full"
      }
    }
  },
  {
    id: "humanRights",
    label: "Human Rights",
    description: "Very important theme.",
    palette: {
      background: "#08111d",
      backgroundMid: "#11182b",
      backgroundEnd: "#171932",
      surface: "#10182a",
      text: "#f8f4ff",
      textSecondary: "#e9e3f8",
      textMuted: "#cabed9",
      accent: "#ff63b3",
      accentStrong: "#ffaddd",
      accentSoft: "#7de7ff",
      secondaryAccent: "#7de7ff",
      border: "#7de7ff",
      cornerRadius: 1,
      success: "#89f3dc",
      danger: "#ff8aa5",
      warning: "#ffd7f2",
      glowIntensity: 1.18
    },
    backdrop: {
      colors: {
        particleColor: "#ff87c8",
        particleCore: "#fff0fb",
        hazeColorA: "#7de7ff",
        hazeColorB: "#ff63b3"
      },
      appearance: {
        glow: 1.24,
        size: 1.48,
        flicker: 1.15,
        opacity: 0.94
      },
      motion: {
        direction: "float",
        speed: 0.65,
        swayAmplitude: 1.55,
        swayFrequency: 0.7,
        drift: 1.15
      },
      density: {
        amount: 1.22,
        spread: 1,
        zone: "full"
      }
    }
  },
  {
    id: "milkyWay",
    label: "Milky Way",
    description: "I wanted to make a stars one.",
    palette: {
      background: "#030711",
      backgroundMid: "#08111e",
      backgroundEnd: "#111a2e",
      surface: "#0a1220",
      text: "#f4f7ff",
      textSecondary: "#d9e3fb",
      textMuted: "#9eb3dc",
      accent: "#9ec8ff",
      accentStrong: "#dcecff",
      accentSoft: "#6853c8",
      secondaryAccent: "#8ee6ff",
      border: "#5f7fcf",
      cornerRadius: 1,
      success: "#98f0e2",
      danger: "#ff92af",
      warning: "#f3e4ff",
      glowIntensity: 1.92
    },
    backdrop: {
      colors: {
        particleColor: "#b9d6ff",
        particleCore: "#ffffff",
        hazeColorA: "#4f6dbe",
        hazeColorB: "#1d295f"
      },
      appearance: {
        glow: 1.4,
        size: 1.12,
        flicker: 1.35,
        opacity: 0.58
      },
      motion: {
        direction: "float",
        speed: 0,
        swayAmplitude: 0,
        swayFrequency: 0,
        drift: 0
      },
      density: {
        amount: 1.25,
        spread: 1,
        zone: "full"
      }
    }
  }
];

export const PRESET_THEME_ORDER = PRESET_THEME_DEFINITIONS.map((theme) => theme.id);

export const PRESET_THEMES = Object.fromEntries(
  PRESET_THEME_DEFINITIONS.map((theme) => [theme.id, theme])
);
