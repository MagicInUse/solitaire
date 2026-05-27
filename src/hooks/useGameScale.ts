import { useState, useEffect } from 'react'
import {
  CANVAS_W, CANVAS_H,
  CANVAS_W_PORTRAIT, CANVAS_H_PORTRAIT,
} from '../constants/canvas'

/**
 * Maximum CSS scale factor applied to the game canvas.
 *
 * On small screens the canvas scales down to fit; on large screens the scale
 * is capped here so the playfield stays a comfortable size and the surrounding
 * felt "world" border becomes visible — reserved for future ambient decorations.
 *
 * With the 390 × 390 landscape canvas, uncapped scale = min(vw, vh) / 390.
 * iPad Air (1180 × 820): scale ≈ 2.10 → cards render ~101 px wide.
 * Desktop 1920 × 1080: scale capped at 2.5 → cards render 120 px wide.
 */
export const MAX_SCALE = 2.5

/**
 * The two layout modes the game can be in.
 * - `portrait`:   viewport is taller than wide (phone/tablet held upright)
 * - `landscape`:  viewport is wider than tall (phone/tablet/desktop)
 */
export type GameLayoutMode = 'portrait' | 'landscape'

/** Return value from {@link useGameScale}. */
export interface GameLayout {
  /** Uniform CSS scale factor, capped at {@link MAX_SCALE}. */
  scale: number
  /** Current layout mode — drives canvas dimensions. */
  layout: GameLayoutMode
}

function computeLayout(): GameLayout {
  const w = window.innerWidth
  const h = window.innerHeight

  if (h > w) {
    return {
      scale: Math.min(w / CANVAS_W_PORTRAIT, h / CANVAS_H_PORTRAIT, MAX_SCALE),
      layout: 'portrait',
    }
  }
  // Landscape (all sizes): square 390 × 390 canvas. Scale = min(vw, vh) / 390.
  // Since w > h in landscape, height is always the constraining dimension.
  return {
    scale: Math.min(w / CANVAS_W, h / CANVAS_H, MAX_SCALE),
    layout: 'landscape',
  }
}

/**
 * Returns the uniform CSS scale factor needed to fit the fixed-size game
 * canvas inside the current browser viewport, along with the current layout
 * mode. Recalculates whenever the viewport dimensions change via a
 * `ResizeObserver` on `<html>` (more reliable than `window.resize` on mobile).
 *
 * Scale is capped at {@link MAX_SCALE}: on large screens (tablets, desktop)
 * the canvas stops growing and the surrounding felt world border appears instead.
 *
 * Canvas sizes:
 * - `portrait`:        390 × 750
 * - `landscape`:       844 × 390  (phones in landscape)
 * - `landscapeTablet`: 844 × 590  (tablets / desktop)
 */
export function useGameScale(): GameLayout {
  const [gameLayout, setGameLayout] = useState<GameLayout>(computeLayout)

  useEffect(() => {
    const ro = new ResizeObserver(() => setGameLayout(computeLayout()))
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])

  return gameLayout
}
