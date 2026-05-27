import { useState, useEffect } from 'react'
import { CANVAS_W, CANVAS_H, CANVAS_W_PORTRAIT, CANVAS_H_PORTRAIT } from '../constants/canvas'

/** Return value from {@link useGameScale}. */
export interface GameLayout {
  /** Uniform CSS scale factor to fit the canvas inside the viewport. */
  scale: number
  /** True when the viewport is taller than it is wide (portrait orientation). */
  isPortrait: boolean
}

/**
 * Returns the uniform CSS scale factor needed to fit the fixed-size game
 * canvas inside the current browser viewport, along with the current
 * orientation. Landscape uses an 844 × 390 canvas; portrait uses 390 × 750.
 *
 * The layout is re-calculated whenever the viewport dimensions change using a
 * `ResizeObserver` on `<html>` (more reliable than `window.resize` on mobile).
 */
export function useGameScale(): GameLayout {
  const [layout, setLayout] = useState<GameLayout>(() => {
    const portrait = window.innerHeight > window.innerWidth
    const scale = portrait
      ? Math.min(window.innerWidth / CANVAS_W_PORTRAIT, window.innerHeight / CANVAS_H_PORTRAIT)
      : Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)
    return { scale, isPortrait: portrait }
  })

  useEffect(() => {
    const update = () => {
      const portrait = window.innerHeight > window.innerWidth
      const scale = portrait
        ? Math.min(window.innerWidth / CANVAS_W_PORTRAIT, window.innerHeight / CANVAS_H_PORTRAIT)
        : Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)
      setLayout({ scale, isPortrait: portrait })
    }

    // ResizeObserver on <html> is more reliable than window.resize on mobile
    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])

  return layout
}
