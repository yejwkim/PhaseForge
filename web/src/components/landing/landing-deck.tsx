"use client";

import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { CosmicBackground } from "@/components/landing/cosmic-background";

const serif = "font-[family-name:var(--font-cormorant)]";

const SECTION_COUNT = 3;
const DURATION_MS = 600;
const COOLDOWN_MS = 620;

const coreLoop = [
  {
    title: "Student Response",
    body: "Students solve each problem on paper, enter their final answer, and submit a photo of their work.",
  },
  {
    title: "Solution Review",
    body: "PhaseForge compares the submitted work with the reference solution to distinguish a calculation error from a conceptual misunderstanding.",
  },
  {
    title: "Adaptive Adjustment",
    body: "The next question adjusts by topic and difficulty, helping measure mastery without treating every mistake the same way.",
  },
];

const founders = [
  { name: "Isaac Choi", role: "CS · Math, UT Austin", initials: "IC" },
  { name: "Yejune Kim", role: "CS · Statistics & Data Science, UT Austin", initials: "YK" },
];

const vignette =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_68%,#000_100%)]";

/** Fades + lifts its children into place when `show` flips true, with an optional stagger delay. */
function Reveal({
  show,
  reduced,
  delay = 0,
  className,
  children,
}: {
  show: boolean;
  reduced: boolean;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className}
      style={
        reduced
          ? undefined
          : {
              opacity: show ? 1 : 0,
              transform: show ? "translateY(0)" : "translateY(20px)",
              transition:
                "opacity 700ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: show ? `${delay}ms` : "0ms",
              willChange: "opacity, transform",
            }
      }
    >
      {children}
    </div>
  );
}

export function LandingDeck() {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const lockRef = useRef(false);
  const touchY = useRef<number | null>(null);

  const lock = useCallback(() => {
    lockRef.current = true;
    window.setTimeout(() => {
      lockRef.current = false;
    }, COOLDOWN_MS);
  }, []);

  const advance = useCallback(
    (dir: number) => {
      setIndex((cur) => {
        if (lockRef.current) return cur;
        const next = Math.max(0, Math.min(SECTION_COUNT - 1, cur + dir));
        if (next === cur) return cur;
        lock();
        return next;
      });
    },
    [lock],
  );

  const jump = useCallback(
    (target: number) => {
      setIndex((cur) => {
        if (lockRef.current || target === cur) return cur;
        lock();
        return Math.max(0, Math.min(SECTION_COUNT - 1, target));
      });
    },
    [lock],
  );

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 8) return;
      advance(e.deltaY > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        advance(1);
      } else if (["ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        advance(-1);
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY.current === null) return;
      const dy =
        touchY.current - (e.changedTouches[0]?.clientY ?? touchY.current);
      if (Math.abs(dy) > 50) advance(dy > 0 ? 1 : -1);
      touchY.current = null;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [advance]);

  const onHero = index === 0;
  const onMission = index === 1;
  const onFounders = index === 2;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* Fixed nav — above the moving deck */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 sm:px-10">
        <button
          onClick={() => jump(0)}
          className={`${serif} text-xl tracking-wide`}
        >
          PhaseForge
        </button>
        <nav className="flex gap-8 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-white/50">
          <button onClick={() => jump(1)} className="transition hover:text-white">
            Archive
          </button>
          <button onClick={() => jump(2)} className="transition hover:text-white">
            Faculty
          </button>
        </nav>
      </header>

      {/* Moving deck — slides directly to the active page on each gesture */}
      <div
        className="h-full w-full"
        style={{
          transform: `translateY(-${index * 100}%)`,
          transition: reduced
            ? "none"
            : `transform ${DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {/* Page 1 — Hero */}
        <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
          <CosmicBackground className="absolute inset-0 overflow-hidden" />
          <div className={vignette} />
          <div className="relative z-10 flex flex-col items-center">
            <Reveal show={onHero} reduced={reduced} delay={0}>
              <p className="mb-6 text-xs font-medium uppercase tracking-[0.45em] text-white/45">
                Academic Precision
              </p>
            </Reveal>
            <Reveal show={onHero} reduced={reduced} delay={90}>
              <h1
                className={`${serif} text-7xl font-light tracking-tight sm:text-8xl`}
              >
                PhaseForge
              </h1>
            </Reveal>
            <Reveal show={onHero} reduced={reduced} delay={180}>
              <p className="mt-8 max-w-xl text-balance text-base leading-relaxed text-white/65 sm:text-lg">
                Create AI-adaptive assessments from your lectures, notes, and
                past exams and better evaluate your students.
              </p>
            </Reveal>
            <Reveal show={onHero} reduced={reduced} delay={270}>
              <div className="mt-10 flex gap-4">
                <Link
                  href="/login"
                  className="rounded-sm bg-white px-7 py-3 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-black transition hover:bg-white/85"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-sm border border-white/25 px-7 py-3 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-white transition hover:border-white/60"
                >
                  Sign up
                </Link>
              </div>
            </Reveal>
          </div>
          <Reveal
            show={onHero}
            reduced={reduced}
            delay={380}
            className="absolute bottom-8 z-10"
          >
            <button
              onClick={() => jump(1)}
              className="text-[0.72rem] uppercase tracking-[0.35em] text-white/30 transition hover:text-white/60"
            >
              Scroll for more
            </button>
          </Reveal>
        </section>

        {/* Page 2 — Mission & Core Loop */}
        <section className="relative flex h-screen w-full items-center overflow-hidden px-6 sm:px-10">
          <CosmicBackground
            className="absolute inset-0 overflow-hidden"
            opacity={0.5}
          />
          <div className={vignette} />
          <div className="relative z-10 mx-auto grid w-full max-w-5xl gap-16 md:grid-cols-2">
            <div>
              <Reveal show={onMission} reduced={reduced} delay={0}>
                <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/40">
                  The Vision
                </p>
              </Reveal>
              <Reveal show={onMission} reduced={reduced} delay={80}>
                <h2 className={`${serif} text-5xl font-light sm:text-6xl`}>
                  Mission &amp; Core Functionality
                </h2>
              </Reveal>
              <Reveal show={onMission} reduced={reduced} delay={170}>
                <p className="mt-6 max-w-md text-base leading-relaxed text-white/60">
                  PhaseForge is an AI-adaptive assessment platform that turns
                  your lectures, notes, and past exams into unique
                  student-specific exams.
                </p>
              </Reveal>
              <Reveal show={onMission} reduced={reduced} delay={240}>
                <p className="mt-6 max-w-md text-base italic leading-relaxed text-white/40">
                  Revolutionizing how we measure understanding, one student at a
                  time.
                </p>
              </Reveal>
            </div>
            <div>
              <Reveal show={onMission} reduced={reduced} delay={120}>
                <p className="mb-8 text-xs uppercase tracking-[0.3em] text-white/40">
                  The Core Loop
                </p>
              </Reveal>
              <ol className="flex flex-col gap-8">
                {coreLoop.map((step, i) => (
                  <Reveal
                    key={step.title}
                    show={onMission}
                    reduced={reduced}
                    delay={200 + i * 100}
                  >
                    <li className="border-l border-white/15 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs tabular-nums text-white/30">
                          0{i + 1}
                        </span>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-base leading-relaxed text-white/50">
                        {step.body}
                      </p>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Page 3 — Founders */}
        <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden px-6 text-center sm:px-10">
          <CosmicBackground
            className="absolute inset-0 overflow-hidden"
            opacity={0.5}
          />
          <div className={vignette} />
          <div className="relative z-10 flex flex-col items-center">
            <Reveal show={onFounders} reduced={reduced} delay={0}>
              <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/40">
                Leadership
              </p>
            </Reveal>
            <Reveal show={onFounders} reduced={reduced} delay={80}>
              <h2 className={`${serif} text-5xl font-light sm:text-6xl`}>
                The Founders
              </h2>
            </Reveal>
            <div className="mt-14 flex flex-col items-center justify-center gap-12 sm:flex-row sm:gap-24">
              {founders.map((f, i) => (
                <Reveal
                  key={f.name}
                  show={onFounders}
                  reduced={reduced}
                  delay={180 + i * 120}
                >
                  <div className="flex flex-col items-center">
                    <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-base font-medium tracking-wide text-white/70">
                      {f.initials}
                    </div>
                    <h3 className="text-base font-medium">{f.name}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.15em] text-white/40">
                      {f.role}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal show={onFounders} reduced={reduced} delay={420}>
              <p className="mt-20 text-xs uppercase tracking-[0.25em] text-white/25">
                PhaseForge · Academic Precision
              </p>
            </Reveal>
          </div>
        </section>
      </div>
    </div>
  );
}
