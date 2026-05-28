import { useState, useEffect, useRef } from 'react'

/**
 * Tracks elapsed seconds since `active` became true.
 * - Pauses when the browser tab is hidden.
 * - Resets to 0 whenever `resetKey` changes.
 *
 * @param active  Whether the timer should be running (false = paused).
 * @param resetKey  Increment this to restart the timer from 0 (e.g. on new game).
 * @returns Elapsed seconds (integer).
 */
export function useTimer(active: boolean, resetKey: number): number {
  const [elapsed, setElapsed] = useState(0)
  // Wall-clock timestamp when the current run started (null = paused)
  const startRef = useRef<number | null>(null)
  // Seconds accumulated from previous runs (before the latest pause/resume)
  const accRef = useRef(0)

  // Hard reset on new game
  useEffect(() => {
    accRef.current = 0
    startRef.current = active ? Date.now() : null
    setElapsed(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Start / pause on active changes (and after reset)
  useEffect(() => {
    if (!active) {
      // Freeze: bank the time accumulated so far
      if (startRef.current !== null) {
        accRef.current += Math.floor((Date.now() - startRef.current) / 1000)
        startRef.current = null
      }
      return
    }

    // Resume
    if (startRef.current === null) startRef.current = Date.now()

    const id = setInterval(() => {
      if (startRef.current === null) return
      setElapsed(accRef.current + Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, resetKey])

  // Pause on tab visibility change
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (startRef.current !== null) {
          accRef.current += Math.floor((Date.now() - startRef.current) / 1000)
          startRef.current = null
        }
      } else if (active) {
        // Resume only if timer was running
        startRef.current = Date.now()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [active])

  return elapsed
}
