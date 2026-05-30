/**
 * @module useGameController
 * Owns all dnd-kit sensor setup, drag/drop event handlers, double-click
 * auto-move, stock-click logic, and the `isRecycling` animation state.
 *
 * Extracted from GameBoard so that component can focus purely on layout and
 * rendering.
 */

import {
  PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core"
import { useRef, useState } from "react"
import type { Card } from "../types/cards"
import { useGameStore }      from "../store/useGameStore"
import { useOptionsStore }   from "../store/useOptionsStore"
import { canMoveStack }      from '../engine/rules'
import { useSounds }         from '../hooks/useSounds'
import { useAnimationStore } from '../store/useAnimationStore'
import type { DragSourceInfo } from "../components/TableauColumn"

export interface GameControllerReturn {
  sensors: ReturnType<typeof useSensors>
  dragSourceInfo: (DragSourceInfo & { cards: Card[] }) | null
  dragOverInfo:   { toType: "tableau" | "foundation"; toIndex: number } | null
  isRecycling:    boolean
  canRecycle:     boolean
  handleDragStart:      (event: DragStartEvent) => void
  handleDragOver:       (event: DragOverEvent)  => void
  handleDragEnd:        (event: DragEndEvent)   => void
  handleDoubleClick:    (card: Card, cardIndex: number, sourceType: "waste" | "tableau" | "foundation", sourceIndex?: number) => void
  handleStockClick:     () => void
  handleRecycleComplete: () => void
}

export function useGameController(): GameControllerReturn {
  const { tableau, foundations, waste, stock,
          moveCards, flipTableauTop, drawFromStock, resetStock } = useGameStore()
  const recycleCount  = useGameStore((s) => s.recycleCount)

  const { drawMode, animationsEnabled, stockRecycles } = useOptionsStore()
  const { playSfx } = useSounds()

  const [dragSourceInfo, setDragSourceInfo] = useState<(DragSourceInfo & { cards: Card[] }) | null>(null)
  const [dragOverInfo,   setDragOverInfo]   = useState<{ toType: "tableau" | "foundation"; toIndex: number } | null>(null)
  const [isRecycling,    setIsRecycling]    = useState(false)

  // Ref mirrors dragSourceInfo for stale-closure-free access in handleDragOver
  const dragSourceInfoRef = useRef<(DragSourceInfo & { cards: Card[] }) | null>(null)

  const canRecycle = stockRecycles === 'unlimited' || recycleCount < (stockRecycles as number)

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

    const info = { sourceType: data.sourceType, sourceIndex: data.sourceIndex, cardIndex: data.cardIndex, cards }
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
    if (!destPile || !canMoveStack(sourceInfo.cards, destPile, dest.toType)) {
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
    // Capture snapshot BEFORE clearing — active.data.current can be stale/null
    // because the dragged CardView unmounts mid-drag (replaced by its ghost outline).
    const snapshot = dragSourceInfo
    dragSourceInfoRef.current = null
    setDragSourceInfo(null)
    setDragOverInfo(null)

    const { over } = event
    if (!over || !snapshot) return

    const dest = over.data.current as { toType: "tableau" | "foundation"; toIndex: number } | null
    if (!dest?.toType || dest.toIndex == null) return
    if (snapshot.sourceType === dest.toType && snapshot.sourceIndex === dest.toIndex) return

    const destPile = dest.toType === 'tableau' ? tableau[dest.toIndex] : foundations[dest.toIndex]
    if (!destPile || !canMoveStack(snapshot.cards, destPile, dest.toType)) return

    moveCards({
      fromType:  snapshot.sourceType as "waste" | "tableau" | "foundation",
      fromIndex: snapshot.sourceIndex,
      cardIndex: snapshot.cardIndex,
      toType:    dest.toType,
      toIndex:   dest.toIndex,
    })
    playSfx('CARD_PLACE')

    const droppedIds = snapshot.cards.map(c => c.id)
    useAnimationStore.getState().markDropped(droppedIds)
    requestAnimationFrame(() => { useAnimationStore.getState().clearDropped(droppedIds) })

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

    const sourcePile =
      sourceType === 'tableau' && sourceIndex !== undefined
        ? tableau[sourceIndex]
        : sourceType === 'foundation' && sourceIndex !== undefined
          ? foundations[sourceIndex]
          : waste
    if (cardIndex !== sourcePile.length - 1) return

    for (let i = 0; i < 4; i++) {
      if (canMoveStack([card], foundations[i], 'foundation')) {
        moveCards({ fromType: sourceType, fromIndex: sourceIndex, cardIndex, toType: 'foundation', toIndex: i })
        playSfx('CARD_PLACE')
        if (sourceType === 'tableau' && sourceIndex !== undefined) {
          flipTableauTop(sourceIndex)
        }
        return
      }
    }
  }

  function handleStockClick() {
    if (stock.length > 0) {
      drawFromStock(drawMode)
      playSfx('CARD_DRAW')
    } else if (canRecycle) {
      if (animationsEnabled) {
        setIsRecycling(true)
      } else {
        resetStock()
      }
      playSfx('CARD_DRAW')
    }
  }

  function handleRecycleComplete() {
    resetStock()
    setIsRecycling(false)
  }

  return {
    sensors,
    dragSourceInfo,
    dragOverInfo,
    isRecycling,
    canRecycle,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDoubleClick,
    handleStockClick,
    handleRecycleComplete,
  }
}
