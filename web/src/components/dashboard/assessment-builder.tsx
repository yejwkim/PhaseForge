"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Check, Copy, Loader2, Sparkles } from "lucide-react";

import { createAssessment } from "@/app/(dashboard)/assessments/actions";
import { createClient } from "@/lib/supabase/client";
import {
  QuestionResults,
  type GeneratedQuestion,
} from "@/components/dashboard/question-results";

const POOL_TYPES = ["mcq", "short_answer"] as const;

type BandCounts = { easy: number; medium: number; hard: number };
const EMPTY_COUNTS: BandCounts = { easy: 0, medium: 0, hard: 0 };
const DEFAULT_COUNTS: BandCounts = { easy: 1, medium: 2, hard: 1 };

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
  const [counts, setCounts] = useState<Record<string, BandCounts>>({});
  const [perStudent, setPerStudent] = useState<Record<string, number>>({});
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedQuestion[] | null>(null);

  const currentCourse = courses.find((c) => c.id === courseId);
  const topics = currentCourse?.topics ?? [];
  const selectedTopics = topics.filter((t) => selected.has(t.id));

  const bandTotal = (band: keyof BandCounts) =>
    selectedTopics.reduce((sum, t) => sum + (counts[t.id]?.[band] ?? 0), 0);
  const totalEasy = bandTotal("easy");
  const totalMedium = bandTotal("medium");
  const totalHard = bandTotal("hard");
  const total = totalEasy + totalMedium + totalHard;

  const poolFor = (id: string) => {
    const c = counts[id] ?? EMPTY_COUNTS;
    return c.easy + c.medium + c.hard;
  };
  const perStudentTotal = selectedTopics.reduce(
    (sum, t) => sum + (perStudent[t.id] ?? 0),
    0,
  );
  // A topic where the student is asked more questions than the pool holds.
  const overAllocated = selectedTopics.some(
    (t) => (perStudent[t.id] ?? 0) > poolFor(t.id),
  );

  function setCount(id: string, band: keyof BandCounts, value: number) {
    setCounts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY_COUNTS), [band]: Math.max(0, value || 0) },
    }));
  }

  function setPerStudentCount(id: string, value: number) {
    setPerStudent((prev) => ({ ...prev, [id]: Math.max(0, value || 0) }));
  }

  async function submit() {
    if (selected.size === 0) {
      setError("Pick at least one topic — questions are generated per topic.");
      return;
    }
    if (total === 0) {
      setError("Set at least one pool question above zero.");
      return;
    }
    if (perStudentTotal === 0) {
      setError("Set how many questions each student answers (per topic).");
      return;
    }
    if (overAllocated) {
      setError("A topic asks students more questions than its pool holds — lower it or grow the pool.");
      return;
    }
    setCreating(true);
    setError(null);
    const res = await createAssessment({
      courseId,
      title,
      topicIds: [...selected],
      questions: perStudentTotal,
      perStudent: selectedTopics.map((t) => ({
        id: t.id,
        name: t.name,
        count: perStudent[t.id] ?? 0,
      })),
      opensAt: opensAt || null,
      closesAt: closesAt || null,
      instructions,
    });
    setCreating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCreatedCode(res.code);
    // Generate the question pool for the assessment we just created.
    void generatePool(res.id);
  }

  async function generatePool(assessmentId: string) {
    setGenBusy(true);
    setGenError(null);
    setGenerated(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setGenError("Your session expired — please log in again.");
      setGenBusy(false);
      return;
    }

    const plans = selectedTopics.map((t) => ({
      id: t.id,
      name: t.name,
      ...(counts[t.id] ?? EMPTY_COUNTS),
    }));
    const expected = total;

    try {
      // Kick off generation — the API returns immediately and finishes the work
      // in the background, so leaving this page no longer cancels it.
      const apiRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          course_id: courseId,
          assessment_id: assessmentId,
          plans,
          types: POOL_TYPES,
          instructions: instructions.trim() || null,
        }),
      });
      if (!apiRes.ok) {
        const detail = await apiRes
          .json()
          .then((b) => b?.detail as string)
          .catch(() => null);
        throw new Error(detail || `Request failed (${apiRes.status})`);
      }
    } catch (e) {
      setGenError(
        e instanceof Error ? e.message : "Generation failed — is the API running?",
      );
      setGenBusy(false);
      return;
    }

    // Poll the questions table so results show up as they land (and the work
    // keeps going server-side even if the user navigates away).
    const deadline = Date.now() + 180_000; // 3 min safety cap
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data } = await supabase
        .from("questions")
        .select(
          "id, type, topic, difficulty, learning_objective, prompt, options, answer, explanation, rubric, figure_svg",
        )
        .eq("assessment_id", assessmentId)
        .order("created_at", { ascending: true });
      if (data) {
        setGenerated(
          data.map((r) => ({
            generated_question_id: r.id as string,
            question_type: r.type as GeneratedQuestion["question_type"],
            topic: (r.topic as string) ?? "",
            difficulty: (r.difficulty as string) ?? "",
            learning_objective: (r.learning_objective as string) ?? "",
            prompt: (r.prompt as string) ?? "",
            options: (r.options as string[]) ?? [],
            answer: (r.answer as string) ?? "",
            explanation: (r.explanation as string) ?? "",
            rubric: (r.rubric as string[]) ?? [],
            figure_svg: (r.figure_svg as string) ?? "",
          })),
        );
        if (data.length >= expected) break; // pool complete
      }
    }
    setGenBusy(false);
  }

  function changeCourse(id: string) {
    setCourseId(id);
    setSelected(new Set()); // topics belong to a course — reset on switch
    setCounts({});
    setPerStudent({});
  }

  function toggleTopic(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Seed sensible defaults when a topic is added; keep them when toggled off
    // so re-selecting restores the prior counts.
    setCounts((prev) => (prev[id] ? prev : { ...prev, [id]: { ...DEFAULT_COUNTS } }));
    setPerStudent((prev) => (prev[id] != null ? prev : { ...prev, [id]: 2 }));
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
      <div className="flex flex-col gap-6">
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
              disabled={genBusy}
              onClick={() => {
                setCreatedCode(null);
                setGenerated(null);
                setGenError(null);
                setTitle("");
                setSelected(new Set());
              }}
              className="active-glow rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#16181a] transition hover:opacity-90 disabled:opacity-50"
            >
              Create another
            </button>
          </div>
        </div>

        {genBusy && (
          <div className="glass-panel flex flex-col items-center justify-center gap-2 rounded-2xl py-8 text-center text-sm text-[#c4c7c8]">
            <span className="flex items-center gap-3">
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              Generating questions from your course materials…
            </span>
            <span className="text-xs text-[#c4c7c8]/60">
              This runs in the background — you can leave; results also appear in
              Question Pools.
            </span>
          </div>
        )}
        {genError && (
          <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {genError}
          </p>
        )}
        {generated && <QuestionResults questions={generated} />}
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

      {/* Questions per topic */}
      <Section
        title="Questions per topic"
        desc="Pool = questions generated into the bank. Per student = how many of that topic each student answers (difficulty is chosen adaptively). Keep the pool larger than per-student for variety."
      >
        {selectedTopics.length === 0 ? (
          <p className="text-sm text-[#c4c7c8]/60">
            Select at least one topic above to set question counts.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedTopics.map((t) => {
              const c = counts[t.id] ?? EMPTY_COUNTS;
              const ps = perStudent[t.id] ?? 0;
              const over = ps > poolFor(t.id);
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#444748]/30 bg-[#1b1c1d] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#e3e2e3]">{t.name}</span>
                    <label className="flex items-center gap-1.5">
                      <span className="font-label-cosmic text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
                        Per student
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={ps}
                        onChange={(e) => setPerStudentCount(t.id, Number(e.target.value))}
                        className={`w-14 rounded-lg border bg-[#16181a] px-2 py-1.5 text-center text-sm text-[#e3e2e3] outline-none transition focus:border-white/40 ${
                          over ? "border-red-500/50" : "border-[#444748]/40"
                        }`}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-label-cosmic text-[10px] uppercase tracking-widest text-[#c4c7c8]/40">
                      Pool
                    </span>
                    {(
                      [
                        ["easy", "Easy"],
                        ["medium", "Medium"],
                        ["hard", "Hard"],
                      ] as const
                    ).map(([band, label]) => (
                      <label key={band} className="flex items-center gap-1.5">
                        <span className="font-label-cosmic text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
                          {label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={c[band]}
                          onChange={(e) => setCount(t.id, band, Number(e.target.value))}
                          className="w-14 rounded-lg border border-[#444748]/40 bg-[#16181a] px-2 py-1.5 text-center text-sm text-[#e3e2e3] outline-none transition focus:border-white/40"
                        />
                      </label>
                    ))}
                    {over && (
                      <span className="text-xs text-red-400">
                        asks {ps} but pool has {poolFor(t.id)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-[#444748]/30 pt-3">
              <span className="font-label-cosmic text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
                Total
              </span>
              <span className="font-display text-sm">
                Pool {total} · {perStudentTotal} per student
              </span>
            </div>
          </div>
        )}
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
          {creating ? "Creating…" : "Create assessment & generate"}
        </button>
      </div>

      <p className="font-label-cosmic text-[10px] uppercase tracking-wider text-[#c4c7c8]/40">
        Creates the code and generates a question pool from this course&apos;s
        materials for the selected topics.
      </p>
    </div>
  );
}
