import { useState, useEffect, useRef } from 'react'
import { useDroppable } from "@dnd-kit/core"
import { clsx } from "clsx"
import { motion, AnimatePresence } from 'framer-motion'
import { CardView } from "./CardView"
import { CardFace } from "./CardFace"
import type { Card, Pile } from "../types/cards"
import type { DragSourceInfo } from "./TableauColumn"
import { useAnimations } from '../hooks/useAnimations'
import { DURATION } from '../constants/animations'

const SUIT_SYMBOLS = ["\u2665", "\u2666", "\u2663", "\u2660"]

/** Props for {@link Foundation}. */
interface FoundationProps {
  /** Zero-based foundation slot index (0 = ♥, 1 = ♦, 2 = ♣, 3 = ♠). */
  index: number
  /** Current cards stacked on this foundation, ordered Ace → King. */
  pile: Pile
  /** Active drag source info used to ghost the card being dragged away. */
  dragSourceInfo: DragSourceInfo | null
  /** Canvas scale factor from {@link useGameScale}. */
  scale: number
  /**
   * Card to render as a semi-transparent drop preview when a valid card
   * is being hovered over this foundation.
   */
  previewCard?: Card
  /**
   * When true, renders a golden glow ring to indicate this foundation
   * is the target of the active hint.
   */
  hinted?: boolean
}

/**
 * One of the four foundation piles in the top-right of the board.
 *
 * - Registers as a dnd-kit drop target (`foundation-{index}`).
 * - Renders the topmost card via {@link CardView} (draggable back to tableau).
 * - Shows the suit symbol placeholder when empty or ghosted.
 * - Renders an optional {@link CardFace} preview overlay while a valid card
 *   hovers above the slot.
 */
export function Foundation({ index, pile, dragSourceInfo, scale, previewCard, hinted }: FoundationProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `foundation-${index}`,
    data: { toType: "foundation", toIndex: index },
  })

  const animationsEnabled = useAnimations()

  // Pop-in: each time a card is ADDED to this foundation, bump `popKey` so the
  // arriving card remounts and springs from a smaller scale — immediate, tactile
  // feedback that lands the instant the card arrives (no delay) and reads as the
  // card "snapping" home. Removing a card (drag-back) leaves popKey unchanged, so
  // the card below doesn't pop.
  const [popKey, setPopKey] = useState(0)
  const prevLenRef = useRef(pile.length)
  useEffect(() => {
    if (pile.length > prevLenRef.current) {
      setPopKey((k) => k + 1)
    }
    prevLenRef.current = pile.length
  }, [pile.length])

  const topCard = pile[pile.length - 1]

  // Show ghost when the top foundation card is being dragged back to tableau
  const isGhosted =
    dragSourceInfo?.sourceType === "foundation" &&
    dragSourceInfo.sourceIndex === index &&
    pile.length > 0

  return (
    <div ref={setNodeRef} className={clsx("relative w-12 h-16.75 rounded-[5px] shrink-0 [transition:background_0.15s]", isOver && "bg-white/15")}>
      {isGhosted ? (
        <div className="w-full h-full rounded-[5px] border-2 border-dashed border-white/40 flex items-center justify-center text-[19px] text-white/40">{SUIT_SYMBOLS[index]}</div>
      ) : topCard ? (
        <motion.div
          key={popKey}
          initial={animationsEnabled && popKey > 0 ? { scale: 0.62 } : false}
          animate={{ scale: 1 }}
          transition={
            animationsEnabled && popKey > 0
              ? { type: 'spring', stiffness: 520, damping: 17, mass: 0.6 }
              : { duration: 0 }
          }
        >
          <CardView
            card={topCard}
            cardIndex={pile.length - 1}
            sourceType="foundation"
            sourceIndex={index}
            scale={scale}
            layout={false}
          />
        </motion.div>
      ) : (
        <div className="w-full h-full rounded-[5px] border-2 border-dashed border-white/40 flex items-center justify-center text-[19px] text-white/40">{SUIT_SYMBOLS[index]}</div>
      )}
      {hinted && (
        <div className="absolute inset-0 rounded-[5px] pointer-events-none hint-glow-card" />
      )}
      <AnimatePresence>
        {previewCard && (
          <motion.div
            key="foundation-preview"
            className="absolute inset-0 pointer-events-none rounded-[5px] overflow-hidden"
            initial={animationsEnabled ? { opacity: 0 } : false}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animationsEnabled ? DURATION.instant : 0 }}
          >
            <CardFace card={previewCard} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}