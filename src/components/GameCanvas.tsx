import { CANVAS_W, CANVAS_H, CANVAS_W_PORTRAIT, CANVAS_H_PORTRAIT } from '../constants/canvas'
import { useGameScale } from '../hooks/useGameScale'

/** Props for {@link GameCanvas}. */
interface GameCanvasProps {
  /** Game UI to render inside the scaled canvas. */
  children: React.ReactNode
}

/**
 * Fixed-size logical canvas that scales uniformly to fill the viewport.
 *
 * Sets the inner `div` to the design dimensions and applies a CSS
 * `transform: scale()` factor from {@link useGameScale} so the entire game UI
 * grows or shrinks proportionally on any screen size.
 *
 * Supports both landscape (844 × 390) and portrait (390 × 750) orientations.
 *
 * **Coordinate note:** All child layout uses logical canvas pixels; the scale
 * transform is applied at this boundary only.
 */
export function GameCanvas({ children }: GameCanvasProps) {
  const { scale, isPortrait } = useGameScale()
  const canvasW = isPortrait ? CANVAS_W_PORTRAIT : CANVAS_W
  const canvasH = isPortrait ? CANVAS_H_PORTRAIT : CANVAS_H

  return (
    <div className="w-screen h-svh flex justify-center items-start overflow-hidden">
      <div
        className="game-canvas-felt flex-shrink-0 relative overflow-hidden"
        style={{
          width: canvasW,
          height: canvasH,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
