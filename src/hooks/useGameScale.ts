import { useState, useEffect } from 'react'
import { CANVAS_W, CANVAS_H } from '../constants/canvas'

/**
 * Returns the uniform CSS scale factor needed to fit the fixed-size game
 * canvas (`CANVAS_W × CANVAS_H`) inside the current browser viewport.
 *
 * The scale is re-calculated whenever the viewport dimensions change using a
 * `ResizeObserver` on `<html>` (more reliable than `window.resize` on mobile).
 *
 * @returns A number in `(0, ∞]` — typically well below `1` on small screens
 *          and near `1` on desktop.
 */
export function useGameScale(): number {
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)
  )

  useEffect(() => {
    const update = () =>
      setScale(Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H))

    // ResizeObserver on <html> is more reliable than window.resize on mobile
    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])

  return scale
}
