import { useState } from 'react'
import { type Assessment, type Student } from './mock'
import { CodeScreen } from './screens/CodeScreen'
import { IdentifyScreen } from './screens/IdentifyScreen'
import { ConsentScreen } from './screens/ConsentScreen'
import { ExamScreen } from './screens/ExamScreen'

type Step = 'code' | 'identify' | 'consent' | 'exam'

function App(): React.JSX.Element {
  const [step, setStep] = useState<Step>('code')
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [student, setStudent] = useState<Student | null>(null)

  if (step === 'code') {
    return (
      <CodeScreen
        onResolved={(a) => {
          setAssessment(a)
          setStep('identify')
        }}
      />
    )
  }

  if (step === 'identify' && assessment) {
    return (
      <IdentifyScreen
        assessment={assessment}
        onBack={() => setStep('code')}
        onConfirm={(s) => {
          setStudent(s)
          setStep('consent')
        }}
      />
    )
  }

  if (step === 'consent' && assessment && student) {
    return (
      <ConsentScreen
        assessment={assessment}
        student={student}
        onBegin={async () => {
          await window.api?.lockdown?.engage()
          setStep('exam')
        }}
      />
    )
  }

  if (step === 'exam' && assessment && student) {
    return (
      <ExamScreen
        assessment={assessment}
        student={student}
        onExit={async () => {
          await window.api?.lockdown?.disengage()
          setStudent(null)
          setAssessment(null)
          setStep('code')
        }}
      />
    )
  }

  return <CodeScreen onResolved={(a) => { setAssessment(a); setStep('identify') }} />
}

export default App
