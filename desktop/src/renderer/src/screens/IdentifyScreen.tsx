import { useMemo, useState } from 'react'
import { ROSTER, type Assessment, type Student } from '../mock'
import { Centered } from './CodeScreen'

export function IdentifyScreen({
  assessment,
  onConfirm,
  onBack
}: {
  assessment: Assessment
  onConfirm: (s: Student) => void
  onBack: () => void
}): React.JSX.Element {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Student | null>(null)

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return ROSTER.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.studentNumber.toLowerCase().includes(term)
    ).slice(0, 5)
  }, [q])

  if (picked) {
    return (
      <Centered>
        <div className="glass-panel w-full max-w-md rounded-2xl p-8 text-center">
          <p className="text-[11px] uppercase tracking-widest text-[#c4c7c8]/60">
            Confirm your identity
          </p>
          <h1 className="mt-4 text-2xl font-semibold">{picked.name}</h1>
          <p className="mt-1 font-mono text-sm text-[#c4c7c8]">{picked.studentNumber}</p>
          <p className="mt-6 text-sm text-[#c4c7c8]/70">
            Starting <span className="text-[#e3e2e3]">{assessment.title}</span>. Show your
            student ID to the proctor.
          </p>
          <div className="mt-7 flex gap-3">
            <button
              onClick={() => setPicked(null)}
              className="flex-1 rounded-xl border border-white/10 py-3 text-sm text-[#c4c7c8] transition hover:bg-white/5"
            >
              Not me
            </button>
            <button
              onClick={() => onConfirm(picked)}
              className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-[#16181a] transition hover:opacity-90 active:scale-[0.99]"
            >
              That&apos;s me
            </button>
          </div>
        </div>
      </Centered>
    )
  }

  return (
    <Centered>
      <div className="glass-panel w-full max-w-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold">Find your name</h1>
        <p className="mt-2 text-sm text-[#c4c7c8]">
          Type your name or student ID to match the class roster.
        </p>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or student ID"
          className="mt-6 w-full select-text rounded-xl border border-white/10 bg-[#1b1c1d] px-5 py-4 outline-none transition focus:border-white/40"
        />

        <div className="mt-3 flex flex-col gap-2">
          {q.trim() && matches.length === 0 && (
            <p className="px-1 text-sm text-[#c4c7c8]/50">
              No roster match — check spelling or ask your proctor.
            </p>
          )}
          {matches.map((s) => (
            <button
              key={s.id}
              onClick={() => setPicked(s)}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1b1c1d] px-4 py-3 text-left transition hover:border-white/30"
            >
              <span className="text-sm font-medium">{s.name}</span>
              <span className="font-mono text-xs text-[#c4c7c8]/60">{s.studentNumber}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onBack}
          className="mt-6 text-xs text-[#c4c7c8]/50 underline-offset-2 hover:underline"
        >
          ← Back to code
        </button>
      </div>
    </Centered>
  )
}
