"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Check, Copy, Sparkles } from "lucide-react";

import { createAssessment } from "@/app/(dashboard)/assessments/actions";

type Topic = { id: string; name: string };
type Course = { id: string; title: string; topics: Topic[] };

const fieldCls =
  "font-body-cosmic w-full rounded-lg border border-[#444748]/40 bg-[#1b1c1d] px-4 py-3 text-sm text-[#e3e2e3] outline-none transition placeholder:text-[#c4c7c8]/40 focus:border-white/40 focus:ring-1 focus:ring-white/20";
const labelCls =
  "font-label-cosmic mb-2 block text-[10px] uppercase tracking-widest text-[#c4c7c8]";

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="font-display text-lg">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-[#c4c7c8]/70">{desc}</p>
      {children}
    </div>
  );
}

export type { Course };

export function AssessmentBuilder({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState(15);
  const [easy, setEasy] = useState(30);
  const [medium, setMedium] = useState(50);
  const [hard, setHard] = useState(20);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const currentCourse = courses.find((c) => c.id === courseId);
  const topics = currentCourse?.topics ?? [];
  const total = easy + medium + hard;

  async function submit() {
    setCreating(true);
    setError(null);
    const res = await createAssessment({
      courseId,
      title,
      topicIds: [...selected],
      questions,
      difficulty: { easy, medium, hard },
      opensAt: opensAt || null,
      closesAt: closesAt || null,
      instructions,
    });
    setCreating(false);
    if (res.ok) setCreatedCode(res.code);
    else setError(res.error);
  }

  function changeCourse(id: string) {
    setCourseId(id);
    setSelected(new Set()); // topics belong to a course — reset on switch
  }

  function toggleTopic(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (courses.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border-dashed py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border border-[#444748]/40 bg-[#1b1c1d]">
          <BookOpen className="size-6 text-[#c4c7c8]/60" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm font-semibold text-[#e3e2e3]">
          No courses yet
        </p>
        <p className="mt-1 text-sm text-[#c4c7c8]/60">
          Create a course and add topics before building an assessment.
        </p>
        <Link
          href="/courses"
          className="active-glow mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#16181a] transition hover:opacity-90"
        >
          Go to courses
        </Link>
      </div>
    );
  }

  if (createdCode) {
    return (
      <div className="glass-panel flex flex-col items-center rounded-2xl p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
          <Check className="size-6" strokeWidth={2} />
        </div>
        <h2 className="mt-4 font-display text-2xl">Assessment created</h2>
        <p className="mt-1 text-sm text-[#c4c7c8]/70">
          Share this code with students. They enter it in the exam app to start.
        </p>
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-[#1b1c1d] px-6 py-4">
          <span className="font-display text-3xl tracking-[0.15em]">{createdCode}</span>
          <button
            onClick={() => navigator.clipboard?.writeText(createdCode)}
            className="rounded-lg p-2 text-[#c4c7c8] transition hover:bg-white/5 hover:text-[#e3e2e3]"
            aria-label="Copy code"
          >
            <Copy className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="mt-8 flex gap-3">
          <Link
            href="/assessments"
            className="rounded-xl border border-[#444748]/40 px-5 py-2.5 text-sm text-[#c4c7c8] transition hover:bg-[#1b1c1d] hover:text-[#e3e2e3]"
          >
            Done
          </Link>
          <button
            onClick={() => {
              setCreatedCode(null);
              setTitle("");
              setSelected(new Set());
            }}
            className="active-glow rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#16181a] transition hover:opacity-90"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Basics */}
      <Section title="Basics" desc="Name the assessment and pick its course.">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm: Thermodynamics"
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Course</label>
            <select
              value={courseId}
              onChange={(e) => changeCourse(e.target.value)}
              className={fieldCls}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1b1c1d]">
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Topics */}
      <Section
        title="Topics"
        desc="Choose which topics from this course the assessment covers."
      >
        {topics.length === 0 ? (
          <p className="text-sm text-[#c4c7c8]/60">
            This course has no topics yet.{" "}
            <Link
              href={`/courses/${courseId}`}
              className="text-[#e3e2e3] underline-offset-4 hover:underline"
            >
              Add topics
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => {
                const on = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTopic(t.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      on
                        ? "border-white/30 bg-white text-[#16181a]"
                        : "border-[#444748]/40 text-[#c4c7c8] hover:border-white/20 hover:text-[#e3e2e3]"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            <p className="font-label-cosmic mt-4 text-[10px] uppercase tracking-wider text-[#c4c7c8]/50">
              {selected.size} of {topics.length} selected
            </p>
          </>
        )}
      </Section>

      {/* Question setup */}
      <Section
        title="Question setup"
        desc="How many questions, and the difficulty mix."
      >
        <div className="flex flex-col gap-6">
          <div className="max-w-[200px]">
            <label className={labelCls}>Questions per student</label>
            <input
              type="number"
              min={1}
              max={100}
              value={questions}
              onChange={(e) => setQuestions(Number(e.target.value))}
              className={fieldCls}
            />
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className={`${labelCls} mb-0`}>
                Difficulty distribution
              </label>
              <span
                className={`font-display text-sm ${
                  total === 100 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                Total {total}%
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {[
                { k: "Easy", v: easy, set: setEasy },
                { k: "Medium", v: medium, set: setMedium },
                { k: "Hard", v: hard, set: setHard },
              ].map((d) => (
                <div key={d.k}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm text-[#c4c7c8]">{d.k}</span>
                    <span className="font-display text-sm">{d.v}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={d.v}
                    onChange={(e) => d.set(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#343536] accent-white"
                  />
                </div>
              ))}
            </div>
            {total !== 100 && (
              <p className="mt-3 text-xs text-amber-400/80">
                Tip: difficulty percentages should add up to 100%.
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* Window */}
      <Section
        title="Assessment window"
        desc="When students can take it. Each can start any time in the window."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Opens</label>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label className={labelCls}>Closes</label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className={fieldCls}
            />
          </div>
        </div>
      </Section>

      {/* Custom instructions */}
      <Section
        title="Custom instructions"
        desc="One-off guidance for this assessment's generation (optional)."
      >
        <textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Emphasize applied problems; always include unit conversions; no proof-based questions."
          className={`${fieldCls} resize-none`}
        />
      </Section>

      {/* Actions */}
      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/assessments"
          className="rounded-xl border border-[#444748]/40 px-5 py-2.5 text-sm text-[#c4c7c8] transition hover:bg-[#1b1c1d] hover:text-[#e3e2e3]"
        >
          Cancel
        </Link>
        <button
          onClick={submit}
          disabled={creating}
          className="active-glow flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#16181a] transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
        >
          <Sparkles className="size-4" strokeWidth={2} />
          {creating ? "Creating…" : "Create assessment & code"}
        </button>
      </div>

      <p className="font-label-cosmic text-[10px] uppercase tracking-wider text-[#c4c7c8]/40">
        A unique code is generated now; question generation runs once the Phase 2
        backend is connected.
      </p>
    </div>
  );
}
