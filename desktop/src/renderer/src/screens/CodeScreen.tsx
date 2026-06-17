import { useState } from 'react'
import { resolveAssessment, type Assessment } from '../mock'

export function CodeScreen({ onResolved }: { onResolved: (a: Assessment) => void }): React.JSX.Element {
  const [code, setCode] = useState('')

  function submit(): void {
    if (!code.trim()) return
    onResolved(resolveAssessment(code.trim()))
  }

  return (
    <Centered>
      <div className="glass-panel w-full max-w-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold">Enter assessment code</h1>
        <p className="mt-2 text-sm text-[#c4c7c8]">
          Your proctor will provide the code for today&apos;s exam.
        </p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. PHYS201-MID"
          className="mt-6 w-full select-text rounded-xl border border-white/10 bg-[#1b1c1d] px-5 py-4 text-center text-xl tracking-widest outline-none transition focus:border-white/40"
        />
        <button
          onClick={submit}
          disabled={!code.trim()}
          className="mt-5 w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-[#16181a] transition hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </Centered>
  )
}

export function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="mb-8 font-semibold tracking-wide text-[#e3e2e3]">PhaseForge</div>
      {children}
      <p className="mt-8 text-[11px] uppercase tracking-widest text-[#c4c7c8]/40">
        Exam station · TA-proctored
      </p>
    </div>
  )
}
