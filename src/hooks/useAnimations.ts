/**
 * @module useAnimations
 * Single source of truth for "should this animation play right now?".
 *
 * Combines the player's explicit in-app preference (`animationsEnabled`) with
 * the operating-system accessibility setting `prefers-reduced-motion`. Either
 * one being "off / reduce" suppresses motion.
 *
 * Components should read {@link useAnimations} instead of `animationsEnabled`
 * directly so the OS reduced-motion preference is honoured everywhere.
 */

import { useEffect, useState } from 'react'
import { useOptionsStore } from '../store/useOptionsStore'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Reactive boolean for the OS `prefers-reduced-motion: reduce` setting.
 * Updates live if the user changes the system preference.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * Whether decorative/movement animations should play.
 *
 * `true` only when the player has animations enabled AND the OS is not asking
 * for reduced motion. Use this everywhere in place of the raw
 * `animationsEnabled` option.
 */
export function useAnimations(): boolean {
  const animationsEnabled = useOptionsStore((s) => s.animationsEnabled)
  const prefersReduced = usePrefersReducedMotion()
  return animationsEnabled && !prefersReduced
}
