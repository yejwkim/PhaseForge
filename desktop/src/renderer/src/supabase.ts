import { createClient } from '@supabase/supabase-js'

// Anonymous client for the kiosk — no student login. Access is limited to the
// public `validate_assessment_code` RPC; everything else is gated by RLS.
export const supabase = createClient(
  import.meta.env.RENDERER_VITE_SUPABASE_URL,
  import.meta.env.RENDERER_VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
)

export type ValidatedAssessment = {
  id: string
  title: string
  course_title: string
  questions: number
  minutes: number
  topics: string[]
}

/** Returns the assessment for a valid, open code, or null if the code is wrong/closed. */
export async function validateCode(code: string): Promise<ValidatedAssessment | null> {
  const { data, error } = await supabase.rpc('validate_assessment_code', {
    p_code: code.trim()
  })
  if (error) throw error
  const row = (data as ValidatedAssessment[] | null)?.[0]
  return row ?? null
}
