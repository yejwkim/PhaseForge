"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

import { deleteQuestions } from "@/app/(dashboard)/assessments/actions";
import { createClient } from "@/lib/supabase/client";
import {
  QuestionReviewCard,
  type PoolQuestion,
  type ReviewStatus,
} from "@/components/dashboard/question-review-card";

const POOL_TYPES = ["mcq", "short_answer"] as const;

const BAND_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#343536] text-[#c4c7c8] border-[#444748]/30",
  open: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  closed: "bg-red-500/10 text-red-400 border-red-500/20",
};

export type PoolTopic = { id: string; name: string; questions: PoolQuestion[] };
export type PoolAssessment = {
  id: string;
  title: string;
  code: string;
  status: string;
  topics: PoolTopic[];
};
export type PoolCourse = {
  id: string;
  title: string;
  allTopics: { id: string; name: string }[];
  assessments: PoolAssessment[];
};

const countQuestions = (a: PoolAssessment) =>
  a.topics.reduce((s, t) => s + t.questions.length, 0);
const countApproved = (qs: PoolQuestion[]) =>
  qs.filter((q) => q.professor_review_status === "approved").length;

export function QuestionPoolBrowser({ courses }: { courses: PoolCourse[] }) {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);

  const course = courses.find((c) => c.id === courseId) ?? null;
  const assessment = course?.assessments.find((a) => a.id === assessmentId) ?? null;
  const topic = assessment?.topics.find((t) => t.id === topicId) ?? null;

  if (courses.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border-dashed py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border border-[#444748]/40 bg-[#1b1c1d]">
          <BookOpen className="size-6 text-[#c4c7c8]/60" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm font-semibold text-[#e3e2e3]">No questions yet</p>
        <p className="mt-1 text-sm text-[#c4c7c8]/60">
          Create an assessment to generate a question pool.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-[#c4c7c8]">
        <Crumb
          label="Courses"
          onClick={() => {
            setCourseId(null);
            setAssessmentId(null);
            setTopicId(null);
          }}
          active={!course}
        />
        {course && (
          <>
            <Sep />
            <Crumb
              label={course.title}
              onClick={() => {
                setAssessmentId(null);
                setTopicId(null);
              }}
              active={!assessment}
            />
          </>
        )}
        {assessment && (
          <>
            <Sep />
            <Crumb
              label={assessment.title}
              onClick={() => setTopicId(null)}
              active={!topic}
            />
          </>
        )}
        {topic && (
          <>
            <Sep />
            <Crumb label={topic.name} onClick={() => {}} active />
          </>
        )}
      </div>

      {/* Level 0: courses */}
      {!course && (
        <CardGrid>
          {courses.map((c) => {
            const total = c.assessments.reduce((s, a) => s + countQuestions(a), 0);
            return (
              <DrillCard
                key={c.id}
                title={c.title}
                meta={`${c.assessments.length} exam${c.assessments.length === 1 ? "" : "s"} · ${total} question${total === 1 ? "" : "s"}`}
                onClick={() => setCourseId(c.id)}
              />
            );
          })}
        </CardGrid>
      )}

      {/* Level 1: assessments in course */}
      {course && !assessment && (
        <CardGrid>
          {course.assessments.map((a) => {
            const total = countQuestions(a);
            const all = a.topics.flatMap((t) => t.questions);
            return (
              <DrillCard
                key={a.id}
                title={a.title}
                badge={a.status}
                meta={`${a.code} · ${total} question${total === 1 ? "" : "s"} · ${countApproved(all)} approved`}
                onClick={() => setAssessmentId(a.id)}
              />
            );
          })}
        </CardGrid>
      )}

      {/* Level 2: topics in assessment */}
      {course && assessment && !topic && (
        <div className="flex flex-col gap-4">
          <AddQuestionsPanel
            courseId={course.id}
            assessmentId={assessment.id}
            topics={course.allTopics}
          />
          <CardGrid>
            {assessment.topics.map((t) => (
              <DrillCard
                key={t.id}
                title={t.name}
                meta={`${t.questions.length} question${t.questions.length === 1 ? "" : "s"} · ${countApproved(t.questions)} approved`}
                onClick={() => setTopicId(t.id)}
              />
            ))}
          </CardGrid>
        </div>
      )}

      {/* Level 3: questions in topic, split by review status */}
      {topic && <TopicQuestions key={topic.id} topic={topic} />}
    </div>
  );
}

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "draft", label: "To review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function TopicQuestions({ topic }: { topic: PoolTopic }) {
  const [tab, setTab] = useState<ReviewStatus>("draft");
  const [clearing, startClearing] = useTransition();
  const router = useRouter();
  const path = usePathname();

  const counts: Record<ReviewStatus, number> = {
    draft: 0,
    approved: 0,
    rejected: 0,
  };
  for (const q of topic.questions) counts[q.professor_review_status]++;

  const shown = topic.questions
    .filter((q) => q.professor_review_status === tab)
    .sort((a, b) => (BAND_ORDER[a.difficulty] ?? 9) - (BAND_ORDER[b.difficulty] ?? 9));

  function clearRejected() {
    const ids = topic.questions
      .filter((q) => q.professor_review_status === "rejected")
      .map((q) => q.id);
    startClearing(async () => {
      await deleteQuestions({ ids, path });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl border border-[#444748]/30 bg-[#1b1c1d] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                tab === t.key
                  ? "bg-white text-[#16181a]"
                  : "text-[#c4c7c8] hover:text-[#e3e2e3]"
              }`}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>

        {tab === "rejected" && counts.rejected > 0 && (
          <button
            onClick={clearRejected}
            disabled={clearing}
            className="flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
          >
            {clearing ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Trash2 className="size-3.5" strokeWidth={2} />
            )}
            Clear all rejected
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="glass-panel rounded-2xl border-dashed py-10 text-center text-sm text-[#c4c7c8]/60">
          No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} questions.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((q) => (
            <QuestionReviewCard key={q.id} q={q} deletable={tab === "rejected"} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddQuestionsPanel({
  courseId,
  assessmentId,
  topics,
}: {
  courseId: string;
  assessmentId: string;
  topics: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [counts, setCounts] = useState({ easy: 1, medium: 1, hard: 1 });
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = counts.easy + counts.medium + counts.hard;
  const genKey = `pf-generating-${assessmentId}`;

  // Resume the "Generating…" indicator after navigating away and back —
  // generation runs server-side; its pending state is persisted in localStorage.
  useEffect(() => {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(genKey);
    if (!raw) return;
    let info: { baseline: number; until: number };
    try {
      info = JSON.parse(raw);
    } catch {
      localStorage.removeItem(genKey);
      return;
    }
    if (Date.now() > info.until) {
      localStorage.removeItem(genKey);
      return;
    }
    setGenerating(true);
    void pollUntilDone(info.baseline, info.until);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // Keep the indicator up until questions actually land. The backend writes the
  // whole batch in ONE insert at the end of the run, so the count jumps from
  // `baseline` to `baseline + N` atomically — "count went above baseline" is the
  // reliable done-signal. We do NOT infer "done" from a flat count (the count is
  // flat for the entire run until that final insert), which previously hid the
  // spinner ~12s in, long before the questions appeared. Falls back to a hard
  // deadline so a fully-failed run can't spin forever.
  async function pollUntilDone(baseline: number, until: number) {
    const supabase = createClient();
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 3000));
      const { count } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("assessment_id", assessmentId);
      if ((count ?? 0) > baseline) break; // questions landed → done
    }
    if (typeof window !== "undefined") localStorage.removeItem(genKey);
    setGenerating(false);
    setOpen(false);
    router.refresh();
  }

  if (topics.length === 0) return null;

  if (generating) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center gap-2 rounded-2xl py-6 text-center text-sm text-[#c4c7c8]">
        <span className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          Generating questions…
        </span>
        <span className="text-xs text-[#c4c7c8]/60">
          Runs in the background — the new questions will appear here shortly.
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass-panel flex items-center justify-center gap-2 rounded-2xl border-dashed py-3 text-sm text-[#c4c7c8] transition hover:border-white/20 hover:text-[#e3e2e3]"
      >
        <Plus className="size-4" strokeWidth={2} /> Add questions to this pool
      </button>
    );
  }

  async function generate() {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    if (total === 0) {
      setError("Set at least one question count above zero.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Your session expired — please log in again.");
      setBusy(false);
      return;
    }

    // Baseline count captured BEFORE the run; any increase above it means the
    // generated questions have landed (they're written in a single insert).
    const { count: baselineCount } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessmentId);
    const baseline = baselineCount ?? 0;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          course_id: courseId,
          assessment_id: assessmentId,
          plans: [{ id: topic.id, name: topic.name, ...counts }],
          types: POOL_TYPES,
          instructions: instructions.trim() || null,
        }),
      });
      if (!res.ok) {
        const detail = await res
          .json()
          .then((b) => b?.detail as string)
          .catch(() => null);
        throw new Error(detail || `Request failed (${res.status})`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed — is the API running?");
      setBusy(false);
      return;
    }

    // Persist the pending state so the indicator survives navigation, then poll.
    const until = Date.now() + 180_000;
    if (typeof window !== "undefined")
      localStorage.setItem(genKey, JSON.stringify({ baseline, until }));
    setBusy(false);
    setInstructions("");
    setGenerating(true);
    await pollUntilDone(baseline, until);
  }

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-3 font-display text-lg">Add questions to this pool</div>
      <div className="flex flex-col gap-4">
        <div>
          <label className="font-label-cosmic mb-2 block text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
            Topic
          </label>
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="w-full rounded-lg border border-[#444748]/40 bg-[#16181a] px-3 py-2.5 text-sm text-[#e3e2e3] outline-none transition focus:border-white/40"
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#1b1c1d]">
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
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
                value={counts[band]}
                onChange={(e) =>
                  setCounts((c) => ({ ...c, [band]: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="w-14 rounded-lg border border-[#444748]/40 bg-[#16181a] px-2 py-1.5 text-center text-sm text-[#e3e2e3] outline-none transition focus:border-white/40"
              />
            </label>
          ))}
        </div>
        <textarea
          rows={2}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Optional instructions (style, emphasis, things to avoid)."
          className="w-full resize-none rounded-lg border border-[#444748]/40 bg-[#16181a] px-3 py-2 text-sm text-[#e3e2e3] outline-none transition focus:border-white/40"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            disabled={busy}
            className="rounded-lg border border-[#444748]/40 px-3 py-1.5 text-xs text-[#c4c7c8] transition hover:bg-white/5 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={generate}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#16181a] transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Plus className="size-3.5" strokeWidth={2} />
            )}
            {busy ? "Generating…" : `Generate ${total}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

function DrillCard({
  title,
  meta,
  badge,
  onClick,
}: {
  title: string;
  meta: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-panel group flex items-center justify-between rounded-2xl p-5 text-left transition hover:border-white/20"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-lg">{title}</span>
          {badge && (
            <span
              className={`font-label-cosmic rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                STATUS_STYLES[badge] ?? STATUS_STYLES.draft
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-[#c4c7c8]/70">{meta}</p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-[#c4c7c8]/40 transition group-hover:text-[#e3e2e3]"
        strokeWidth={1.5}
      />
    </button>
  );
}

function Crumb({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={`max-w-[200px] truncate transition ${
        active ? "text-[#e3e2e3]" : "hover:text-[#e3e2e3]"
      }`}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <ChevronLeft className="size-3.5 rotate-180 text-[#c4c7c8]/40" strokeWidth={1.5} />;
}
