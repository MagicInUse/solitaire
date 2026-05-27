import { useRef } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import type { Card } from "../types/cards"
import { CardFace } from "./CardFace"
import { CARD_W, CARD_H } from "../constants/canvas"

/** Props for {@link CardView}. */
interface CardViewProps {
  /** The card data to render. */
  card: Card
  /** Index of this card within its source pile. */
  cardIndex: number
  /** Which area of the board this card lives in. */
  sourceType: "waste" | "tableau" | "foundation"
  /** Column / slot index within the source area (undefined for waste). */
  sourceIndex?: number
  /**
   * Whether the card should be draggable.
   * Face-down cards are always non-draggable regardless of this flag.
   * @defaultValue true
   */
  draggable?: boolean
  /**
   * Canvas scale factor from {@link useGameScale}.
   * Divides the screen-pixel drag delta so the ghost card tracks the pointer
   * correctly inside the CSS `transform: scale()` canvas.
   */
  scale: number
  /** Called when the user double-clicks a face-up top card. */
  onDoubleClick?: (card: Card, cardIndex: number, sourceType: "waste" | "tableau" | "foundation", sourceIndex?: number) => void
}

/**
 * Interactive, draggable wrapper around {@link CardFace}.
 *
 * Registers the card with dnd-kit's `useDraggable` and corrects the
 * transform delta for the CSS-scaled canvas so the drag ghost tracks the
 * pointer at the right canvas-logical position.
 *
 * While dragging, the original card becomes invisible (opacity 0); the
 * visible clone is rendered by `DragOverlay` via {@link DragStack}.
 */
export function CardView({ card, cardIndex, sourceType, sourceIndex, draggable = true, scale, onDoubleClick }: CardViewProps) {
  const lastTapRef = useRef<number>(0)

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

  // Mobile browsers don't fire dblclick for touch; detect double-tap manually.
  function handleTouchEnd(e: React.TouchEvent) {
    if (!onDoubleClick) return
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      e.preventDefault()
      onDoubleClick(card, cardIndex, sourceType, sourceIndex)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(card, cardIndex, sourceType, sourceIndex) : undefined}
      onTouchEnd={onDoubleClick ? handleTouchEnd : undefined}
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