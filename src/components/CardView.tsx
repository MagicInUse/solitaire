import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import type { Card } from "../types/cards"
import { CardFace } from "./CardFace"
import { CARD_W, CARD_H } from "../constants/canvas"

interface CardViewProps {
  card: Card
  cardIndex: number
  sourceType: "waste" | "tableau" | "foundation"
  sourceIndex?: number
  draggable?: boolean
  /** Canvas scale — divides the screen-pixel drag delta so in-canvas movement is correct. */
  scale: number
  onDoubleClick?: (card: Card, cardIndex: number, sourceType: "waste" | "tableau" | "foundation", sourceIndex?: number) => void
}

export function CardView({ card, cardIndex, sourceType, sourceIndex, draggable = true, scale, onDoubleClick }: CardViewProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !draggable || !card.faceUp,
    data: { card, cardIndex, sourceType, sourceIndex },
  })

  // dnd-kit reports pointer delta in screen pixels, but this element lives
  // inside a CSS transform:scale() canvas. Divide by scale so the ghost card
  // tracks the pointer correctly in canvas-logical coordinates.
  const scaledTransform = transform
    ? { ...transform, x: transform.x / scale, y: transform.y / scale }
    : null

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(card, cardIndex, sourceType, sourceIndex) : undefined}
      style={{
        width: CARD_W,
        height: CARD_H,
        transform: CSS.Translate.toString(scaledTransform),
        // DragOverlay renders the visible clone; hide the in-place element.
        opacity: isDragging ? 0 : 1,
        touchAction: "none",
        userSelect: "none",
        cursor: card.faceUp && draggable ? "grab" : "default",
        flexShrink: 0,
      }}
    >
      <CardFace card={card} />
    </div>
  )
}