import {
  PointerSensor, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useRef, useState } from 'react'
import type { Card } from '../types/cards'
import { useGameStore } from '../store/useGameStore'
import { useOptionsStore } from '../store/useOptionsStore'
import { useAnimations } from '../hooks/useAnimations'
import { useSounds } from '../hooks/useSounds'
import { useAnimationStore } from '../store/useAnimationStore'
import {
  cardName, chooseDropTarget, destinationName, isLegalDestination, readDestination, resolveSource,
  type CardSource, type Destination, type SourceType,
} from './interactions'

export function useGameController(settingsOpen = false) {
  const { recycleCount, stock, waste } = useGameStore()
  const { drawMode, stockRecycles, selectAndPlaceEnabled } = useOptionsStore()
  const animationsEnabled = useAnimations()
  const { playSfx } = useSounds()
  const [dragSourceInfo, setDragSourceInfo] = useState<CardSource | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<Destination | null>(null)
  const [selection, setSelection] = useState<CardSource | null>(null)
  const [status, setStatus] = useState('')
  const [isRecycling, setIsRecycling] = useState(false)
  const dragRef = useRef<CardSource | null>(null)
  const selectionRef = useRef<CardSource | null>(null)
  const suppressUntil = useRef(0)
  const recyclingRef = useRef(false)
  const canRecycle = waste.length > 0 && (stockRecycles === 'unlimited' || recycleCount < stockRecycles)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function clearSelection() {
    selectionRef.current = null
    setSelection(null)
  }

  useEffect(() => {
    if (!settingsOpen) return
    const frame = requestAnimationFrame(() => {
      if (dragRef.current) suppressUntil.current = Date.now() + 350
      selectionRef.current = null
      dragRef.current = null
      setSelection(null)
      setDragSourceInfo(null)
      setDragOverInfo(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [settingsOpen])

  function cancelInteraction() {
    dragRef.current = null
    setDragSourceInfo(null)
    setDragOverInfo(null)
    clearSelection()
    suppressUntil.current = Date.now() + 350
    setStatus('Move cancelled.')
  }

  useEffect(() => {
    const clear = () => {
      if (dragRef.current) suppressUntil.current = Date.now() + 350
      dragRef.current = null
      selectionRef.current = null
      setDragSourceInfo(null)
      setDragOverInfo(null)
      setSelection(null)
    }
    const unsubscribeGame = useGameStore.subscribe((next, prev) => {
      if (next.tableau !== prev.tableau || next.waste !== prev.waste ||
          next.foundations !== prev.foundations || next.dealId !== prev.dealId) clear()
      if (next.dealId !== prev.dealId) {
        recyclingRef.current = false
        setIsRecycling(false)
        setStatus('')
      }
    })
    const unsubscribeOptions = useOptionsStore.subscribe(clear)
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (selectionRef.current || dragRef.current)) {
        clear()
        suppressUntil.current = Date.now() + 350
        setStatus('Move cancelled.')
      }
    }
    window.addEventListener('keydown', escape)
    return () => {
      unsubscribeGame()
      unsubscribeOptions()
      window.removeEventListener('keydown', escape)
    }
  }, [])

  function commit(source: CardSource, dest: Destination): boolean {
    const board = useGameStore.getState()
    if (settingsOpen || board.isDealing || board.won || recyclingRef.current || !isLegalDestination(board, source, dest)) {
      setStatus('Card not moved.')
      return false
    }
    board.moveCards({
      fromType: source.sourceType, fromIndex: source.sourceIndex, cardIndex: source.cardIndex,
      ...dest,
    })
    playSfx('CARD_PLACE')
    const ids = source.cards.map(c => c.id)
    useAnimationStore.getState().markDropped(ids)
    requestAnimationFrame(() => useAnimationStore.getState().clearDropped(ids))
    if (source.sourceType === 'tableau' && source.sourceIndex !== undefined) board.flipTableauTop(source.sourceIndex)
    const exposed = source.sourceType === 'tableau' && source.sourceIndex !== undefined
      ? useGameStore.getState().tableau[source.sourceIndex].at(-1) : undefined
    setStatus(`${cardName(source.cards[0])}${source.cards.length > 1 ? ` and ${source.cards.length - 1} other ${source.cards.length === 2 ? 'card' : 'cards'}` : ''} moved to ${destinationName(dest)}.${exposed ? ` ${cardName(exposed)} is now exposed.` : ''}`)
    clearSelection()
    return true
  }

  function selectSource(card: Card, cardIndex: number, sourceType: SourceType, sourceIndex?: number) {
    if (Date.now() < suppressUntil.current) return
    const board = useGameStore.getState()
    if (settingsOpen || board.isDealing || board.won || recyclingRef.current) return
    const source = resolveSource(board, sourceType, sourceIndex, cardIndex)
    if (!source || source.cards[0].id !== card.id) return
    if (selectionRef.current?.cards[0].id === card.id) {
      clearSelection()
      setStatus('Selection cancelled.')
      return
    }
    selectionRef.current = source
    setSelection(source)
    setStatus(`${cardName(card)}${source.cards.length > 1 ? `, ${source.cards.length}-card stack` : ''} selected. Choose a destination.`)
  }

  function placeSelection(dest: Destination) {
    const source = selectionRef.current
    if (!source || Date.now() < suppressUntil.current) return false
    if (source.sourceType === dest.toType && source.sourceIndex === dest.toIndex) {
      clearSelection()
      setStatus('Selection cancelled.')
      return false
    }
    return commit(source, dest)
  }

  const collisionDetection: CollisionDetection = ({ pointerCoordinates, droppableContainers, droppableRects }) => {
    const source = dragRef.current
    if (!source || !pointerCoordinates) return []
    const hit = document.elementFromPoint(pointerCoordinates.x, pointerCoordinates.y)
    if (hit?.closest('button, [data-drop-block]')) return []
    const board = useGameStore.getState()
    const targets = droppableContainers.flatMap(container => {
      const rect = droppableRects.get(container.id)
      const dest = readDestination(container.data.current)
      return rect && dest ? [{
        id: String(container.id), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        legal: isLegalDestination(board, source, dest),
      }] : []
    })
    const id = chooseDropTarget(pointerCoordinates, targets)
    return id ? [{ id }] : []
  }

  function handleDragStart(event: DragStartEvent) {
    clearSelection()
    const data = event.active.data.current
    const board = useGameStore.getState()
    if (settingsOpen || board.isDealing || board.won || recyclingRef.current) return
    if (!data || (data.sourceType !== 'waste' && data.sourceType !== 'tableau' && data.sourceType !== 'foundation')) return
    const source = resolveSource(board, data.sourceType, data.sourceIndex, data.cardIndex, data.offsets)
    dragRef.current = source
    setDragSourceInfo(source)
    suppressUntil.current = Infinity
    if (source) setStatus(`${cardName(source.cards[0])} picked up.`)
  }

  function handleDragOver(event: DragOverEvent) {
    const dest = readDestination(event.over?.data.current)
    const source = dragRef.current
    const legal = dest && source && isLegalDestination(useGameStore.getState(), source, dest)
    setDragOverInfo(prev => legal
      ? prev?.toType === dest.toType && prev.toIndex === dest.toIndex ? prev : dest
      : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = dragRef.current
    const dest = readDestination(event.over?.data.current)
    cancelInteraction()
    if (source && dest) commit(source, dest)
  }

  function handleDoubleClick(card: Card, cardIndex: number, sourceType: SourceType, sourceIndex?: number) {
    if (Date.now() < suppressUntil.current) return
    if (selectAndPlaceEnabled) {
      selectSource(card, cardIndex, sourceType, sourceIndex)
      return
    }
    const board = useGameStore.getState()
    const source = resolveSource(board, sourceType, sourceIndex, cardIndex)
    if (!source || source.cards.length !== 1) return
    for (let i = 0; i < board.foundations.length; i++) {
      const dest: Destination = { toType: 'foundation', toIndex: i }
      if (isLegalDestination(board, source, dest)) { commit(source, dest); return }
    }
  }

  function handleStockClick() {
    if (dragRef.current || recyclingRef.current) return
    clearSelection()
    const board = useGameStore.getState()
    if (board.isDealing || board.won) return
    if (board.stock.length) {
      board.drawFromStock(drawMode)
      setStatus('Cards drawn from stock.')
    } else if (board.waste.length && (stockRecycles === 'unlimited' || board.recycleCount < stockRecycles)) {
      if (animationsEnabled) {
        recyclingRef.current = true
        setIsRecycling(true)
      } else board.resetStock()
      setStatus('Stock recycled.')
    } else return
    playSfx('CARD_DRAW')
  }

  function handleRecycleComplete() {
    if (!recyclingRef.current) return
    useGameStore.getState().resetStock()
    recyclingRef.current = false
    setIsRecycling(false)
  }

  return {
    sensors, collisionDetection, dragSourceInfo, dragOverInfo, selection, status, isRecycling, canRecycle,
    stockAvailable: stock.length > 0 || canRecycle,
    handleDragStart, handleDragOver, handleDragEnd, handleDragCancel: cancelInteraction,
    handleDoubleClick, handleStockClick, handleRecycleComplete, placeSelection, clearSelection,
    isGestureSuppressed: () => Date.now() < suppressUntil.current,
  }
}
