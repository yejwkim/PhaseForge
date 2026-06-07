"use client";

/**
 * Converging light beams. Multiple curved paths fan out across the bottom and
 * converge to a single focal point near the top — a light pulse travels up each
 * beam. Evokes many adaptive paths resolving into one. Pure SVG + CSS, no deps.
 * Deterministic geometry (no random) to stay hydration-safe; respects
 * prefers-reduced-motion.
 */
const FOCAL = { x: 500, y: 150 };
const BEAM_COUNT = 18;

const beams = Array.from({ length: BEAM_COUNT }, (_, i) => {
  const x0 = 40 + (i / (BEAM_COUNT - 1)) * 920;
  // Cubic: vertical takeoff at the bottom, then bend into the focal point.
  const d = `M ${x0} 1000 C ${x0} 660, ${FOCAL.x} 500, ${FOCAL.x} ${FOCAL.y}`;
  const dur = 3.2 + (i % 6) * 0.6;
  const delay = -(i * 0.4);
  return { d, dur, delay, i };
});

export function BeamsBackground({
  className,
  opacity = 1,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div className={className} style={{ opacity }} aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="pf-focal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="pf-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Static faint rails */}
        {beams.map((b) => (
          <path
            key={`rail-${b.i}`}
            d={b.d}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        {/* Traveling light pulses */}
        <g filter="url(#pf-glow)">
          {beams.map((b) => (
            <path
              key={`beam-${b.i}`}
              d={b.d}
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={1.4}
              strokeLinecap="round"
              pathLength={100}
              className="pf-beam"
              style={{
                strokeDasharray: "7 93",
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </g>

        {/* Convergence glow */}
        <circle cx={FOCAL.x} cy={FOCAL.y} r={150} fill="url(#pf-focal)" />

        <style>{`
          .pf-beam {
            stroke-dashoffset: 100;
            animation-name: pf-beam-travel;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }
          @keyframes pf-beam-travel { to { stroke-dashoffset: 0; } }
          @media (prefers-reduced-motion: reduce) {
            .pf-beam { animation: none; stroke-dashoffset: 50; }
          }
        `}</style>
      </svg>
    </div>
  );
}
