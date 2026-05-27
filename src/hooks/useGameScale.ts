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

/**
 * Compute layout from explicit width/height values.
 *
 * Accepts measured dimensions rather than reading `window.innerWidth/innerHeight`
 * directly — those can return stale values on iOS Safari during orientation
 * transitions, causing the scale to be computed against the pre-rotation size
 * and sending cards off-screen until the next paint cycle.
 */
function computeLayout(w: number, h: number): GameLayout {
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

/** Read the committed rendered dimensions of <html> — reliable on iOS during rotation. */
function getDocumentDimensions(): [number, number] {
  const el = document.documentElement
  return [el.clientWidth, el.clientHeight]
}

/**
 * Returns the uniform CSS scale factor needed to fit the fixed-size game
 * canvas inside the current browser viewport, along with the current layout
 * mode. Recalculates whenever the viewport dimensions change.
 *
 * Two complementary listeners keep iOS orientation changes covered:
 * - **ResizeObserver** on `<html>`: primary trigger; uses `entry.contentRect`
 *   so the dimensions come from the observer callback, not a separate
 *   `window.innerWidth` read that may still be stale.
 * - **`orientationchange`** (debounced 150 ms): secondary safety-net for
 *   browsers where the ResizeObserver fires before the layout has settled.
 *
 * Scale is capped at {@link MAX_SCALE}: on large screens (tablets, desktop)
 * the canvas stops growing and the surrounding felt world border appears instead.
 *
 * Canvas sizes:
 * - `portrait`:  390 × 750
 * - `landscape`: 390 × 390
 */
export function useGameScale(): GameLayout {
  const [gameLayout, setGameLayout] = useState<GameLayout>(() => {
    const [w, h] = getDocumentDimensions()
    return computeLayout(w, h)
  })

  useEffect(() => {
    // Primary: ResizeObserver dimensions come straight from the entry —
    // avoids the stale window.innerWidth race on iOS during rotation.
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setGameLayout(computeLayout(entry.contentRect.width, entry.contentRect.height))
      }
    })
    ro.observe(document.documentElement)

    // Secondary: orientationchange fires before ResizeObserver catches up on
    // some iOS versions. Debounced 150 ms so the viewport has time to settle.
    let orientationTimer: ReturnType<typeof setTimeout>
    const handleOrientationChange = () => {
      clearTimeout(orientationTimer)
      orientationTimer = setTimeout(() => {
        const [w, h] = getDocumentDimensions()
        setGameLayout(computeLayout(w, h))
      }, 150)
    }
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', handleOrientationChange)
      clearTimeout(orientationTimer)
    }
  }, [])

  return gameLayout
}
