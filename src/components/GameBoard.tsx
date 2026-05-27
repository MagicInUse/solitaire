import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { LayoutGroup, motion } from "framer-motion"
import type { Card, Suit } from "../types/cards"
import vqLogo from '../assets/veriquery-logo.png'
import { useGameStore }    from "../store/useGameStore"
import { useOptionsStore } from "../store/useOptionsStore"
import { getCardBack }     from "../utils/cardBacks"
import { useGameScale }    from "../hooks/useGameScale"
import { TableauColumn }   from "./TableauColumn"
import type { DragSourceInfo } from "./TableauColumn"
import { Foundation }  from "./Foundation"
import { CardView }    from "./CardView"
import { recentlyDropped } from "../utils/dragTracking"
import { DragStack }   from "./DragStack"
import { GameCanvas }  from "./GameCanvas"
import { WinCascade }  from "./WinCascade"


// ─── Klondike move validation ──────────────────────────────────────────────

function isRed(suit: Suit) {
  return suit === 'hearts' || suit === 'diamonds'
}

function canMoveCards(
  movingCards: Card[],
  destPile: Card[],
  toType: 'tableau' | 'foundation'
): boolean {
  if (movingCards.length === 0) return false
  if (!movingCards[0].faceUp) return false

  if (toType === 'foundation') {
    if (movingCards.length !== 1) return false
    const card = movingCards[0]
    if (destPile.length === 0) return card.rank === 1
    const top = destPile[destPile.length - 1]
    return card.suit === top.suit && card.rank === top.rank + 1
  }

  // tableau
  const bottom = movingCards[0] // bottom of the moving stack (lowest rank)
  if (destPile.length === 0) return bottom.rank === 13
  const top = destPile[destPile.length - 1]
  if (!top.faceUp) return false
  return bottom.rank === top.rank - 1 && isRed(bottom.suit) !== isRed(top.suit)
}

/**
 * Root game component.
 *
 * Owns the dnd-kit `DndContext` (deliberately placed **outside** `GameCanvas`
 * so all pointer-delta and overlay-positioning math happens in screen space,
 * not inside the CSS `transform: scale()` canvas).
 *
 * Responsibilities:
 * - Wires dnd-kit sensors (pointer + touch with activation constraints).
 * - Maintains ephemeral UI state: `dragSourceInfo` (current drag) and
 *   `dragOverInfo` (valid hover target for preview rendering).
 * - Validates moves with `canMoveCards` on `dragOver` and `dragEnd`.
 * - Dispatches `moveCards` and `flipTableauTop` to {@link useGameStore}.
 * - Handles double-click auto-move to foundations.
 * - Renders the `DragOverlay` via {@link DragStack} for the floating clone.
 */
export function GameBoard() {
  const {
    stock, waste, foundations, tableau,
    drawFromStock, resetStock, moveCards, flipTableauTop,
    won, isDealing, setDealing, dealId,
  } = useGameStore()
  const drawId = useGameStore((s) => s.drawId)

  const { deckLocation, stockRecycles, drawMode, cardBackId } = useOptionsStore()
  const animationsEnabled = useOptionsStore((s) => s.animationsEnabled)
  const recycleCount = useGameStore((s) => s.recycleCount)
  const back = getCardBack(cardBackId)

  const { scale, layout } = useGameScale()
  const [dragSourceInfo, setDragSourceInfo] = useState<DragSourceInfo & { cards: Card[] } | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{ toType: "tableau" | "foundation"; toIndex: number } | null>(null)
  // Ref mirrors dragSourceInfo for stale-closure-free access in handleDragOver
  const dragSourceInfoRef = useRef<(DragSourceInfo & { cards: Card[] }) | null>(null)

  // Waste fan animation tracking refs
  const prevDrawIdRef       = useRef(drawId)
  const prevVisibleIdsRef   = useRef(new Set<string>())
  const isFirstRenderRef    = useRef(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 100, tolerance: 5 } }),
  )

  // Clear isDealing flag after the staggered deal animation completes.
  // 28 cards × 0.03s stagger + 0.18s card duration ≈ 1.02s total.
  useEffect(() => {
    if (!isDealing) return
    const id = setTimeout(() => setDealing(false), 1100)
    return () => clearTimeout(id)
  }, [dealId, isDealing, setDealing])

  // Update waste fan tracking refs after each commit so the next render can
  // detect whether drawId changed (new draw) vs waste shrank (card played).
  useLayoutEffect(() => {
    isFirstRenderRef.current = false
    prevDrawIdRef.current = drawId
    const count = drawMode === 1 ? Math.min(1, waste.length) : Math.min(3, waste.length)
    prevVisibleIdsRef.current = new Set(waste.slice(-count).map(c => c.id))
  })

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as {
      card: Card
      cardIndex: number
      sourceType: "waste" | "tableau" | "foundation"
      sourceIndex?: number
    }

    let cards: Card[]
    if (data.sourceType === "tableau" && data.sourceIndex !== undefined) {
      cards = tableau[data.sourceIndex].slice(data.cardIndex)
    } else if (data.sourceType === "foundation" && data.sourceIndex !== undefined) {
      cards = [foundations[data.sourceIndex][data.cardIndex]]
    } else {
      cards = [waste[data.cardIndex]]
    }

    const info = {
      sourceType: data.sourceType,
      sourceIndex: data.sourceIndex,
      cardIndex: data.cardIndex,
      cards,
    }
    dragSourceInfoRef.current = info
    setDragSourceInfo(info)
  }

  function handleDragOver(event: DragOverEvent) {
    const sourceInfo = dragSourceInfoRef.current
    const { over } = event
    if (!sourceInfo || !over) { setDragOverInfo(null); return }
    const dest = over.data.current as { toType: "tableau" | "foundation"; toIndex: number } | null
    if (!dest?.toType || dest.toIndex == null) { setDragOverInfo(null); return }
    if (sourceInfo.sourceType === dest.toType && sourceInfo.sourceIndex === dest.toIndex) {
      setDragOverInfo(null); return
    }
    const destPile = dest.toType === 'tableau' ? tableau[dest.toIndex] : foundations[dest.toIndex]
    if (!destPile || !canMoveCards(sourceInfo.cards, destPile, dest.toType)) {
      setDragOverInfo(null); return
    }
    // Functional updater: skip re-render when the hovered target hasn't changed
    setDragOverInfo(prev =>
      prev?.toType === dest.toType && prev?.toIndex === dest.toIndex
        ? prev
        : { toType: dest.toType, toIndex: dest.toIndex }
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    // Capture snapshot BEFORE clearing — this is the only reliable source of
    // truth for the drag source. active.data.current can be stale/null because
    // the dragged CardView unmounts mid-drag (replaced by its ghost outline).
    const snapshot = dragSourceInfo
    dragSourceInfoRef.current = null
    setDragSourceInfo(null)
    setDragOverInfo(null)

    const { over } = event
    if (!over || !snapshot) return

    const dest = over.data.current as {
      toType: "tableau" | "foundation"
      toIndex: number
    } | null
    if (!dest?.toType || dest.toIndex == null) return

    // Prevent dropping a card onto the same pile it came from
    if (snapshot.sourceType === dest.toType && snapshot.sourceIndex === dest.toIndex) return

    // Klondike validation
    const destPile =
      dest.toType === 'tableau'
        ? tableau[dest.toIndex]
        : foundations[dest.toIndex]
    if (!destPile) return
    if (!canMoveCards(snapshot.cards, destPile, dest.toType)) return

    moveCards({
      fromType: snapshot.sourceType as "waste" | "tableau" | "foundation",
      fromIndex: snapshot.sourceIndex,
      cardIndex: snapshot.cardIndex,
      toType: dest.toType,
      toIndex: dest.toIndex,
    })

    // Mark all dragged cards so their layoutId is skipped for one render,
    // preventing Framer Motion from replaying the drag movement as a second animation.
    for (const c of snapshot.cards) recentlyDropped.add(c.id)
    requestAnimationFrame(() => { for (const c of snapshot.cards) recentlyDropped.delete(c.id) })

    if (snapshot.sourceType === "tableau" && snapshot.sourceIndex !== undefined) {
      flipTableauTop(snapshot.sourceIndex)
    }
  }

  function handleDoubleClick(
    card: Card,
    cardIndex: number,
    sourceType: "waste" | "tableau" | "foundation",
    sourceIndex?: number
  ) {
    if (!card.faceUp) return

    // Resolve source pile to guard against non-top-card double-clicks
    const sourcePile =
      sourceType === 'tableau' && sourceIndex !== undefined
        ? tableau[sourceIndex]
        : sourceType === 'foundation' && sourceIndex !== undefined
          ? foundations[sourceIndex]
          : waste
    if (cardIndex !== sourcePile.length - 1) return

    // Try each foundation in order — only one will ever match for a given suit
    for (let i = 0; i < 4; i++) {
      if (canMoveCards([card], foundations[i], 'foundation')) {
        moveCards({
          fromType: sourceType,
          fromIndex: sourceIndex,
          cardIndex,
          toType: 'foundation',
          toIndex: i,
        })
        if (sourceType === 'tableau' && sourceIndex !== undefined) {
          flipTableauTop(sourceIndex)
        }
        return
      }
    }
  }

  // Recycle is allowed when stock is empty and the limit hasn't been reached
  const canRecycle =
    stockRecycles === 'unlimited' || recycleCount < (stockRecycles as number)

  function handleStockClick() {
    if (stock.length > 0) {
      drawFromStock()
    } else if (canRecycle) {
      resetStock()
    }
  }

  // ── Top-row elements assembled as variables so we can reorder them ──────
  const stockEl = (
    <div
      key="stock"
      className="w-[48px] h-[67px] shrink-0 cursor-pointer"
      onClick={handleStockClick}
      title={
        stock.length > 0
          ? 'Draw'
          : canRecycle
          ? 'Reset stock'
          : 'No more recycles'
      }
    >
      {stock.length > 0 ? (
        <div
          className="relative w-full h-full rounded-[5px] border border-black/25 shadow-[1px_2px_4px_rgba(0,0,0,0.35)] overflow-hidden flex items-center justify-center"
          style={back.outerStyle}
        >
          <div className="absolute inset-[4px] rounded-[2px] z-0 pointer-events-none" style={{ background: back.innerBg }} />
          <div className="absolute inset-[4px] rounded-[2px] z-[2] pointer-events-none" style={{ border: `1px solid ${back.innerBorder}` }} />
          {back.showLogo ? (
            <img src={vqLogo} className="w-[20px] h-auto opacity-90 relative z-[3] pointer-events-none" alt="" draggable={false} />
          ) : back.centerIcon ? (
            <span className="relative z-[3] text-[16px] select-none pointer-events-none" style={{ opacity: 0.35 }}>{back.centerIcon}</span>
          ) : null}
        </div>
      ) : (
        <div
          className={`w-full h-full rounded-[5px] border-2 border-dashed flex items-center justify-center text-[22px] ${
            canRecycle
              ? 'border-white/40 text-white/50'
              : 'border-white/15 text-white/20'
          }`}
        >
          &#x21BA;
        </div>
      )}
    </div>
  )

  // ── Waste pile fan display ────────────────────────────────────────────────
  // Draw-1: show only the top card.
  // Draw-3: fan up to the last 3 cards left-to-right (oldest left, top right).
  // Only the topmost card is draggable/interactive.
  const FAN_OFFSET = 14 // logical px offset between fanned cards
  const visibleWasteCount = drawMode === 1 ? Math.min(1, waste.length) : Math.min(3, waste.length)
  const wasteContainerW = visibleWasteCount <= 1 ? 48 : 48 + (visibleWasteCount - 1) * FAN_OFFSET

  // Detect whether this render is caused by a fresh draw vs a card being played.
  // Guard against drag re-renders: MeasuringStrategy.Always re-renders on every
  // pointer move, which can re-fire entrance animations spuriously.
  const isDraggingNow = dragSourceInfo !== null
  const wasNewDraw    = !isFirstRenderRef.current && !isDraggingNow && drawId !== prevDrawIdRef.current
  const prevVisibleIds = prevVisibleIdsRef.current

  const wasteEl = (
    <div
      key="waste"
      className="relative h-[67px] shrink-0"
      style={{ width: wasteContainerW }}
    >
      {waste.slice(-visibleWasteCount).map((card, i) => {
        const cardIdx  = waste.length - visibleWasteCount + i
        const isTop    = i === visibleWasteCount - 1
        const fanX     = i * FAN_OFFSET
        const isNewCard = !isFirstRenderRef.current && !isDraggingNow && !prevVisibleIds.has(card.id)

        // Outer div owns the absolute position via CSS `left`.
        // CSS `transition` smoothly shifts existing cards right when the top card is played.
        // Framer Motion (inner motion.div) handles entrance animation only:
        //   slap  — cards enter stacked (x offset = -fanX), pop from above, then fan out
        //   reveal — newly uncovered card fades/slides in from the left
        // Once settled, animate is always { x:0, y:0, scale:1, opacity:1 } so Framer Motion
        // has nothing to re-animate on drag re-renders, eliminating the spam.
        const initial = (() => {
          if (!animationsEnabled || !isNewCard) return false
          if (wasNewDraw) return { x: -fanX, y: -12, scale: 0.92 }
          return { opacity: 0 }
        })()

        const transition = (() => {
          if (!animationsEnabled || !isNewCard) return { duration: 0 }
          if (wasNewDraw) return {
            y:     { duration: 0.10, ease: 'easeOut' },
            scale: { duration: 0.10, ease: 'easeOut' },
            x:     { delay: 0.15, duration: 0.20, ease: 'easeOut' },
          }
          return { opacity: { duration: 0.18, ease: 'easeOut' } }
        })()

        return (
          <div
            key={card.id}
            className="absolute top-0"
            style={{
              left: fanX,
              zIndex: i + 1,
              // Enable CSS left-slide only when not dragging and not mid-slap
              transition: animationsEnabled && !isDraggingNow && !wasNewDraw
                ? 'left 220ms ease-out'
                : 'none',
            }}
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
                onDoubleClick={isTop ? handleDoubleClick : undefined}
              />
            </motion.div>
          </div>
        )
      })}
    </div>
  )

  const foundationEls = foundations.map((pile, i) => (
    <Foundation
      key={i}
      index={i}
      pile={pile}
      dragSourceInfo={dragSourceInfo}
      scale={scale}
      previewCard={
        dragOverInfo?.toType === 'foundation' && dragOverInfo.toIndex === i
          ? dragSourceInfo?.cards[0]
          : undefined
      }
    />
  ))

  const spacer = <div key="spacer" className="flex-1" />

  const topRowItems =
    deckLocation === 'left'
      ? [stockEl, wasteEl, spacer, ...foundationEls]
      : [...foundationEls, spacer, wasteEl, stockEl]

  return (
    <LayoutGroup id="board">
    {/* DndContext is OUTSIDE GameCanvas so all dnd-kit coordinate math happens
        in screen space, not inside the CSS transform: scale() container. */}
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <GameCanvas>
        <div className="w-full min-h-full p-[9px] flex flex-col gap-[6px]">
          {/* Top row: Stock / Waste / gap / Foundations (order depends on deckLocation) */}
          <div className="flex gap-[6px] items-start h-[67px]">
            {topRowItems}
          </div>

          {/* Tableau */}
          <div className="flex gap-[6px] items-start">
            {tableau.map((pile, i) => (
              <TableauColumn
                key={i}
                colIndex={i}
                pile={pile}
                dragSourceInfo={dragSourceInfo}
                scale={scale}
                layout={layout}
                onDoubleClick={handleDoubleClick}
                previewCards={
                  dragOverInfo?.toType === 'tableau' && dragOverInfo.toIndex === i
                    ? dragSourceInfo?.cards
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </GameCanvas>

      {/* DragOverlay is portalled to document.body (screen space).
          DndContext being outside the scaled canvas means pointer deltas
          and overlay positioning are all in the same coordinate space. */}
      <DragOverlay dropAnimation={null}>
        {dragSourceInfo && <DragStack cards={dragSourceInfo.cards} scale={scale} />}
      </DragOverlay>
    </DndContext>
    <WinCascade active={won} foundations={foundations} />
  </LayoutGroup>
  )
}