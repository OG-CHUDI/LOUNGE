import { useEffect, useRef } from "react";
import { useBackgroundSuppressed } from "@/lib/background";

/**
 * Subtle drifting-particle field that sits behind all app content.
 *
 * Design notes:
 *  - 2D canvas only, no dependencies, no external assets.
 *  - Colours are sampled from the live theme tokens (--primary / --foreground)
 *    so each lounge's accent flows through automatically.
 *  - Pauses on prefers-reduced-motion, when the tab is hidden, and while a
 *    live match round suppresses it (battery + focus).
 *  - Particles wrap around the edges, so the field is stable and never empties.
 */

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  targetAlpha: number;
  ring: boolean;
  accent: boolean;
}

// HSL triplet ("192 67% 14%") + alpha → a CSS colour string.
function hsla(triplet: string, alpha: number): string {
  return `hsl(${triplet.trim()} / ${alpha})`;
}

function readToken(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const suppressed = useBackgroundSuppressed();
  const suppressedRef = useRef(suppressed);
  suppressedRef.current = suppressed;
  // Lets suppression changes re-evaluate the loop without re-creating it.
  const evaluateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let raf = 0;
    let running = false;

    // Theme colours, refreshed when the lounge/theme class changes.
    let accentColour = "180 70% 45%";
    let textColour = "0 0% 93%";
    const refreshColours = () => {
      accentColour = readToken("--primary", accentColour);
      textColour = readToken("--foreground", textColour);
    };

    const targetCount = () => {
      // Roughly one particle per ~14k px², capped for small/large screens.
      const byArea = Math.round((width * height) / 14000);
      return Math.max(24, Math.min(90, byArea));
    };

    const makeParticle = (fadeIn: boolean): Particle => {
      const accent = Math.random() < 0.28;
      const ring = Math.random() < 0.35;
      const targetAlpha = accent
        ? 0.12 + Math.random() * 0.12
        : 0.05 + Math.random() * 0.08;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: ring ? 4 + Math.random() * 9 : 1 + Math.random() * 2.5,
        vx: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.25),
        vy: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.25),
        alpha: fadeIn ? 0 : targetAlpha,
        targetAlpha,
        ring,
        accent,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const want = targetCount();
      if (particles.length === 0) {
        particles = Array.from({ length: want }, () => makeParticle(false));
      } else if (want > particles.length) {
        particles.push(
          ...Array.from({ length: want - particles.length }, () =>
            makeParticle(true),
          ),
        );
      } else {
        particles.length = want;
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        const colour = hsla(p.accent ? accentColour : textColour, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        if (p.ring) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = colour;
          ctx.stroke();
        } else {
          ctx.fillStyle = colour;
          ctx.fill();
        }
      }
    };

    const step = () => {
      const m = 12; // wrap margin
      for (const p of particles) {
        if (p.alpha < p.targetAlpha) p.alpha = Math.min(p.targetAlpha, p.alpha + 0.004);
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -m) p.x = width + m;
        else if (p.x > width + m) p.x = -m;
        if (p.y < -m) p.y = height + m;
        else if (p.y > height + m) p.y = -m;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const evaluate = () => {
      const shouldRun =
        !reduceMotion && !document.hidden && !suppressedRef.current;
      if (shouldRun) start();
      else {
        stop();
        if (reduceMotion) draw(); // one static frame
      }
    };

    refreshColours();
    resize();
    evaluate();

    const onResize = () => {
      resize();
      if (!running) draw();
    };
    const onVisibility = () => evaluate();
    const themeObserver = new MutationObserver(() => {
      refreshColours();
      if (!running) draw();
    });

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Re-evaluate when suppression changes (handled via the effect dep below).
    evaluateRef.current = evaluate;

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
      evaluateRef.current = null;
    };
  }, []);

  // Bridge suppression changes into the animation loop without re-creating it.
  useEffect(() => {
    evaluateRef.current?.();
  }, [suppressed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 -z-10 h-full w-full pointer-events-none transition-opacity duration-700 ${
        suppressed ? "opacity-0" : "opacity-100"
      }`}
    />
  );
}
