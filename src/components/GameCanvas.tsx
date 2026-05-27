import { CANVAS_W, CANVAS_H, CANVAS_W_PORTRAIT, CANVAS_H_PORTRAIT } from '../constants/canvas'
import { useGameScale } from '../hooks/useGameScale'

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
  const canvasW = layout === 'portrait' ? CANVAS_W_PORTRAIT : CANVAS_W
  const canvasH = layout === 'portrait' ? CANVAS_H_PORTRAIT : CANVAS_H

  return (
    <div className="game-canvas-felt w-screen h-svh relative overflow-hidden">
      {/* Layer 1 — doodad zone: ambient decorations live here (viewport-relative, unscaled) */}
      <div className="absolute inset-0 pointer-events-none" />
      {/* Layer 2 — game canvas: centered, fixed logical size, CSS-scaled */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex-shrink-0 relative overflow-hidden"
          style={{
            width: canvasW,
            height: canvasH,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
