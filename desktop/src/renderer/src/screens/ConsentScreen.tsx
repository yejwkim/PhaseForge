import { useState } from 'react'
import { type Assessment, type Student } from '../mock'
import { Centered } from './CodeScreen'

export function ConsentScreen({
  assessment,
  student,
  onBegin
}: {
  assessment: Assessment
  student: Student
  onBegin: () => void
}): React.JSX.Element {
  const [agreed, setAgreed] = useState(false)

  return (
    <Centered>
      <div className="glass-panel w-full max-w-lg rounded-2xl p-8">
        <p className="text-[11px] uppercase tracking-widest text-[#c4c7c8]/60">
          {student.name} · {student.studentNumber}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{assessment.title}</h1>
        <p className="mt-1 text-sm text-[#c4c7c8]">{assessment.course}</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { k: 'Questions', v: String(assessment.questions) },
            { k: 'Time limit', v: `${assessment.minutes} min` },
            { k: 'Topics', v: String(assessment.topics.length) }
          ].map((s) => (
            <div key={s.k} className="rounded-xl border border-white/10 bg-[#1b1c1d] p-4 text-center">
              <div className="text-xl font-semibold">{s.v}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-[#c4c7c8]/60">
                {s.k}
              </div>
            </div>
          ))}
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#1b1c1d] p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-4 accent-white"
          />
          <span className="text-sm text-[#c4c7c8]">
            I consent to the document camera capturing photos of my handwritten work. Images
            are used only to adjust question difficulty — not for grading or surveillance.
          </span>
        </label>

        <button
          onClick={onBegin}
          disabled={!agreed}
          className="mt-6 w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-[#16181a] transition hover:opacity-90 active:scale-[0.99] disabled:opacity-40"
        >
          Begin assessment
        </button>
      </div>
    </Centered>
  )
}
