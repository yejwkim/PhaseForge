import { useEffect, useState } from 'react'

// Matches main: renderer guards (key blocking, focus overlay) are off in dev.
const LOCKDOWN_IN_DEV = false

/**
 * Renderer-side exam guards: blocks context menu / copy-paste / refresh keys
 * and reports focus-loss events. The NATIVE lockdown (kiosk + shortcut
 * blocking) is engaged/disengaged on the exam transition in App, not here —
 * tying it to mount would double-toggle under React StrictMode and drop kiosk.
 */
export function useLockdown(): { focusLost: boolean; violations: number } {
  const [focusLost, setFocusLost] = useState(false)
  const [violations, setViolations] = useState(0)

  useEffect(() => {
    if (import.meta.env.DEV && !LOCKDOWN_IN_DEV) return // dev: skip guards/overlay

    const offFocus = window.api?.lockdown?.onFocusChange((focused) => {
      setFocusLost(!focused)
      if (!focused) setViolations((v) => v + 1)
    })

    const block = (e: Event): void => e.preventDefault()
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase()
      const mod = e.metaKey || e.ctrlKey
      if (mod && ['r', 'w', 'q', 'm', 'h', 'p', 's', 'f', 'c', 'x', 'v', 'a'].includes(k)) {
        e.preventDefault()
      }
      if (['f5', 'f11', 'f12'].includes(k)) e.preventDefault()
    }

    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    document.addEventListener('paste', block)
    document.addEventListener('dragstart', block)
    document.addEventListener('keydown', onKey, true)

    return () => {
      offFocus?.()
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('paste', block)
      document.removeEventListener('dragstart', block)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [])

  return { focusLost, violations }
}
