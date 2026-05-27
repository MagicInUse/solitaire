import { useRef } from "react"
import { motion } from "framer-motion"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import type { Card } from "../types/cards"
import { CardFace } from "./CardFace"
import { CARD_W, CARD_H } from "../constants/canvas"
import { useOptionsStore } from "../store/useOptionsStore"
import { useGameStore } from "../store/useGameStore"
import { recentlyDropped } from "../utils/dragTracking"

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
  /**
   * Staggered entrance delay in seconds for the deal animation.
   * Passed by the parent based on column + card index.
   * @defaultValue 0
   */
  dealDelay?: number
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
export function CardView({ card, cardIndex, sourceType, sourceIndex, draggable = true, scale, onDoubleClick, dealDelay = 0 }: CardViewProps) {
  const lastTapRef = useRef<number>(0)
  const animationsEnabled = useOptionsStore((s) => s.animationsEnabled)
  const isDealing = useGameStore((s) => s.isDealing)

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

  // layoutId enables shared-element transitions for programmatic moves (double-click).
  // Disabled during drag, during deal, and for one frame after a drop (recentlyDropped)
  // to prevent Framer Motion from re-animating the card's pre-drag position → new position,
  // which would double-play the drag movement the user just performed.
  const layoutId = animationsEnabled && !isDragging && !isDealing && !recentlyDropped.has(card.id) ? card.id : undefined

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(card, cardIndex, sourceType, sourceIndex) : undefined}
      onTouchEnd={onDoubleClick ? handleTouchEnd : undefined}
      layoutId={layoutId}
      initial={animationsEnabled && isDealing ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: isDragging ? 0 : 1, y: 0 }}
      transition={isDealing
        ? { delay: dealDelay, duration: 0.18, ease: 'easeOut' }
        : { duration: 0.15, ease: 'easeOut' }
      }
      style={{
        width: CARD_W,
        height: CARD_H,
        // Only apply dnd-kit transform while dragging; let Framer Motion handle layout otherwise
        ...(scaledTransform ? { transform: CSS.Translate.toString(scaledTransform) } : {}),
        touchAction: "none",
        userSelect: "none",
        cursor: card.faceUp && draggable ? "grab" : "default",
        flexShrink: 0,
      }}
    >
      <CardFace card={card} />
    </motion.div>
  )
}