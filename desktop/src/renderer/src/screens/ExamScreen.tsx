import { useState } from 'react'
import { SAMPLE_QUESTION, type Assessment, type Student } from '../mock'
import { WorkCapture } from './WorkCapture'

export function ExamScreen({
  assessment,
  student
}: {
  assessment: Assessment
  student: Student
}): React.JSX.Element {
  const q = SAMPLE_QUESTION
  const [answer, setAnswer] = useState('')
  const [captured, setCaptured] = useState(false)

  return (
    <div className="flex h-full flex-col bg-[#060607] text-[#e3e2e3]">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-8 py-4">
        <div className="leading-tight">
          <div className="text-sm font-semibold">{assessment.course}</div>
          <div className="text-[11px] uppercase tracking-widest text-[#c4c7c8]/60">
            {q.topic} · {q.difficulty}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm text-[#c4c7c8]">
            Question <span className="font-semibold text-[#e3e2e3]">{q.index}</span> of {q.total}
          </span>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#1b1c1d] px-4 py-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-mono text-sm tabular-nums">24:08</span>
          </div>
          <span className="text-[11px] uppercase tracking-widest text-[#c4c7c8]/50">
            {student.name}
          </span>
        </div>
      </header>

      {/* Progress */}
      <div className="h-0.5 w-full bg-white/5">
        <div className="h-full bg-white/80" style={{ width: `${(q.index / q.total) * 100}%` }} />
      </div>

      {/* Body */}
      <main className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="flex flex-col gap-6 overflow-y-auto">
          <div className="glass-panel rounded-2xl p-7">
            <div className="mb-4 text-[11px] uppercase tracking-widest text-[#c4c7c8]/50">
              Problem {q.index}
            </div>
            <p className="text-lg leading-relaxed">{q.prompt}</p>
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-widest text-[#c4c7c8]/60">
              Your final answer
            </label>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="e.g. 2447 J/K"
              className="w-full select-text rounded-xl border border-white/10 bg-[#1b1c1d] px-5 py-4 text-lg outline-none transition focus:border-white/40"
            />
            <p className="mt-2 text-xs text-[#c4c7c8]/50">
              Enter your final answer with units. Submit your handwritten work on the right.
            </p>
          </div>
        </section>

        <section className="flex flex-col">
          <div className="glass-panel flex flex-1 flex-col rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your work</h2>
              <span className="text-[11px] uppercase tracking-widest text-[#c4c7c8]/50">
                Document camera
              </span>
            </div>
            <WorkCapture onChange={setCaptured} />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-white/5 px-8 py-4">
        <span className="text-[11px] uppercase tracking-widest text-[#c4c7c8]/40">
          Locked session · TA-proctored
        </span>
        <button
          disabled={!answer || !captured}
          className="rounded-xl bg-white px-7 py-3 text-sm font-semibold text-[#16181a] transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit &amp; continue
        </button>
      </footer>
    </div>
  )
}
