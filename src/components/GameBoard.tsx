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
import { useRef, useState } from "react"
import type { Card, Suit } from "../types/cards"
import vqLogo from '../assets/veriquery-logo.png'
import { useGameStore } from "../store/useGameStore"
import { useGameScale } from "../hooks/useGameScale"
import { TableauColumn } from "./TableauColumn"
import type { DragSourceInfo } from "./TableauColumn"
import { Foundation } from "./Foundation"
import { CardView } from "./CardView"
import { DragStack } from "./DragStack"
import { GameCanvas } from "./GameCanvas"


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
    drawFromStock, resetStock, moveCards, flipTableauTop, newGame,
  } = useGameStore()

  const { scale, layout } = useGameScale()
  const [dragSourceInfo, setDragSourceInfo] = useState<DragSourceInfo & { cards: Card[] } | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{ toType: "tableau" | "foundation"; toIndex: number } | null>(null)
  // Ref mirrors dragSourceInfo for stale-closure-free access in handleDragOver
  const dragSourceInfoRef = useRef<(DragSourceInfo & { cards: Card[] }) | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 100, tolerance: 5 } }),
  )

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

  const topWaste = waste[waste.length - 1]

  return (
    // DndContext is OUTSIDE GameCanvas so all dnd-kit coordinate math happens
    // in screen space, not inside the CSS transform: scale() container.
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
          {/* Top row: Stock / Waste / gap / Foundations */}
          <div className="flex gap-[6px] items-start h-[67px]">
            <div
              className="w-[48px] h-[67px] shrink-0 cursor-pointer"
              onClick={stock.length > 0 ? drawFromStock : resetStock}
              title={stock.length > 0 ? "Draw" : "Reset stock"}
            >
              {stock.length > 0
                ? <div className="w-full h-full rounded-[5px] bg-[#1d1e2c] border border-black/25 shadow-[1px_2px_4px_rgba(0,0,0,0.35)] flex items-center justify-center overflow-hidden relative before:content-[''] before:absolute before:inset-[4px] before:bg-[#e9e9e9] before:rounded-[2px] before:z-0 after:content-[''] after:absolute after:inset-[4px] after:border after:border-[#9C528B]/75 after:rounded-[2px] after:pointer-events-none after:z-[2]"><img src={vqLogo} className="w-[20px] h-auto opacity-90 relative z-[3] pointer-events-none" alt="" draggable={false} /></div>
                : <div className="w-full h-full rounded-[5px] border-2 border-dashed border-white/40 flex items-center justify-center text-[22px] text-white/50">&#x21BA;</div>}
            </div>

            <div className="w-[48px] h-[67px] shrink-0">
              {topWaste && (
                <CardView
                  card={topWaste}
                  cardIndex={waste.length - 1}
                  sourceType="waste"
                  scale={scale}
                  onDoubleClick={handleDoubleClick}
                />
              )}
            </div>

            <div className="flex-1" />

            {foundations.map((pile, i) => (
              <Foundation
                key={i}
                index={i}
                pile={pile}
                dragSourceInfo={dragSourceInfo}
                scale={scale}
                previewCard={dragOverInfo?.toType === 'foundation' && dragOverInfo.toIndex === i ? dragSourceInfo?.cards[0] : undefined}
              />
            ))}
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
                previewCards={dragOverInfo?.toType === 'tableau' && dragOverInfo.toIndex === i ? dragSourceInfo?.cards : undefined}
              />
            ))}
          </div>
        </div>
      </GameCanvas>

      <button className="fixed bottom-[16px] left-[16px] z-10 px-[22px] py-[9px] border-0 rounded-[6px] bg-black/38 text-white/90 text-[13px] font-semibold tracking-[0.04em] cursor-pointer [transition:background_0.15s] hover:bg-black/56 active:bg-black/68" onClick={newGame}>New Game</button>

      {/* DragOverlay is portalled to document.body (screen space).
          DndContext being outside the scaled canvas means pointer deltas
          and overlay positioning are all in the same coordinate space. */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
        {dragSourceInfo && <DragStack cards={dragSourceInfo.cards} scale={scale} />}
      </DragOverlay>
    </DndContext>
  )
}