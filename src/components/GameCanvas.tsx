import { motion } from 'framer-motion'
import { CANVAS_W_LANDSCAPE, CANVAS_H, CANVAS_W_PORTRAIT, CANVAS_H_PORTRAIT } from '../constants/canvas'
import { useGameScale } from '../hooks/useGameScale'
import { DebugOverlay, isDebugEnabled } from './DebugOverlay'

/** Props for {@link GameCanvas}. */
interface GameCanvasProps {
  /** Game UI to render inside the scaled canvas. */
  children: React.ReactNode
}

/**
 * Full-screen felt world containing the scaled game canvas.
 *
 * Architecture (Hearthstone-style):
 * - Outer div (`game-canvas-felt`): full-screen felt background — the "world".
 *   On large screens this border area is visible, reserved for future doodads.
 * - Layer 1 (doodad zone): `absolute inset-0`, `pointer-events-none`.
 *   Future artwork / ambient UI lives here at viewport-relative coordinates,
 *   outside the scaled canvas so it doesn't warp with the game.
 * - Layer 2 (game canvas): centered, fixed logical size, CSS-scaled.
 *   Scale is capped so the playfield stays comfortable on large displays
 *   and the felt border remains visible.
 *
 * **Coordinate note:** All child layout uses logical canvas pixels; the CSS
 * scale transform is applied only at this boundary.
 */
export function GameCanvas({ children }: GameCanvasProps) {
  const { scale, layout } = useGameScale()
  const canvasW = layout === 'portrait' ? CANVAS_W_PORTRAIT : CANVAS_W_LANDSCAPE
  const canvasH = layout === 'portrait' ? CANVAS_H_PORTRAIT : CANVAS_H

  return (
    <div className="game-canvas-felt w-screen h-dvh relative overflow-hidden">
      {isDebugEnabled() && <DebugOverlay />}
      {/* Layer 1 — doodad zone: ambient decorations live here (viewport-relative, unscaled) */}
      <div className="absolute inset-0 pointer-events-none" />
      {/* Layer 2 — game canvas: centered within device safe areas so the
          playfield never overlaps the notch, Dynamic Island, or home indicator. */}
      <div
        className="absolute inset-0 flex items-center justify-center game-canvas-safe-center"
      >
        <motion.div
          className="shrink-0 relative overflow-visible"
          layoutRoot
          style={{
            width: canvasW,
            height: canvasH,
            scale: scale,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
