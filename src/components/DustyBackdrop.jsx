import { useEffect, useRef } from "react";

const DPR_LIMIT = 2;
const MOTION_EPSILON = 0.0001;

function resolveNumber(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function parseHexColor(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgba(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function smoothstep(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

function getSpawnBand(height, zone) {
  switch (zone) {
    case "top":
      return { start: 0, end: height * 0.28 };
    case "middle":
      return { start: height * 0.28, end: height * 0.72 };
    case "bottom":
      return { start: height * 0.72, end: height };
    default:
      return { start: 0, end: height };
  }
}

function createSpawnX(width, spread) {
  const normalizedSpread = resolveNumber(spread, 1);
  const span = width * normalizedSpread;
  const margin = (width - span) * 0.5;

  return margin + Math.random() * span;
}

function createSpawnY(height, zone) {
  const band = getSpawnBand(height, zone);
  return band.start + Math.random() * (band.end - band.start);
}

function createRespawnY(height, zone, direction) {
  const band = getSpawnBand(height, zone);
  const padding = Math.max(20, height * 0.08);

  if (direction === "up") {
    return band.end + Math.random() * padding;
  }

  if (direction === "down") {
    return band.start - Math.random() * padding;
  }

  return band.start + Math.random() * (band.end - band.start);
}

function createParticle(width, height, appearance, motion, density, now, entry = "initial") {
  const depth = 0.65 + Math.random() * 0.85;
  const sizeVariance = 0.72 + Math.random() * 0.55;
  const direction = motion.direction;
  const verticalSpeed = 0.08 + motion.speed * 0.34;
  const hasVerticalMotion = motion.speed > MOTION_EPSILON;
  const hasDriftMotion = motion.drift > MOTION_EPSILON;
  const fadeInDurationMs = 900 + Math.random() * 1500;
  const initialAgeMs = entry === "initial"
    ? fadeInDurationMs * (0.2 + Math.random() * 0.8)
    : 0;
  let velocityY = 0;

  if (!hasVerticalMotion) {
    velocityY = 0;
  } else if (direction === "up") {
    velocityY = -(verticalSpeed * (0.75 + Math.random() * 0.9) * (0.65 + depth * 0.35));
  } else if (direction === "down") {
    velocityY = verticalSpeed * (0.75 + Math.random() * 0.9) * (0.65 + depth * 0.35);
  } else {
    const floatLift = 0.04 + motion.speed * 0.18;
    const floatWander = 0.12 + motion.speed * 0.22;
    velocityY =
      (-floatWander + Math.random() * floatWander * 2 - floatLift * 0.35) *
      Math.max(0.45, 0.55 + motion.speed * 0.45) *
      (0.65 + depth * 0.35);
  }

  const driftBase = hasDriftMotion ? 0.2 + motion.drift * 0.28 : 0;
  const swayAmplitude = motion.swayAmplitude * (3 + Math.random() * 11) * (0.55 + depth * 0.45);
  const swayFrequency = (0.4 + Math.random() * 0.95) * motion.swayFrequency;

  return {
    x: createSpawnX(width, density.spread),
    y: entry === "respawn"
      ? createRespawnY(height, density.zone, direction)
      : createSpawnY(height, density.zone),
    depth,
    radius: (1 + Math.random() * 1.95) * appearance.size * sizeVariance,
    alpha: (0.07 + Math.random() * 0.18) * appearance.opacity * (0.72 + depth * 0.24),
    glow: (11 + Math.random() * 24) * appearance.glow * appearance.size * sizeVariance,
    velocityX: (-0.08 + Math.random() * 0.16) * driftBase * (0.6 + depth * 0.4),
    velocityY,
    noiseX: (0.02 + Math.random() * 0.11) * motion.drift * (0.55 + depth * 0.45),
    noiseY:
      (0.01 + Math.random() * (direction === "float" ? 0.14 : 0.06)) *
      motion.drift *
      (direction === "float" ? 1.45 : 0.45),
    noiseFrequency: 0.35 + Math.random() * 0.85,
    swayAmplitude,
    swayFrequency,
    phase: Math.random() * Math.PI * 2,
    flare: 0.75 + Math.random() * 0.55,
    flickerOffset: Math.random() * Math.PI * 2,
    flickerSpeed: 0.45 + Math.random() * (1 + appearance.flicker * 0.85),
    spawnedAt: now - initialAgeMs,
    fadeInDurationMs
  };
}

function getHazeAnchor(width, height, zone, direction) {
  let y = height * 0.6;

  if (zone === "top") {
    y = height * 0.22;
  } else if (zone === "middle") {
    y = height * 0.5;
  } else if (zone === "bottom") {
    y = height * 0.82;
  } else if (direction === "up") {
    y = height * 0.8;
  } else if (direction === "down") {
    y = height * 0.24;
  }

  return {
    x: width * 0.5,
    y
  };
}

function shouldRespawnParticle(particle, width, height) {
  const margin = particle.glow + 28;

  return (
    particle.x < -margin ||
    particle.x > width + margin ||
    particle.y < -margin ||
    particle.y > height + margin
  );
}

export function DustyBackdrop({ backdrop }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    const colors = {
      particleColor: parseHexColor(backdrop.colors.particleColor),
      particleCore: parseHexColor(backdrop.colors.particleCore),
      hazeColorA: parseHexColor(backdrop.colors.hazeColorA),
      hazeColorB: parseHexColor(backdrop.colors.hazeColorB)
    };
    const appearance = {
      glow: resolveNumber(backdrop.appearance.glow, 1),
      size: resolveNumber(backdrop.appearance.size, 1),
      flicker: resolveNumber(backdrop.appearance.flicker, 1),
      opacity: resolveNumber(backdrop.appearance.opacity, 1)
    };
    const motion = {
      direction: backdrop.motion.direction,
      speed: resolveNumber(backdrop.motion.speed, 1),
      swayAmplitude: resolveNumber(backdrop.motion.swayAmplitude, 1),
      swayFrequency: resolveNumber(backdrop.motion.swayFrequency, 1),
      drift: resolveNumber(backdrop.motion.drift, 1)
    };
    const density = {
      particleCount: resolveNumber(backdrop.density.particleCount, 48),
      spread: resolveNumber(backdrop.density.spread, 1),
      zone: backdrop.density.zone
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    let particles = [];
    let lastTime = performance.now();

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: density.particleCount }, () =>
        createParticle(width, height, appearance, motion, density, performance.now())
      );
      lastTime = performance.now();
    }

    function drawBackground() {
      const anchor = getHazeAnchor(width, height, density.zone, motion.direction);
      const haze = context.createRadialGradient(
        anchor.x,
        anchor.y,
        0,
        anchor.x,
        anchor.y,
        width * 0.72
      );
      const glowWeight = 0.7 + appearance.glow * 0.3;
      haze.addColorStop(0, rgba(colors.hazeColorA, 0.15 * glowWeight));
      haze.addColorStop(0.45, rgba(colors.hazeColorB, 0.12 * glowWeight));
      haze.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = haze;
      context.fillRect(0, 0, width, height);
    }

    function drawParticle(particle, timeSeconds, now) {
      const fadeProgress = smoothstep(
        (now - particle.spawnedAt) / particle.fadeInDurationMs
      );
      
      // Create layered flicker for firefly-like effects
      const smoothFlicker =
        Math.sin(timeSeconds * particle.flickerSpeed + particle.flickerOffset) * 0.7 +
        Math.sin(timeSeconds * (particle.flickerSpeed * 1.9) + particle.flickerOffset * 0.73) * 0.3;
      
      // Add blink component for more dramatic on/off transitions
      const blinkWave = Math.sin(timeSeconds * particle.flickerSpeed * 0.55 + particle.flickerOffset * 1.4);
      const blink = blinkWave > 0.15 ? Math.pow(Math.max(0, blinkWave), 1.2) : 0;
      const flickerWave = smoothFlicker * 0.65 + blink * 0.85;
      
      const scale = Math.max(0.58, 1 + flickerWave * 0.22 * appearance.flicker * particle.flare);
      const x = particle.x + Math.sin(timeSeconds * particle.swayFrequency + particle.phase) * particle.swayAmplitude;
      const y = particle.y;
      const glowRadius = particle.glow * particle.depth * Math.max(0.45, scale);
      const glowAlpha = Math.min(
        0.5,
        particle.alpha *
          fadeProgress *
          (0.72 + appearance.glow * 0.16) *
          (0.8 + Math.max(0, flickerWave) * 0.35 * (1 + appearance.flicker * 0.24))
      );
      const coreRadius = particle.radius * particle.depth * scale;
      const coreAlpha = Math.min(
        0.78,
        particle.alpha * fadeProgress * (0.85 + Math.max(0, flickerWave) * 0.38 * (1 + appearance.flicker * 0.28))
      );

      if (glowRadius > 0.5 && glowAlpha > 0.003) {
        const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius);
        glow.addColorStop(0, rgba(colors.particleColor, glowAlpha));
        glow.addColorStop(0.24, rgba(colors.particleColor, glowAlpha * 0.82));
        glow.addColorStop(0.56, rgba(colors.particleColor, glowAlpha * 0.26));
        glow.addColorStop(0.86, rgba(colors.particleColor, glowAlpha * 0.05));
        glow.addColorStop(1, rgba(colors.particleColor, 0));

        context.globalCompositeOperation = "screen";
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, glowRadius, 0, Math.PI * 2);
        context.fill();
      }

      context.globalCompositeOperation = "source-over";
      context.fillStyle = rgba(colors.particleCore, coreAlpha);
      context.beginPath();
      context.arc(x, y, coreRadius, 0, Math.PI * 2);
      context.fill();
    }

    function step(now) {
      const delta = Math.min((now - lastTime) / 16.6667, 2.5);
      const timeSeconds = now * 0.001;
      lastTime = now;

      context.clearRect(0, 0, width, height);
      drawBackground();

      particles = particles.map((particle) => {
        const noiseTime = timeSeconds * particle.noiseFrequency + particle.phase;
        const nextParticle = {
          ...particle,
          x: particle.x + (particle.velocityX + Math.sin(noiseTime) * particle.noiseX) * delta,
          y: particle.y + (particle.velocityY + Math.cos(noiseTime * 0.85) * particle.noiseY) * delta
        };

        if (shouldRespawnParticle(nextParticle, width, height)) {
          return createParticle(width, height, appearance, motion, density, now, "respawn");
        }

        drawParticle(nextParticle, timeSeconds, now);
        return nextParticle;
      });

      animationFrame = window.requestAnimationFrame(step);
    }

    resize();
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    backdrop.appearance.flicker,
    backdrop.appearance.glow,
    backdrop.appearance.opacity,
    backdrop.appearance.size,
    backdrop.colors.hazeColorA,
    backdrop.colors.hazeColorB,
    backdrop.colors.particleColor,
    backdrop.colors.particleCore,
    backdrop.density.particleCount,
    backdrop.density.spread,
    backdrop.density.zone,
    backdrop.motion.direction,
    backdrop.motion.drift,
    backdrop.motion.speed,
    backdrop.motion.swayAmplitude,
    backdrop.motion.swayFrequency
  ]);

  return (
    <div className="background-canvas-layer" aria-hidden="true">
      <canvas ref={canvasRef} className="background-canvas" />
    </div>
  );
}
