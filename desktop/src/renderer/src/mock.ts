// Mock data — replaced by the real backend (assessment codes + roster) in Phase 3.

export type Student = {
  id: string
  name: string
  studentNumber: string
}

export type Assessment = {
  id: string
  code: string
  course: string
  title: string
  questions: number
  minutes: number
  topics: string[]
}

export type Question = {
  index: number
  total: number
  topic: string
  difficulty: string
  prompt: string
}

export const ROSTER: Student[] = [
  { id: '1', name: 'Jane Doe', studentNumber: 'UT-204113' },
  { id: '2', name: 'Marcus Lee', studentNumber: 'UT-209847' },
  { id: '3', name: 'Priya Nair', studentNumber: 'UT-211002' },
  { id: '4', name: 'Diego Alvarez', studentNumber: 'UT-198330' },
  { id: '5', name: 'Sofia Rossi', studentNumber: 'UT-215576' },
  { id: '6', name: 'Chen Wei', studentNumber: 'UT-220419' }
]

export const SAMPLE_QUESTION: Question = {
  index: 1,
  total: 15,
  topic: 'Entropy',
  difficulty: 'Medium',
  prompt:
    'A 2.0 kg block of ice at 0 °C melts completely into water at 0 °C. The latent heat of fusion is 334 kJ/kg. Calculate the change in entropy of the ice–water system during melting.'
}
