"use client";

import { SvgFigure } from "@/components/dashboard/svg-figure";

export type QuestionType = "mcq" | "short_answer" | "essay";

// Matches the phase2.generated_question.v1 contract returned by /generate.
export type GeneratedQuestion = {
  generated_question_id: string;
  question_type: QuestionType;
  topic: string;
  difficulty: string;
  learning_objective: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  rubric: string[];
  figure_svg?: string;
};

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  short_answer: "Short answer",
  essay: "Essay",
};

export function QuestionResults({ questions }: { questions: GeneratedQuestion[] }) {
  if (questions.length === 0) {
    return (
      <div className="glass-panel rounded-2xl border-dashed py-10 text-center text-sm text-[#c4c7c8]/70">
        No questions were generated. Try different topics or upload more material
        first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-label-cosmic text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
        {questions.length} question{questions.length === 1 ? "" : "s"} generated ·
        saved to this assessment
      </p>
      {questions.map((q, i) => (
        <QuestionCard key={q.generated_question_id ?? i} q={q} index={i + 1} />
      ))}
    </div>
  );
}

function QuestionCard({ q, index }: { q: GeneratedQuestion; index: number }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-display text-sm text-[#e3e2e3]">Q{index}</span>
        <span className="rounded-full border border-[#444748]/40 px-2.5 py-0.5 text-[11px] text-[#c4c7c8]">
          {TYPE_LABEL[q.question_type] ?? q.question_type}
        </span>
        {q.difficulty && (
          <span className="rounded-full border border-[#444748]/40 px-2.5 py-0.5 text-[11px] text-[#c4c7c8]">
            {q.difficulty}
          </span>
        )}
        {q.topic && (
          <span className="rounded-full border border-[#444748]/40 px-2.5 py-0.5 text-[11px] text-[#c4c7c8]">
            {q.topic}
          </span>
        )}
      </div>

      {q.learning_objective && (
        <p className="mb-2 text-xs text-[#c4c7c8]/60">
          <span className="uppercase tracking-wider">Objective:</span>{" "}
          {q.learning_objective}
        </p>
      )}

      <p className="whitespace-pre-wrap text-sm text-[#e3e2e3]">{q.prompt}</p>
      <SvgFigure svg={q.figure_svg} />

      {q.options?.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {q.options.map((opt, i) => {
            const correct = opt === q.answer;
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

      <div className="mt-4 rounded-lg border border-[#444748]/30 bg-[#1b1c1d] p-3">
        <p className="font-label-cosmic mb-1 text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
          Answer key
        </p>
        <p className="whitespace-pre-wrap text-sm text-[#e3e2e3]">{q.answer}</p>
        {q.explanation && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-[#c4c7c8]/80">
            {q.explanation}
          </p>
        )}
        {q.rubric?.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-[#c4c7c8]/80">
            {q.rubric.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
