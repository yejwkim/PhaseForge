"use client";

import { useEffect, useRef } from "react";

/**
 * Themed, dynamic background: a slow field of drifting mathematical glyphs and
 * expression fragments — evoking the exam / adaptive-assessment domain.
 * Glyphs twinkle, rise, and respond subtly to the pointer (parallax).
 * Respects prefers-reduced-motion (renders a single static frame).
 */
const GLYPHS = [
  "∫", "∑", "√", "π", "θ", "λ", "∇", "∂", "Δ", "α", "β", "σ", "μ", "∞",
  "≈", "≠", "≤", "≥", "→", "∈", "⊂", "∮", "∴", "∝", "∀", "∃", "ρ", "φ",
  "f(x)", "dy/dx", "x²", "e^x", "P(A)", "lim", "log", "Σ", "½", "∂/∂x",
];

export function AssessmentBackground({
  className,
  density = 1,
  opacity = 1,
}: {
  className?: string;
  density?: number;
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
    let t = 0;
    let mx = 0;
    let my = 0;
    let targetMx = 0;
    let targetMy = 0;

    type Glyph = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      phase: number;
      depth: number;
      sym: string;
    };
    let items: Glyph[] = [];

    function build() {
      const count = Math.min(
        70,
        Math.floor(((width * height) / 26000) * density),
      );
      items = Array.from({ length: count }, () => {
        const size = 12 + Math.random() * 26;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.08,
          vy: -(0.08 + Math.random() * 0.24),
          size,
          alpha: 0.04 + Math.random() * 0.12,
          phase: Math.random() * Math.PI * 2,
          depth: size / 38,
          sym: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        };
      });
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
    }

    function draw() {
      t += 0.016;
      mx += (targetMx - mx) * 0.05;
      my += (targetMy - my) * 0.05;

      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const g of items) {
        g.x += g.vx;
        g.y += g.vy;
        if (g.y < -40) {
          g.y = height + 40;
          g.x = Math.random() * width;
        }
        if (g.x < -40) g.x = width + 40;
        else if (g.x > width + 40) g.x = -40;

        const twinkle = Math.sin(t * 0.6 + g.phase) * 0.5 + 0.5;
        const a = g.alpha * (0.45 + twinkle * 0.75) * opacity;
        const ox = mx * g.depth * 20;
        const oy = my * g.depth * 20;

        ctx.font = `${g.size}px Georgia, "Times New Roman", serif`;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillText(g.sym, g.x + ox, g.y + oy);
      }

      raf = requestAnimationFrame(draw);
    }

    function onMove(e: PointerEvent) {
      targetMx = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMy = (e.clientY / window.innerHeight - 0.5) * 2;
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      draw();
      cancelAnimationFrame(raf);
    } else {
      draw();
      window.addEventListener("pointermove", onMove);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [density, opacity]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
