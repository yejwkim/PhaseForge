import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";

import { deleteAssessment } from "@/app/(dashboard)/assessments/actions";
import { CopyButton } from "@/components/dashboard/copy-button";
import { PoolSummary } from "@/components/dashboard/pool-summary";
import { type PoolQuestion } from "@/components/dashboard/question-review-card";
import { createClient } from "@/lib/supabase/server";

type Assessment = {
  id: string;
  title: string;
  code: string;
  status: string;
  window_open: string | null;
  window_close: string | null;
  config_json: {
    questions?: number;
    minutes?: number;
    topics?: string[];
    difficulty?: { easy: number; medium: number; hard: number };
    instructions?: string;
  } | null;
  course: { title: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#343536] text-[#c4c7c8] border-[#444748]/30",
  open: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  closed: "bg-red-500/10 text-red-400 border-red-500/20",
};

function fmt(s: string | null): string {
  return s
    ? new Date(s).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select(
      "id, title, code, status, window_open, window_close, config_json, course:courses(title)",
    )
    .eq("id", id)
    .maybeSingle();

  const a = data as Assessment | null;
  if (!a) notFound();

  const { data: questionData } = await supabase
    .from("questions")
    .select(
      "id, type, topic, difficulty, prompt, options, answer, explanation, rubric, professor_review_status",
    )
    .eq("assessment_id", id)
    .order("topic", { ascending: true })
    .order("created_at", { ascending: true });

  const questions = (questionData ?? []) as PoolQuestion[];
  const poolCount = questions.length;
  const approvedCount = questions.filter(
    (q) => q.professor_review_status === "approved",
  ).length;

  const cfg = a.config_json ?? {};
  const topics = cfg.topics ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/assessments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[#c4c7c8] transition hover:text-[#e3e2e3]"
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} />
        Assessments
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[32px] leading-tight tracking-tight">
              {a.title}
            </h1>
            <span
              className={`font-label-cosmic rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${
                STATUS_STYLES[a.status] ?? STATUS_STYLES.draft
              }`}
            >
              {a.status}
            </span>
          </div>
          <p className="mt-1 text-[#c4c7c8]">{a.course?.title ?? "—"}</p>
        </div>
      </div>

      {/* Code */}
      <div className="glass-panel mb-5 flex items-center justify-between rounded-2xl p-6">
        <div>
          <div className="font-label-cosmic mb-2 text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
            Access code · share with students
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-4xl tracking-[0.18em]">
              {a.code}
            </span>
            <CopyButton value={a.code} />
          </div>
        </div>
      </div>

      <div className="glass-panel mb-5 rounded-2xl p-6">
        <div className="font-label-cosmic mb-3 text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
          Window
        </div>
        <p className="text-sm text-[#e3e2e3]">
          {a.window_open || a.window_close
            ? `${fmt(a.window_open)} → ${fmt(a.window_close)}`
            : "Always open"}
        </p>
      </div>

      <div className="glass-panel mb-5 rounded-2xl p-6">
        <div className="font-label-cosmic mb-3 text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
          Topics ({topics.length})
        </div>
        {topics.length === 0 ? (
          <p className="text-sm text-[#c4c7c8]/60">No topics selected.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#444748]/40 px-3 py-1 text-sm text-[#c4c7c8]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {cfg.instructions && (
        <div className="glass-panel mb-5 rounded-2xl p-6">
          <div className="font-label-cosmic mb-3 text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
            Custom instructions
          </div>
          <p className="text-sm leading-relaxed text-[#c4c7c8]">
            {cfg.instructions}
          </p>
        </div>
      )}

      {/* Pool lives in Question Pools now */}
      <div className="glass-panel mb-5 flex items-center justify-between rounded-2xl p-6">
        <div>
          <div className="font-label-cosmic mb-1 text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
            Question pool
          </div>
          <PoolSummary
            assessmentId={a.id}
            initialCount={poolCount}
            initialApproved={approvedCount}
          />
        </div>
        <Link
          href="/question-pools"
          className="rounded-xl border border-[#444748]/40 px-4 py-2 text-sm text-[#e3e2e3] transition hover:bg-[#1b1c1d]"
        >
          Review in Question Pools
        </Link>
      </div>

      <form action={deleteAssessment} className="flex justify-end pt-2">
        <input type="hidden" name="id" value={a.id} />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl border border-red-500/20 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
        >
          <Trash2 className="size-4" strokeWidth={1.5} />
          Delete assessment
        </button>
      </form>
    </div>
  );
}
