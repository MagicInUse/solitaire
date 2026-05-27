import { CANVAS_W, CANVAS_H } from '../constants/canvas'
import { useGameScale } from '../hooks/useGameScale'
import styles from './GameCanvas.module.css'

/** Props for {@link GameCanvas}. */
interface GameCanvasProps {
  /** Game UI to render inside the scaled canvas. */
  children: React.ReactNode
}

/**
 * Fixed-size logical canvas that scales uniformly to fill the viewport.
 *
 * Sets the inner `div` to the design dimensions (`CANVAS_W × CANVAS_H`) and
 * applies a CSS `transform: scale()` factor from {@link useGameScale} so the
 * entire game UI grows or shrinks proportionally on any screen size.
 *
 * **Coordinate note:** All child layout uses logical canvas pixels; the scale
 * transform is applied at this boundary only.
 */
export function GameCanvas({ children }: GameCanvasProps) {
  const scale = useGameScale()

  return (
    <div className={styles.wrap}>
      <div
        className={styles.canvas}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
