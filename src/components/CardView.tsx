import { useRef } from "react"
import { motion } from "framer-motion"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import type { Card } from "../types/cards"
import { CardFace } from "./CardFace"
import { CARD_W, CARD_H } from "../constants/canvas"
import { DURATION, EASE, SPRING } from "../constants/animations"
import { useGameStore }      from "../store/useGameStore"
import { useOptionsStore }   from "../store/useOptionsStore"
import { useAnimationStore } from "../store/useAnimationStore"
import { useAnimations }     from "../hooks/useAnimations"

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
  /**
   * When true, renders a golden glow ring to indicate this card is the
   * source (or part of the source stack) of the active hint.
   */
  hinted?: boolean
  /**
   * Whether this card participates in Framer Motion shared-layout (`layoutId`)
   * transitions. Disable for cards that land via a dedicated arrival animation
   * (e.g. foundation pop-in) so they don't try to FLIP across an
   * `AnimatePresence` boundary inside the scaled canvas — which misprojects the
   * origin and makes the card appear to fly in from off-screen.
   * @defaultValue true
   */
  layout?: boolean
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
export function CardView({ card, cardIndex, sourceType, sourceIndex, draggable = true, scale, onDoubleClick, dealDelay = 0, hinted = false, layout = true }: CardViewProps) {
  const lastTapRef = useRef<number>(0)
  const downRef    = useRef<{ x: number; y: number } | null>(null)
  const animationsEnabled  = useAnimations()
  const interactionMode    = useOptionsStore((s) => s.interactionMode)
  const isDealing          = useGameStore((s) => s.isDealing)
  const isRecentlyDropped  = useAnimationStore((s) => s.droppedIds.has(card.id))
  const justUndid          = useAnimationStore((s) => s.justUndid)

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
  // In single-tap mode a plain tap auto-moves the card; we distinguish a tap
  // from a drag by comparing the pointer-up position against the recorded
  // pointer-down position (a real drag moves further than TAP_SLOP).
  const TAP_SLOP = 6

  function autoMove() {
    onDoubleClick?.(card, cardIndex, sourceType, sourceIndex)
  }

  function isTap(x: number, y: number) {
    const d = downRef.current
    if (!d) return false
    return Math.abs(x - d.x) <= TAP_SLOP && Math.abs(y - d.y) <= TAP_SLOP
  }

  function handleClick(e: React.MouseEvent) {
    if (interactionMode !== 'single-tap' || !onDoubleClick) return
    if (isTap(e.clientX, e.clientY)) autoMove()
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!onDoubleClick) return
    const t = e.changedTouches[0]
    if (interactionMode === 'single-tap') {
      if (t && isTap(t.clientX, t.clientY)) {
        e.preventDefault()
        autoMove()
      }
      return
    }
    // Legacy double-tap detection
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      e.preventDefault()
      autoMove()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  // layoutId enables shared-element transitions for programmatic moves (double-click).
  // Disabled during drag, during deal, and for one frame after a drop (recentlyDropped)
  // to prevent Framer Motion from re-animating the card's pre-drag position → new position,
  // which would double-play the drag movement the user just performed.
  // Also disabled when `layout` is false (e.g. foundation cards animate via their own
  // pop-in), since a cross-AnimatePresence FLIP inside the scaled canvas misprojects the
  // origin and makes the card appear to fly in from off-screen.
  const layoutId = layout && animationsEnabled && !isDragging && !isDealing && !isRecentlyDropped ? card.id : undefined

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDownCapture={(e) => { downRef.current = { x: e.clientX, y: e.clientY } }}
      onClick={onDoubleClick && interactionMode === 'single-tap' ? handleClick : undefined}
      onDoubleClick={onDoubleClick && interactionMode === 'double-tap' ? () => onDoubleClick(card, cardIndex, sourceType, sourceIndex) : undefined}
      onTouchEnd={onDoubleClick ? handleTouchEnd : undefined}
      layoutId={layoutId}
      className={hinted ? 'hint-glow-card' : undefined}
      initial={animationsEnabled && isDealing ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: isDragging ? 0 : 1, y: 0 }}
      transition={
        justUndid && animationsEnabled
          ? SPRING.undo
          : isDealing
          ? { delay: dealDelay, duration: DURATION.base, ease: EASE.out }
          : { duration: 0.15, ease: EASE.out }
      }
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: '5px',
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