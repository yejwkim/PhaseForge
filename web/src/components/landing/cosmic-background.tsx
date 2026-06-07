"use client";

import { useEffect, useRef } from "react";

/**
 * Cosmic background ported from the Stitch "Animated Cosmic Landing Page".
 * Three layers, no external assets:
 *  1. a slowly "breathing" deep-space gradient (charcoal / navy / obsidian),
 *  2. a drifting atmosphere overlay that shifts light across the void,
 *  3. a canvas starfield — most points twinkle, a few larger "knowledge"
 *     particles drift upward with a soft glow.
 * Canvas is sized to its parent; respects prefers-reduced-motion (static frame,
 * CSS animations disabled). `opacity` lets text-heavy sections dim the field.
 */
const GLYPHS = [
  "∫", "∑", "√", "π", "θ", "λ", "∇", "∂", "Δ", "α", "β", "σ", "μ", "∞",
  "≈", "≠", "≤", "≥", "→", "∈", "⊂", "∮", "∴", "∝", "ρ", "φ",
  "f(x)", "dy/dx", "x²", "e^x", "P(A)", "lim", "log", "½", "∂/∂x",
];

export function CosmicBackground({
  className,
  opacity = 1,
}: {
  className?: string;
  opacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const context = node.getContext("2d");
    if (!context) return;

    const canvas: HTMLCanvasElement = node;
    const ctx: CanvasRenderingContext2D = context;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let raf = 0;

    // Cursor position in canvas-local coordinates (offscreen until the pointer moves).
    let mouseX = -9999;
    let mouseY = -9999;
    const MOUSE_RADIUS = 160;

    type Particle = {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      fade: number;
      isKnowledge: boolean;
    };
    let particles: Particle[] = [];

    // Drifting math glyphs that fade in, float, then fade out and respawn.
    type Glyph = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      sym: string;
      life: number;
      maxLife: number;
      alphaMax: number;
    };
    let glyphs: Glyph[] = [];

    function spawnGlyph(): Glyph {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(0.05 + Math.random() * 0.15),
        size: 16 + Math.random() * 30,
        sym: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        life: Math.random() * 220,
        maxLife: 320 + Math.random() * 280,
        alphaMax: 0.05 + Math.random() * 0.08,
      };
    }

    function buildGlyphs() {
      const count = Math.min(
        16,
        Math.max(6, Math.floor((width * height) / 120000)),
      );
      glyphs = Array.from({ length: count }, spawnGlyph);
    }

    function spawn(): Particle {
      const isKnowledge = Math.random() > 0.85;
      if (isKnowledge) {
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2.5 + 2.5,
          speedX: (Math.random() - 0.5) * 0.05,
          speedY: -Math.random() * 0.1,
          opacity: Math.random(),
          fade: Math.random() * 0.02 + 0.012,
          isKnowledge: true,
        };
      }
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.6 + 1.4,
        speedX: (Math.random() - 0.5) * 0.12,
        speedY: (Math.random() - 0.5) * 0.12,
        opacity: Math.random(),
        fade: Math.random() * 0.02 + 0.012,
        isKnowledge: false,
      };
    }

    function build() {
      // Scale count to area; kept lower than a pure starfield so the
      // constellation lines stay legible rather than a dense mesh.
      const count = Math.min(170, Math.floor((width * height) / 10000));
      particles = Array.from({ length: count }, spawn);
    }

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      buildGlyphs();
    }

    const MAX_DIST = 130;

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // 0) Drifting math glyphs (behind everything) — fade in, float, fade out.
      ctx.shadowBlur = 0;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const g of glyphs) {
        g.life += 1;
        g.x += g.vx;
        g.y += g.vy;
        if (g.life >= g.maxLife) {
          Object.assign(g, spawnGlyph());
          g.life = 0;
          continue;
        }
        const t = g.life / g.maxLife;
        const env = Math.max(0, Math.min(1, t / 0.25, (1 - t) / 0.25));
        const a = g.alphaMax * env * opacity;
        ctx.font = `${g.size}px Georgia, "Times New Roman", serif`;
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.fillText(g.sym, g.x, g.y);
      }

      // 1) Move + twinkle.
      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;

        if (!p.isKnowledge) {
          p.opacity += p.fade;
          if (p.opacity > 1 || p.opacity < 0.45) p.fade = -p.fade;
        }

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }

      // 2) Constellation lines between nearby stars (drawn under the stars).
      ctx.shadowBlur = 0;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < MAX_DIST) {
            // Keep lines visible even on dimmed (opacity 0.5) sections.
            const o = (1 - dist / MAX_DIST) * 0.34 * Math.max(opacity, 0.72);
            ctx.strokeStyle = `rgba(255, 255, 255, ${o})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // 3) Stars on top — those near the cursor flare brighter and larger.
      for (const p of particles) {
        const md = Math.hypot(p.x - mouseX, p.y - mouseY);
        const boost = md < MOUSE_RADIUS ? 1 - md / MOUSE_RADIUS : 0;

        const base = p.isKnowledge ? p.opacity * 0.85 : p.opacity;
        // Base brightness follows the page opacity; the cursor boost is added on
        // top undimmed so nearby stars still pop on the dimmed sections.
        const alpha = Math.min(1, base * opacity + boost * 0.85);
        const size = p.size * (1 + boost * 0.9);

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.shadowBlur = (p.isKnowledge ? 16 : 6) + boost * 18;
        ctx.shadowColor = "white";
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }
    function onLeave() {
      mouseX = -9999;
      mouseY = -9999;
    }

    resize();
    if (reduced) draw();
    else loop();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerout", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
  }, [opacity]);

  return (
    <div className={className} aria-hidden="true">
      <div className="pf-cosmic-breath absolute inset-0" />
      <div className="pf-cosmic-atmosphere absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <style>{`
        .pf-cosmic-breath {
          background:
            radial-gradient(ellipse at 28% 22%, rgba(46, 58, 92, 0.45) 0%, transparent 52%),
            radial-gradient(ellipse at 74% 68%, rgba(28, 32, 58, 0.5) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 50%, #0b0d16 0%, #000 78%);
          animation: pf-cosmic-breath 40s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes pf-cosmic-breath {
          0%   { transform: scale(1) translate(0, 0); }
          50%  { transform: scale(1.08) translate(-1%, -1%); }
          100% { transform: scale(1.03) translate(1%, 1%); }
        }
        .pf-cosmic-atmosphere {
          background: radial-gradient(circle at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.4) 100%);
          animation: pf-cosmic-light 25s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes pf-cosmic-light {
          0%   { opacity: 0.4; transform: scale(1) rotate(0deg); }
          100% { opacity: 0.8; transform: scale(1.5) rotate(15deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pf-cosmic-breath, .pf-cosmic-atmosphere { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
