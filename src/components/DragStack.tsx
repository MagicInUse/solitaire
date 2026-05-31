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
export function DragStack({ cards, scale }: DragStackProps) {
  const animationsEnabled = useAnimations()
  const totalHeight = (cards.length - 1) * FACEUP_OFFSET + CARD_H

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', display: 'inline-block' }}>
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: animationsEnabled ? 1.05 : 1 }}
        transition={{ duration: DURATION.fast, ease: EASE.out }}
        style={{ position: 'relative', width: CARD_W, height: totalHeight }}
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            style={{ position: 'absolute', top: i * FACEUP_OFFSET, left: 0, width: CARD_W, height: CARD_H }}
          >
            <CardFace card={card} />
          </div>
        ))}
      </motion.div>
    </div>
  )
}
