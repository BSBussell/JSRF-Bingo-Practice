import { useEffect, useRef } from "react";

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function resolveNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(progress) {
  const clamped = clamp(progress, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function normalizeHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function hexChannel(value) {
  return Number.parseInt(value, 16);
}

function parseHexColor(value) {
  const normalized = value.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized
      .split("")
      .map((character) => `${character}${character}`)
      .join("")
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    r: hexChannel(expanded.slice(0, 2)),
    g: hexChannel(expanded.slice(2, 4)),
    b: hexChannel(expanded.slice(4, 6))
  };
}

function parseRgbColor(value) {
  const match = value.trim().match(/^rgba?\((.+)\)$/i);

  if (!match) {
    return null;
  }

  const channels = match[1]
    .split(/[\s,\/]+/)
    .map((channel) => Number.parseFloat(channel))
    .filter(Number.isFinite);

  if (channels.length < 3) {
    return null;
  }

  return {
    r: clamp(channels[0], 0, 255),
    g: clamp(channels[1], 0, 255),
    b: clamp(channels[2], 0, 255)
  };
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return {
      h: 0,
      s: 0,
      l: lightness * 100
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
    h: normalizeHue(hue),
    s: saturation * 100,
    l: lightness * 100
  };
}

function parseCssColorToHsl(value) {
  const rgb = parseHexColor(value) ?? parseRgbColor(value);
  return rgb ? rgbToHsl(rgb) : null;
}

function rgba(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;
}

function hslToRgb({ h, s, l }) {
  const hue = normalizeHue(h) / 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;

  if (saturation === 0) {
    const channel = lightness * 255;
    return {
      r: channel,
      g: channel,
      b: channel
    };
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  function hueToChannel(t) {
    let value = t;
    if (value < 0) {
      value += 1;
    }
    if (value > 1) {
      value -= 1;
    }
    if (value < 1 / 6) {
      return p + (q - p) * 6 * value;
    }
    if (value < 1 / 2) {
      return q;
    }
    if (value < 2 / 3) {
      return p + (q - p) * (2 / 3 - value) * 6;
    }
    return p;
  }

  return {
    r: hueToChannel(hue + 1 / 3) * 255,
    g: hueToChannel(hue) * 255,
    b: hueToChannel(hue - 1 / 3) * 255
  };
}

function resolveCssHsl(style, propertyName, fallback) {
  return parseCssColorToHsl(style.getPropertyValue(propertyName)) ?? fallback;
}

function resolveBackdropSettings(backdrop) {
  return {
    colors: {
      particleColor: parseHexColor(backdrop?.colors?.particleColor ?? "") ?? null,
      particleCore: parseHexColor(backdrop?.colors?.particleCore ?? "") ?? null
    },
    appearance: {
      glow: resolveNumber(backdrop?.appearance?.glow, 1.15),
      size: resolveNumber(backdrop?.appearance?.size, 1.15),
      flicker: resolveNumber(backdrop?.appearance?.flicker, 1),
      opacity: resolveNumber(backdrop?.appearance?.opacity, 0.9)
    },
    motion: {
      direction: backdrop?.motion?.direction ?? "up",
      speed: resolveNumber(backdrop?.motion?.speed, 1),
      swayAmplitude: resolveNumber(backdrop?.motion?.swayAmplitude, 1),
      swayFrequency: resolveNumber(backdrop?.motion?.swayFrequency, 1),
      drift: resolveNumber(backdrop?.motion?.drift, 1)
    }
  };
}

function resolveParticlePalette(element, backdropSettings) {
  const style = getComputedStyle(element);
  const fallbackAccent = { h: 42, s: 76, l: 62 };
  const backdropColor = backdropSettings.colors.particleColor;
  const backdropCore = backdropSettings.colors.particleCore;

  if (backdropColor && backdropCore) {
    return [
      {
        weight: 0.78,
        color: rgbToHsl(backdropColor),
        particleColor: backdropColor,
        coreColor: backdropCore
      },
      {
        weight: 0.22,
        color: resolveCssHsl(style, "--accent-strong", rgbToHsl(backdropCore)),
        particleColor: backdropCore,
        coreColor: backdropCore
      }
    ];
  }

  return [
    {
      weight: 0.58,
      color: resolveCssHsl(style, "--accent", fallbackAccent),
      particleColor: hslToRgb(resolveCssHsl(style, "--accent", fallbackAccent)),
      coreColor: hslToRgb(resolveCssHsl(style, "--accent-strong", { h: fallbackAccent.h, s: 100, l: 78 }))
    },
    {
      weight: 0.27,
      color: resolveCssHsl(style, "--accent-strong", { h: fallbackAccent.h, s: 100, l: 78 }),
      particleColor: hslToRgb(resolveCssHsl(style, "--accent-strong", { h: fallbackAccent.h, s: 100, l: 78 })),
      coreColor: hslToRgb(resolveCssHsl(style, "--text-primary", { h: fallbackAccent.h, s: 45, l: 92 }))
    },
    {
      weight: 0.15,
      color: resolveCssHsl(style, "--accent-soft", { h: fallbackAccent.h + 18, s: 56, l: 64 }),
      particleColor: hslToRgb(resolveCssHsl(style, "--accent-soft", { h: fallbackAccent.h + 18, s: 56, l: 64 })),
      coreColor: hslToRgb(resolveCssHsl(style, "--accent-strong", { h: fallbackAccent.h, s: 100, l: 78 }))
    }
  ];
}

function pickPaletteColor(palette) {
  const roll = Math.random();
  let cursor = 0;

  for (const entry of palette) {
    cursor += entry.weight;

    if (roll <= cursor) {
      return entry;
    }
  }

  return palette[0];
}

function createParticle({
  originX,
  originY,
  radius,
  index,
  count,
  palette,
  backdropSettings,
  delayMs = 0,
  speedScale = 1,
  gravityScale = 1
}) {
  const evenAngle = (Math.PI * 2 * index) / count;
  const angle = evenAngle + randomBetween(-0.22, 0.22);
  const speed = randomBetween(radius * 0.014, radius * 0.062) * speedScale;
  const themeColor = pickPaletteColor(palette);
  const appearance = backdropSettings.appearance;
  const motion = backdropSettings.motion;
  const colorHsl = {
    h: normalizeHue(themeColor.color.h + randomBetween(-6, 6)),
    s: clamp(themeColor.color.s + randomBetween(-8, 10), 46, 100),
    l: clamp(themeColor.color.l + randomBetween(4, 18), 48, 86)
  };
  const particleColor = themeColor.particleColor ?? hslToRgb(colorHsl);
  const coreColor = themeColor.coreColor ?? hslToRgb({
    h: colorHsl.h,
    s: Math.max(20, colorHsl.s * 0.42),
    l: Math.min(96, colorHsl.l + 18)
  });
  const depth = 0.72 + Math.random() * 0.62;
  const sizeVariance = 0.72 + Math.random() * 0.62;
  const verticalSpeed = 0.02 + motion.speed * 0.08;
  const verticalLift = motion.direction === "down"
    ? verticalSpeed
    : motion.direction === "float"
      ? -verticalSpeed * 0.18
      : -verticalSpeed;
  const driftBase = 0.025 + motion.drift * 0.075;

  return {
    x: originX,
    y: originY,
    angle,
    speed,
    friction: randomBetween(0.91, 0.955),
    gravity: randomBetween(radius * 0.0007, radius * 0.0021) * gravityScale,
    velocityX: randomBetween(-driftBase, driftBase) * depth,
    velocityY: verticalLift * depth,
    noiseX: (0.018 + Math.random() * 0.075) * motion.drift * depth,
    noiseY: (0.008 + Math.random() * 0.052) * motion.drift * depth,
    noiseFrequency: 0.35 + Math.random() * 0.85,
    swayAmplitude: motion.swayAmplitude * (1.5 + Math.random() * 6.5) * depth,
    swayFrequency: (0.42 + Math.random() * 0.9) * motion.swayFrequency,
    phase: Math.random() * Math.PI * 2,
    flare: 0.75 + Math.random() * 0.55,
    flickerOffset: Math.random() * Math.PI * 2,
    flickerSpeed: 0.45 + Math.random() * (1 + appearance.flicker * 0.85),
    spawnedAt: null,
    fadeInDurationMs: 70 + Math.random() * 120,
    delayMs,
    depth,
    radius: (0.55 + Math.random() * 1.18) * appearance.size * sizeVariance,
    glow: (5 + Math.random() * 13) * appearance.glow * appearance.size * sizeVariance,
    particleColor,
    coreColor,
    alpha: 1,
    baseAlpha: (0.18 + Math.random() * 0.18) * appearance.opacity,
    decay: randomBetween(0.017, 0.032)
  };
}

function createBurstParticles({
  width,
  height,
  originBounds = null,
  palette,
  backdropSettings,
  particleCount,
  x = 0.5,
  y = 0.5,
  delayMs = 0,
  radiusScale = 1,
  speedScale = 1,
  gravityScale = 1
}) {
  const bounds = originBounds ?? {
    left: 0,
    top: 0,
    width,
    height
  };
  const originX = bounds.left + bounds.width * x;
  const originY = bounds.top + bounds.height * y;
  const radius = Math.min(bounds.width, bounds.height) * radiusScale;

  return Array.from({ length: particleCount }, (_, index) =>
    createParticle({
      originX,
      originY,
      radius,
      index,
      count: particleCount,
      palette,
      backdropSettings,
      delayMs,
      speedScale,
      gravityScale
    })
  );
}

function drawParticle(context, particle, timeSeconds, now, backdropSettings) {
  const fadeProgress = smoothstep((now - particle.spawnedAt) / particle.fadeInDurationMs);
  const flickerAmount = backdropSettings.appearance.flicker;
  const smoothFlicker =
    Math.sin(timeSeconds * particle.flickerSpeed + particle.flickerOffset) * 0.7 +
    Math.sin(timeSeconds * (particle.flickerSpeed * 1.9) + particle.flickerOffset * 0.73) * 0.3;
  const blinkWave = Math.sin(timeSeconds * particle.flickerSpeed * 0.55 + particle.flickerOffset * 1.4);
  const blink = blinkWave > 0.15 ? Math.pow(Math.max(0, blinkWave), 1.2) : 0;
  const flickerWave = smoothFlicker * 0.65 + blink * 0.85;
  const scale = Math.max(0.52, 1 + flickerWave * 0.22 * flickerAmount * particle.flare);
  const x = particle.x + Math.sin(timeSeconds * particle.swayFrequency + particle.phase) * particle.swayAmplitude;
  const y = particle.y;
  const visibleAlpha = particle.alpha * fadeProgress;
  const glowRadius = particle.glow * particle.depth * Math.max(0.45, scale);
  const glowAlpha = Math.min(
    0.26,
    particle.baseAlpha *
      visibleAlpha *
      (0.68 + backdropSettings.appearance.glow * 0.15) *
      (0.75 + Math.max(0, flickerWave) * 0.42 * (1 + flickerAmount * 0.24))
  );
  const coreRadius = particle.radius * particle.depth * scale;
  const coreAlpha = Math.min(
    0.48,
    particle.baseAlpha *
      visibleAlpha *
      (0.95 + Math.max(0, flickerWave) * 0.42 * (1 + flickerAmount * 0.28))
  );
  if (glowRadius > 0.5 && glowAlpha > 0.003) {
    const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, rgba(particle.particleColor, glowAlpha));
    glow.addColorStop(0.24, rgba(particle.particleColor, glowAlpha * 0.82));
    glow.addColorStop(0.56, rgba(particle.particleColor, glowAlpha * 0.26));
    glow.addColorStop(0.86, rgba(particle.particleColor, glowAlpha * 0.05));
    glow.addColorStop(1, rgba(particle.particleColor, 0));

    context.globalCompositeOperation = "screen";
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, glowRadius, 0, Math.PI * 2);
    context.fill();
  }

  if (coreAlpha > 0.01) {
    context.globalCompositeOperation = "source-over";
    context.fillStyle = rgba(particle.coreColor, coreAlpha);
    context.beginPath();
    context.arc(x, y, coreRadius, 0, Math.PI * 2);
    context.fill();
  }
}

function updateParticle(particle, timeSeconds, delta) {
  particle.speed *= particle.friction ** delta;
  const noiseTime = timeSeconds * particle.noiseFrequency + particle.phase;
  particle.x += (
    Math.cos(particle.angle) * particle.speed +
    particle.velocityX +
    Math.sin(noiseTime) * particle.noiseX
  ) * delta;
  particle.y += (
    Math.sin(particle.angle) * particle.speed +
    particle.velocityY +
    Math.cos(noiseTime * 0.85) * particle.noiseY +
    particle.gravity
  ) * delta;
  particle.alpha -= particle.decay * delta;

  return particle.alpha > particle.decay;
}

export function FireworkBurst({
  className = "",
  particleCount = 32,
  bursts = null,
  backdrop = null,
  originTarget = "canvas",
  speedScale = 1,
  gravityScale = 1
}) {
  const canvasRef = useRef(null);
  const configRef = useRef({
    backdrop,
    bursts,
    gravityScale,
    originTarget,
    particleCount,
    speedScale
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    let animationFrame = 0;
    let disposed = false;
    let particles = [];
    let lastTime = performance.now();

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width || 128);
      const height = Math.max(1, bounds.height || 128);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      return { width, height };
    }

    function resolveOriginBounds() {
      if (configRef.current.originTarget !== "parent" || !canvas.parentElement) {
        return null;
      }

      const canvasBounds = canvas.getBoundingClientRect();
      const parentBounds = canvas.parentElement.getBoundingClientRect();

      return {
        left: parentBounds.left - canvasBounds.left,
        top: parentBounds.top - canvasBounds.top,
        width: parentBounds.width,
        height: parentBounds.height
      };
    }

    const { width, height } = resizeCanvas();
    const originBounds = resolveOriginBounds();
    const config = configRef.current;
    const backdropSettings = resolveBackdropSettings(config.backdrop);
    const palette = resolveParticlePalette(canvas, backdropSettings);
    const burstSpecs = Array.isArray(config.bursts) && config.bursts.length > 0
      ? config.bursts
      : [{
          particleCount: config.particleCount,
          speedScale: config.speedScale,
          gravityScale: config.gravityScale
        }];

    function createParticles(delayOffsetMs = 0) {
      return burstSpecs.flatMap((burst) =>
        createBurstParticles({
          width,
          height,
          originBounds,
          palette,
          backdropSettings,
          particleCount: burst.particleCount ?? config.particleCount,
          x: burst.x,
          y: burst.y,
          delayMs: delayOffsetMs + (burst.delayMs ?? 0),
          radiusScale: burst.radiusScale,
          speedScale: burst.speedScale ?? config.speedScale,
          gravityScale: burst.gravityScale ?? config.gravityScale
        })
      );
    }

    particles = createParticles();

    let startedAt = 0;
    function frame(timestamp) {
      if (disposed) {
        return;
      }

      if (!startedAt) {
        startedAt = timestamp;
      }

      const elapsedMs = timestamp - startedAt;
      const delta = Math.min((timestamp - lastTime) / 16.6667, 2.5);
      const timeSeconds = timestamp * 0.001;
      lastTime = timestamp;

      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "rgba(0, 0, 0, 0.32)";
      context.fillRect(0, 0, width, height);

      particles = particles.filter((particle) => {
        if (elapsedMs < particle.delayMs) {
          return true;
        }

        if (particle.spawnedAt === null) {
          particle.spawnedAt = timestamp;
        }

        drawParticle(context, particle, timeSeconds, timestamp, backdropSettings);
        return updateParticle(particle, timeSeconds, delta);
      });

      if (particles.length > 0) {
        animationFrame = window.requestAnimationFrame(frame);
      } else {
        context.clearRect(0, 0, width, height);
      }
    }

    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`firework-burst-canvas ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
