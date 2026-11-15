import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Card } from "../types/cards"
import { useGameStore }    from "../store/useGameStore"
import { useOptionsStore } from "../store/useOptionsStore"
import { useAnimations }   from "../hooks/useAnimations"
import { CardView }        from "./CardView"
import { CARD_W, GAP, FAN_OFFSET } from "../constants/canvas"
import { DURATION, EASE }  from "../constants/animations"

interface WastePileProps {
  scale:         number
  isDraggingNow: boolean
  onDoubleClick: (card: Card, cardIndex: number, sourceType: "waste" | "tableau" | "foundation", sourceIndex?: number) => void
  selected?: boolean
  isGestureSuppressed?: () => boolean
}

const visibleCount = (wasteLength: number, drawMode: number) =>
  drawMode === 1 ? Math.min(1, wasteLength) : Math.min(3, wasteLength)

/**
 * Renders the waste fan with full draw-1 / draw-3 entrance animations.
 * Manages its own animation tracking so GameBoard stays free of it.
 */
export function WastePile({ scale, isDraggingNow, onDoubleClick, selected, isGestureSuppressed }: WastePileProps) {
  const waste      = useGameStore((s) => s.waste)
  const drawId     = useGameStore((s) => s.drawId)
  const activeHint = useGameStore((s) => s.activeHint)
  const drawMode     = useOptionsStore((s) => s.drawMode)
  const deckLocation = useOptionsStore((s) => s.deckLocation)
  const animationsEnabled = useAnimations()

  // ── Animation tracking: snapshot of the previously rendered waste fan ───
  const [tracked, setTracked] = useState(() => ({
    waste, drawId, drawMode,
    isFirstRender: true,
    prevDrawId: drawId,
    prevVisibleIds: new Set<string>(),
    prevVisibleCount: 0,
  }))
  if (tracked.waste !== waste || tracked.drawId !== drawId || tracked.drawMode !== drawMode) {
    const prevCount = visibleCount(tracked.waste.length, tracked.drawMode)
    setTracked({
      waste, drawId, drawMode,
      isFirstRender: false,
      prevDrawId: tracked.drawId,
      prevVisibleIds: new Set(prevCount === 0 ? [] : tracked.waste.slice(-prevCount).map(c => c.id)),
      prevVisibleCount: prevCount,
    })
  }

  const visibleWasteCount = visibleCount(waste.length, drawMode)
  const wasteContainerW   = visibleWasteCount <= 1 ? 48 : 48 + (visibleWasteCount - 1) * FAN_OFFSET

  const wasNewDraw   = !tracked.isFirstRender && !isDraggingNow && drawId !== tracked.prevDrawId
  const prevVisibleIds = tracked.prevVisibleIds
  const wasEmptyFan  = tracked.prevVisibleCount === 0

  return (
    <div className="relative h-16.75 shrink-0" style={{ width: wasteContainerW }}>
      <AnimatePresence custom={wasNewDraw && !wasEmptyFan && animationsEnabled}>
        {waste.slice(-visibleWasteCount).map((card, i) => {
          const cardIdx   = waste.length - visibleWasteCount + i
          const isTop     = i === visibleWasteCount - 1
          const fanX      = i * FAN_OFFSET
          const isNewCard = !tracked.isFirstRender && !isDraggingNow && !prevVisibleIds.has(card.id)

          const exitVariants = animationsEnabled ? {
            exit: (isDraw: boolean) => isDraw
              ? { x: -fanX, opacity: 0, transition: { duration: DURATION.fast, ease: EASE.in } }
              : { opacity: 1, transition: { duration: 0 } },
          } : undefined

          // CINEMATOGRAPHY: every drawn card enters with the SAME motion —
          // a horizontal slide originating from the stock pile's side. No
          // pop/scale variation, so the deal reads consistently regardless
          // of whether the fan was empty or already populated.
          const fromStockX = deckLocation === 'left' ? -(CARD_W + GAP) : (CARD_W + GAP)

          const initial = (() => {
            if (!animationsEnabled || !isNewCard) return false
            if (wasNewDraw) return { x: fromStockX, opacity: 0 }
            return { opacity: 0 }
          })()

          const transition = (() => {
            if (!animationsEnabled || !isNewCard) return { duration: 0 }
            if (wasNewDraw) return {
              x:       { delay: i * 0.07, duration: DURATION.base, ease: EASE.out },
              opacity: { delay: i * 0.07, duration: DURATION.fast },
            }
            return { opacity: { duration: DURATION.base, ease: EASE.out } }
          })()

          return (
            <motion.div
              key={card.id}
              className="absolute top-0"
              style={{
                left: fanX,
                zIndex: i + 1,
                transition: animationsEnabled && !isDraggingNow && !wasNewDraw
                  ? 'left 220ms ease-out'
                  : 'none',
              }}
              variants={exitVariants}
              exit={animationsEnabled ? "exit" : undefined}
            >
              <motion.div
                initial={initial}
                animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                transition={transition}
              >
                <CardView
                  card={card}
                  cardIndex={cardIdx}
                  sourceType="waste"
                  scale={scale}
                  draggable={isTop}
                  onDoubleClick={isTop ? onDoubleClick : undefined}
                  hinted={isTop && activeHint?.fromType === 'waste'}
                  selected={isTop && selected}
                  isGestureSuppressed={isGestureSuppressed}
                />
              </motion.div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
