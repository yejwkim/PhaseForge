"use client";

import { useEffect, useRef } from "react";

/**
 * Animated constellation / node-network background.
 * Draws drifting points connected by fading lines on a canvas sized to its parent.
 * Respects prefers-reduced-motion (renders a single static frame).
 *
 * `density` scales the number of nodes; `opacity` scales overall brightness so
 * text-heavy sections can use a subtler field than the hero.
 */
export function NetworkBackground({
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

    // Non-null declared types so the narrowing survives inside the closures below.
    const canvas: HTMLCanvasElement = node;
    const ctx: CanvasRenderingContext2D = context;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let raf = 0;

    type Point = { x: number; y: number; vx: number; vy: number };
    let points: Point[] = [];

    const MAX_DIST = 150;

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

      const count = Math.min(
        110,
        Math.floor(((width * height) / 14000) * density),
      );
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= 0 || p.x >= width) p.vx *= -1;
        if (p.y <= 0 || p.y >= height) p.vy *= -1;
      }

      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MAX_DIST) {
            const o = (1 - dist / MAX_DIST) * 0.22 * opacity;
            ctx.strokeStyle = `rgba(255,255,255,${o})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of points) {
        ctx.fillStyle = `rgba(255,255,255,${0.55 * opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    }

    resize();
    if (reduced) draw();
    else loop();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [density, opacity]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
