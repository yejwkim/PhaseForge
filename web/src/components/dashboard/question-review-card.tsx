"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, RefreshCw, Trash2, X } from "lucide-react";

import {
  deleteQuestion,
  setQuestionStatus,
} from "@/app/(dashboard)/assessments/actions";
import { createClient } from "@/lib/supabase/client";
import { SvgFigure } from "@/components/dashboard/svg-figure";

export type ReviewStatus = "draft" | "approved" | "rejected";

export type PoolQuestion = {
  id: string;
  type: "mcq" | "short_answer" | "essay";
  topic: string;
  difficulty: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  rubric: string[];
  figure_svg?: string;
  professor_review_status: ReviewStatus;
};

type Candidate = {
  question_type: "mcq" | "short_answer" | "essay";
  topic: string;
  difficulty: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  rubric: string[];
  learning_objective: string;
  figure_svg?: string;
};

const TYPE_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  short_answer: "Short answer",
  essay: "Essay",
};

export function QuestionReviewCard({
  q,
  deletable = false,
}: {
  q: PoolQuestion;
  deletable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const path = usePathname();

  const [recreating, setRecreating] = useState(false);
  const [instr, setInstr] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  function review(status: ReviewStatus) {
    startTransition(async () => {
      await setQuestionStatus({ id: q.id, status, path });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteQuestion({ id: q.id, path });
      router.refresh();
    });
  }

  async function authedFetch(endpoint: string, body: unknown) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session expired — please log in again.");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res
        .json()
        .then((b) => b?.detail as string)
        .catch(() => null);
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function regenerate() {
    setRegenBusy(true);
    setError(null);
    try {
      const data = (await authedFetch("/regenerate", {
        question_id: q.id,
        instructions: instr.trim() || null,
      })) as Candidate;
      setCandidate(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed.");
    } finally {
      setRegenBusy(false);
    }
  }

  async function accept() {
    if (!candidate) return;
    setApplyBusy(true);
    setError(null);
    try {
      await authedFetch("/questions/apply", {
        question_id: q.id,
        question_type: candidate.question_type,
        topic: candidate.topic,
        difficulty: candidate.difficulty,
        prompt: candidate.prompt,
        options: candidate.options,
        answer: candidate.answer,
        explanation: candidate.explanation,
        rubric: candidate.rubric,
        learning_objective: candidate.learning_objective,
        figure_svg: candidate.figure_svg ?? "",
      });
      resetRecreate();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setApplyBusy(false);
    }
  }

  function resetRecreate() {
    setRecreating(false);
    setCandidate(null);
    setInstr("");
    setError(null);
  }

  const busy = regenBusy || applyBusy;
  const ring =
    q.professor_review_status === "approved"
      ? "border-emerald-500/30"
      : q.professor_review_status === "rejected"
        ? "border-red-500/20 opacity-60"
        : "border-[#444748]/30";

  return (
    <div className={`glass-panel rounded-2xl border p-5 ${ring}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#444748]/40 px-2.5 py-0.5 text-[11px] text-[#c4c7c8]">
          {TYPE_LABEL[q.type] ?? q.type}
        </span>
        <span className="rounded-full border border-[#444748]/40 px-2.5 py-0.5 text-[11px] text-[#c4c7c8]">
          {q.difficulty}
        </span>
        <StatusBadge status={q.professor_review_status} />
        <div className="ml-auto flex gap-2">
          {deletable && (
            <button
              onClick={remove}
              disabled={pending}
              className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
            >
              <Trash2 className="size-3.5" strokeWidth={2} /> Delete
            </button>
          )}
          <button
            onClick={() => (recreating ? resetRecreate() : setRecreating(true))}
            disabled={pending}
            className="flex items-center gap-1 rounded-lg border border-[#444748]/40 px-2.5 py-1 text-xs text-[#c4c7c8] transition hover:bg-white/5 hover:text-[#e3e2e3] disabled:opacity-40"
          >
            <RefreshCw className="size-3.5" strokeWidth={2} /> Recreate
          </button>
          <button
            onClick={() => review("approved")}
            disabled={pending || q.professor_review_status === "approved"}
            className="flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-40"
          >
            <Check className="size-3.5" strokeWidth={2} /> Approve
          </button>
          <button
            onClick={() => review("rejected")}
            disabled={pending || q.professor_review_status === "rejected"}
            className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
          >
            <X className="size-3.5" strokeWidth={2} /> Reject
          </button>
        </div>
      </div>

      <QuestionBody
        prompt={q.prompt}
        options={q.options}
        answer={q.answer}
        explanation={q.explanation}
        rubric={q.rubric}
        figureSvg={q.figure_svg}
        open={open}
        onToggle={() => setOpen((o) => !o)}
      />

      {recreating && (
        <div className="mt-3 rounded-xl border border-[#444748]/30 bg-[#1b1c1d] p-4">
          <label className="font-label-cosmic mb-2 block text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
            Recreate with instructions (optional)
          </label>
          <textarea
            rows={2}
            value={instr}
            onChange={(e) => setInstr(e.target.value)}
            placeholder="e.g. Make it harder; use a real-world scenario; avoid recursion."
            className="w-full resize-none rounded-lg border border-[#444748]/40 bg-[#16181a] px-3 py-2 text-sm text-[#e3e2e3] outline-none transition focus:border-white/40"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          {!candidate ? (
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={resetRecreate}
                disabled={busy}
                className="rounded-lg border border-[#444748]/40 px-3 py-1.5 text-xs text-[#c4c7c8] transition hover:bg-white/5 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={regenerate}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#16181a] transition hover:opacity-90 disabled:opacity-50"
              >
                {regenBusy ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <RefreshCw className="size-3.5" strokeWidth={2} />
                )}
                {regenBusy ? "Generating…" : "Generate preview"}
              </button>
            </div>
          ) : (
            <>
              {/* Comparison */}
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <ComparePane
                  label="Current"
                  tone="muted"
                  meta={`${TYPE_LABEL[q.type] ?? q.type} · ${q.difficulty} · ${q.topic}`}
                >
                  <QuestionBody
                    prompt={q.prompt}
                    options={q.options}
                    answer={q.answer}
                    explanation={q.explanation}
                    rubric={q.rubric}
                    figureSvg={q.figure_svg}
                    open
                  />
                </ComparePane>
                <ComparePane
                  label="New candidate"
                  tone="fresh"
                  meta={`${TYPE_LABEL[candidate.question_type] ?? candidate.question_type} · ${candidate.difficulty} · ${candidate.topic}`}
                >
                  <QuestionBody
                    prompt={candidate.prompt}
                    options={candidate.options}
                    answer={candidate.answer}
                    explanation={candidate.explanation}
                    rubric={candidate.rubric}
                    figureSvg={candidate.figure_svg}
                    open
                  />
                </ComparePane>
              </div>

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  onClick={resetRecreate}
                  disabled={busy}
                  className="rounded-lg border border-[#444748]/40 px-3 py-1.5 text-xs text-[#c4c7c8] transition hover:bg-white/5 disabled:opacity-40"
                >
                  Keep original
                </button>
                <button
                  onClick={regenerate}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-lg border border-[#444748]/40 px-3 py-1.5 text-xs text-[#e3e2e3] transition hover:bg-white/5 disabled:opacity-40"
                >
                  {regenBusy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <RefreshCw className="size-3.5" strokeWidth={2} />
                  )}
                  Regenerate again
                </button>
                <button
                  onClick={accept}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#16181a] transition hover:opacity-90 disabled:opacity-50"
                >
                  {applyBusy ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Check className="size-3.5" strokeWidth={2} />
                  )}
                  Accept new
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionBody({
  prompt,
  options,
  answer,
  explanation,
  rubric,
  figureSvg,
  open,
  onToggle,
}: {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  rubric: string[];
  figureSvg?: string;
  open: boolean;
  onToggle?: () => void;
}) {
  return (
    <>
      <p className="whitespace-pre-wrap text-sm text-[#e3e2e3]">{prompt}</p>
      <SvgFigure svg={figureSvg} />

      {options?.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {options.map((opt, i) => {
            const correct = opt === answer;
            return (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  correct
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-[#444748]/40 text-[#c4c7c8]"
                }`}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </li>
            );
          })}
        </ul>
      )}

      {onToggle && (
        <button
          onClick={onToggle}
          className="mt-3 flex items-center gap-1 text-xs text-[#c4c7c8]/70 transition hover:text-[#e3e2e3]"
        >
          <ChevronDown
            className={`size-3.5 transition ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
          Answer key
        </button>
      )}
      {open && (
        <div className="mt-2 rounded-lg border border-[#444748]/30 bg-[#16181a] p-3">
          <p className="whitespace-pre-wrap text-sm text-[#e3e2e3]">{answer}</p>
          {explanation && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-[#c4c7c8]/80">
              {explanation}
            </p>
          )}
          {rubric?.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-[#c4c7c8]/80">
              {rubric.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function ComparePane({
  label,
  tone,
  meta,
  children,
}: {
  label: string;
  tone: "muted" | "fresh";
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "fresh" ? "border-emerald-500/30" : "border-[#444748]/30 opacity-80"
      }`}
    >
      <div className="font-label-cosmic text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
        {label}
      </div>
      {meta && <div className="mb-2 text-[11px] text-[#c4c7c8]/70">{meta}</div>}
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "approved")
    return (
      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300">
        Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-[11px] text-red-300">
        Rejected
      </span>
    );
  return (
    <span className="rounded-full border border-[#444748]/40 px-2.5 py-0.5 text-[11px] text-[#c4c7c8]/70">
      To review
    </span>
  );
}
