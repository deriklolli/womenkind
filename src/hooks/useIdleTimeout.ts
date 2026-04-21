'use client'

import { useEffect, useRef } from 'react'

interface UseIdleTimeoutOptions {
  /** Milliseconds of inactivity before onTimeout fires. */
  timeoutMs: number
  /** Called once when the idle threshold is reached. */
  onTimeout: () => void
  /** When false, no listeners or timers are registered. */
  enabled: boolean
}

// Events that reset the idle timer. Pointer/keyboard/scroll cover normal
// interaction; visibilitychange catches tab focus returns after long absences.
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'click',
  'scroll',
  'touchstart',
  'visibilitychange',
] as const

// Throttle how often activity events reset the underlying setTimeout. Without
// this, a single mousemove burst would schedule thousands of setTimeouts.
const RESET_THROTTLE_MS = 1000

/**
 * Fires `onTimeout` after `timeoutMs` of no user activity. Used for HIPAA
 * §164.312(a)(2)(iii) automatic logoff from PHI-bearing pages.
 *
 * The hook is idempotent on re-renders and safe to mount in a layout — when
 * `enabled` is false (e.g., during auth-check spinner or on login pages) it
 * registers nothing.
 */
export function useIdleTimeout({ timeoutMs, onTimeout, enabled }: UseIdleTimeoutOptions) {
  // Keep onTimeout in a ref so callers can pass inline lambdas without causing
  // the listener/timer to tear down and rebuild on every render.
  const onTimeoutRef = useRef(onTimeout)
  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let lastResetAt = 0
    let fired = false

    const scheduleTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (fired) return
        fired = true
        onTimeoutRef.current()
      }, timeoutMs)
    }

    const handleActivity = () => {
      if (fired) return
      const now = Date.now()
      if (now - lastResetAt < RESET_THROTTLE_MS) return
      lastResetAt = now
      scheduleTimeout()
    }

    scheduleTimeout()
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [enabled, timeoutMs])
}
