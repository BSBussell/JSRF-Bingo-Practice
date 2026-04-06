import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 35;
const DPR_LIMIT = 2;

function parseHexColor(hex) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function createParticle(width, height, color) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    depth: 0.65 + Math.random() * 0.85,
    radius: 0.7 + Math.random() * 1.8,
    alpha: 0.08 + Math.random() * 0.2,
    driftX: (-0.18 + Math.random() * 0.36) * 0.3,
    driftY: 0.22 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    wobble: 3 + Math.random() * 9,
    glow: 8 + Math.random() * 22,
    color
  };
}

export function DustyBackdrop() {
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

    const color = parseHexColor("#ffdf00");
    const pointer = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.5
    };
    const parallax = { x: 0, y: 0 };
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
      particles = Array.from({ length: PARTICLE_COUNT }, () => createParticle(width, height, color));
    }

    function handlePointerMove(event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    function drawBackground() {
      const haze = context.createRadialGradient(
        width * 0.48 + parallax.x * 0.6,
        height * 0.82 + parallax.y * 0.3,
        0,
        width * 0.48,
        height * 0.82,
        width * 0.7
      );
      haze.addColorStop(0, "rgba(255, 210, 110, 0.045)");
      haze.addColorStop(0.45, "rgba(222, 132, 118, 0.035)");
      haze.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = haze;
      context.fillRect(0, 0, width, height);
    }

    function drawParticle(particle, timeSeconds) {
      const wobbleX = Math.sin(timeSeconds * 0.55 + particle.phase) * particle.wobble;
      const wobbleY = Math.cos(timeSeconds * 0.35 + particle.phase) * (particle.wobble * 0.22);
      const x = particle.x + wobbleX + parallax.x * particle.depth;
      const y = particle.y + wobbleY + parallax.y * particle.depth;
      const glowRadius = particle.glow * particle.depth;

      const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.alpha})`);
      glow.addColorStop(0.45, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.alpha * 0.42})`);
      glow.addColorStop(1, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0)`);

      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, glowRadius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = `rgba(255, 246, 214, ${Math.min(0.35, particle.alpha + 0.08)})`;
      context.beginPath();
      context.arc(x, y, particle.radius * particle.depth, 0, Math.PI * 2);
      context.fill();
    }

    function step(now) {
      const delta = Math.min((now - lastTime) / 16.6667, 2.5);
      lastTime = now;
      const timeSeconds = now * 0.001;

      parallax.x += (((pointer.x / width) - 0.5) * 18 - parallax.x) * 0.03;
      parallax.y += (((pointer.y / height) - 0.5) * 14 - parallax.y) * 0.03;

      context.clearRect(0, 0, width, height);
      drawBackground();

      for (const particle of particles) {
        particle.x += particle.driftX * delta;
        particle.y -= particle.driftY * particle.depth * delta;

        if (particle.y < -particle.glow * 1.4) {
          particle.y = height + particle.glow;
          particle.x = Math.random() * width;
        }

        if (particle.x < -particle.glow) {
          particle.x = width + particle.glow;
        } else if (particle.x > width + particle.glow) {
          particle.x = -particle.glow;
        }

        drawParticle(particle, timeSeconds);
      }

      animationFrame = window.requestAnimationFrame(step);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    animationFrame = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className="background-canvas-layer" aria-hidden="true">
      <canvas ref={canvasRef} className="background-canvas" />
    </div>
  );
}
