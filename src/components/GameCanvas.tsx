import { CANVAS_W, CANVAS_H } from '../constants/canvas'
import { useGameScale } from '../hooks/useGameScale'
import styles from './GameCanvas.module.css'

interface GameCanvasProps {
  children: React.ReactNode
}

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
