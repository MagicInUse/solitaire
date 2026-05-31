import { useLayoutEffect, useRef } from "react"
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
}

/**
 * Renders the waste fan with full draw-1 / draw-3 entrance animations.
 * Manages its own animation-tracking refs so GameBoard stays free of them.
 */
export function WastePile({ scale, isDraggingNow, onDoubleClick }: WastePileProps) {
  const waste      = useGameStore((s) => s.waste)
  const drawId     = useGameStore((s) => s.drawId)
  const activeHint = useGameStore((s) => s.activeHint)
  const drawMode     = useOptionsStore((s) => s.drawMode)
  const deckLocation = useOptionsStore((s) => s.deckLocation)
  const animationsEnabled = useAnimations()

  // ── Animation-tracking refs ─────────────────────────────────────────────
  const prevDrawIdRef            = useRef(drawId)
  const prevVisibleIdsRef        = useRef(new Set<string>())
  const prevWasteVisibleCountRef = useRef(0)
  const isFirstRenderRef         = useRef(true)

  const visibleWasteCount = drawMode === 1 ? Math.min(1, waste.length) : Math.min(3, waste.length)
  const wasteContainerW   = visibleWasteCount <= 1 ? 48 : 48 + (visibleWasteCount - 1) * FAN_OFFSET

  const wasNewDraw   = !isFirstRenderRef.current && !isDraggingNow && drawId !== prevDrawIdRef.current
  const prevVisibleIds = prevVisibleIdsRef.current
  const wasEmptyFan  = prevWasteVisibleCountRef.current === 0

  // Update refs after every commit
  useLayoutEffect(() => {
    isFirstRenderRef.current = false
    prevDrawIdRef.current = drawId
    const count = drawMode === 1 ? Math.min(1, waste.length) : Math.min(3, waste.length)
    prevWasteVisibleCountRef.current = count
    prevVisibleIdsRef.current = new Set(waste.slice(-count).map(c => c.id))
  })

  return (
    <div className="relative h-16.75 shrink-0" style={{ width: wasteContainerW }}>
      <AnimatePresence custom={wasNewDraw && !wasEmptyFan && animationsEnabled}>
        {waste.slice(-visibleWasteCount).map((card, i) => {
          const cardIdx   = waste.length - visibleWasteCount + i
          const isTop     = i === visibleWasteCount - 1
          const fanX      = i * FAN_OFFSET
          const isNewCard = !isFirstRenderRef.current && !isDraggingNow && !prevVisibleIds.has(card.id)

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
                />
              </motion.div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
