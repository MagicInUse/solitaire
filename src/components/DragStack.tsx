import { motion } from 'framer-motion'
import type { Card } from '../types/cards'
import { CardFace } from './CardFace'
import { CARD_W, CARD_H, FACEUP_OFFSET } from '../constants/canvas'
import { DURATION, EASE } from '../constants/animations'
import { useAnimations } from '../hooks/useAnimations'

/** Props for {@link DragStack}. */
interface DragStackProps {
  /** Ordered array of cards in the dragged stack (top → bottom). */
  cards: Card[]
  /**
   * Canvas scale factor from {@link useGameScale}.
   * Applied as `transform: scale(scale)` so the overlay cards render at
   * the same visual size as their in-canvas counterparts.
   */
  scale: number
  offsets?: number[]
}

/**
 * Drag overlay rendered inside dnd-kit's `DragOverlay` (portalled to
 * `document.body` — screen space).
 *
 * Applies `transform: scale(scale)` on the inner wrapper so the fixed-pixel
 * fonts in `Card.module.css` scale identically to the cards visible inside
 * `GameCanvas` (which is enlarged by its own CSS `transform: scale()`).
 *
 * The overlay is not interactive; it is purely cosmetic.
 */
export function DragStack({ cards, scale, offsets = [] }: DragStackProps) {
  const animationsEnabled = useAnimations()
  const totalHeight = (offsets.at(-1) ?? (cards.length - 1) * FACEUP_OFFSET) + CARD_H

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', display: 'inline-block' }}>
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: animationsEnabled ? 1.025 : 1 }}
        transition={{ duration: DURATION.fast, ease: EASE.out }}
        style={{ position: 'relative', width: CARD_W, height: totalHeight, filter: 'drop-shadow(2px 5px 4px rgba(0,0,0,0.45))' }}
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            style={{ position: 'absolute', top: offsets[i] ?? i * FACEUP_OFFSET, left: 0, width: CARD_W, height: CARD_H }}
          >
            <CardFace card={card} />
          </div>
        ))}
      </motion.div>
    </div>
  )
}
