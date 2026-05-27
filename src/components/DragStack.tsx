import type { Card } from '../types/cards'
import { CardFace } from './CardFace'
import { CARD_W, CARD_H, FACEUP_OFFSET } from '../constants/canvas'

interface DragStackProps {
  cards: Card[]
  /** Canvas scale — used to render the overlay at the correct screen-space size. */
  scale: number
}

/**
 * Rendered inside DragOverlay (portalled to document.body — screen space).
 * Applies transform:scale(scale) on the inner wrapper so fixed-px fonts in
 * Card.module.css scale identically to the cards inside the GameCanvas
 * (which are visually enlarged by GameCanvas's own CSS transform:scale).
 */
export function DragStack({ cards, scale }: DragStackProps) {
  const totalHeight = (cards.length - 1) * FACEUP_OFFSET + CARD_H

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', display: 'inline-block' }}>
      <div style={{ position: 'relative', width: CARD_W, height: totalHeight }}>
        {cards.map((card, i) => (
          <div
            key={card.id}
            style={{ position: 'absolute', top: i * FACEUP_OFFSET, left: 0, width: CARD_W, height: CARD_H }}
          >
            <CardFace card={card} />
          </div>
        ))}
      </div>
    </div>
  )
}
