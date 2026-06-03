import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  pointerWithin,
} from "@dnd-kit/core"
import { useEffect, useRef, useState } from "react"
import { LayoutGroup } from "framer-motion"
import { useGameStore }    from "../store/useGameStore"
import { useOptionsStore } from "../store/useOptionsStore"
import { CANVAS_W_PORTRAIT, CANVAS_W_LANDSCAPE } from '../constants/canvas'
import { useGameScale }    from "../hooks/useGameScale"
import { TableauColumn }   from "./TableauColumn"
import { Foundation }      from "./Foundation"
import { StockPile }       from "./StockPile"
import { WastePile }       from "./WastePile"
import { useAnimationStore } from '../store/useAnimationStore'
import { RecycleAnimation } from './RecycleAnimation'
import { DragStack }       from "./DragStack"
import { GameCanvas }      from "./GameCanvas"
import { WinCascade }      from "./WinCascade"
import { DeadGameModal }   from "./DeadGameModal"
import { calculateScore, calculateVegasScore, formatVegasScore, formatTime } from "../utils/scoring"
import { useTimer }        from "../hooks/useTimer"
import { Timer, Star, Coins, Lightbulb, Undo2, Zap, Bot } from 'lucide-react'
import { useAIPlayer }           from '../hooks/useAIPlayer'
import { useAutoComplete }       from '../controllers/useAutoComplete'
import { useDeadGameDetector }   from '../controllers/useDeadGameDetector'
import { useHintController }     from '../controllers/useHintController'
import { useStatsRecorder }      from '../controllers/useStatsRecorder'
import { useGameController }     from '../controllers/useGameController'


/**
 * Root game component — layout and rendering only.
 *
 * All drag-and-drop logic lives in {@link useGameController}.
 * All game-rule logic lives in `src/engine/`.
 * Controller hooks own their respective side-effects.
 */
export function GameBoard({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [a11yStatus, setA11yStatus] = useState('')
  const lastAnnouncedMoveCount = useRef<number | null>(null)
  const {
    foundations, tableau,
    newGame, won, isDealing, setDealing, dealId,
    moveCount, undosUsed, activeHint, undo,
  } = useGameStore()
  const wasteLength = useGameStore((s) => s.waste.length)

  const { deckLocation, drawMode, cardBackId, undoLimit, hintsEnabled, scoringMode, showAI4ME } = useOptionsStore()

  const canUndo = useGameStore((s) => s.history.length > 0)
    && (undoLimit === 'unlimited' || undosUsed < (undoLimit as number))

  const elapsed = useTimer(!won && !isDealing, dealId)
  const { scale, layout }   = useGameScale()
  const canvasW = layout === 'portrait' ? CANVAS_W_PORTRAIT : CANVAS_W_LANDSCAPE
  const foundationCardCount = foundations.reduce((n, p) => n + p.length, 0)
  const standardScore = calculateScore({ drawMode: drawMode as 1 | 3, timeSeconds: elapsed, moves: moveCount, undosUsed })
  const vegasProfit   = calculateVegasScore(foundationCardCount)

  const { autoCompleting, setAutoCompleting, canAutoComplete } = useAutoComplete()
  const [deadGame, setDeadGame] = useDeadGameDetector(autoCompleting)
  const { handleHint }          = useHintController()
  const { isAIPlaying, setIsAIPlaying } = useAIPlayer(deadGame)
  const {
    sensors, dragSourceInfo, dragOverInfo,
    isRecycling, canRecycle,
    handleDragStart, handleDragOver, handleDragEnd, handleDoubleClick, handleStockClick, handleRecycleComplete,
  } = useGameController()

  useStatsRecorder({ elapsed, vegasProfit, standardScore })

  // Clear isDealing after the staggered deal animation (~1.1 s).
  useEffect(() => {
    if (!isDealing) return
    const id = setTimeout(() => setDealing(false), 1100)
    return () => clearTimeout(id)
  }, [dealId, isDealing, setDealing])

  useEffect(() => {
    if (lastAnnouncedMoveCount.current === null) {
      lastAnnouncedMoveCount.current = moveCount
      return
    }

    if (moveCount === lastAnnouncedMoveCount.current) return

    lastAnnouncedMoveCount.current = moveCount
    setA11yStatus(
      scoringMode === 'vegas'
        ? `Move ${moveCount}. Time ${formatTime(elapsed)}. Profit ${formatVegasScore(vegasProfit)}.`
        : `Move ${moveCount}. Time ${formatTime(elapsed)}. Score ${standardScore}.`,
    )
  }, [elapsed, moveCount, scoringMode, standardScore, vegasProfit])

  useEffect(() => {
    if (!won) return
    setA11yStatus(`You won in ${formatTime(elapsed)} with ${moveCount} moves.`)
  }, [elapsed, moveCount, won])

  useEffect(() => {
    setA11yStatus('New game started.')
  }, [dealId])

  // Waste sizing — shared between the placeholder div and RecycleAnimation
  const visibleWasteCount = drawMode === 1 ? Math.min(1, wasteLength) : Math.min(3, wasteLength)
  const wastePlaceholderWidthClass = visibleWasteCount <= 1 ? 'w-12' : visibleWasteCount === 2 ? 'w-[72px]' : 'w-[96px]'

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
      hinted={
        (activeHint?.toType === 'foundation' && activeHint.toIndex === i) ||
        (activeHint?.fromType === 'foundation' && activeHint.fromIndex === i)
      }
    />
  ))

  const spacer           = <div key="spacer" className="flex-1" />
  const stockEl          = <StockPile key="stock" isRecycling={isRecycling} canRecycle={canRecycle} onClick={handleStockClick} />
  const wastePlaceholder = <div key="waste-placeholder" className={`shrink-0 h-16.75 ${wastePlaceholderWidthClass}`} />
  const wasteEl          = <WastePile key="waste" scale={scale} isDraggingNow={dragSourceInfo !== null} onDoubleClick={handleDoubleClick} />

  const topRowItems =
    deckLocation === 'left'
      ? [stockEl, isRecycling ? wastePlaceholder : wasteEl, spacer, ...foundationEls]
      : [...foundationEls, spacer, isRecycling ? wastePlaceholder : wasteEl, stockEl]

  // Horizontal gap between the 7 column slots. Landscape uses a wider 18 px gap
  // so the columns spread edge-to-edge across the 462-wide canvas (reclaiming
  // side felt) while staying grid-aligned with the foundations; portrait keeps
  // the tight 6 px gap that exactly fills the 390-wide canvas.
  const gridGap = layout === 'portrait' ? 'gap-1.5' : 'gap-[18px]'
  const gridGapPx = layout === 'portrait' ? 6 : 18

  return (
    <main className="w-full h-full" aria-label="Solitaire board">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {a11yStatus}
      </div>
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
          <div className="w-full min-h-full p-2.25 flex flex-col gap-1.5">
            {/* Top row: Stock / Waste / gap / Foundations (order depends on deckLocation) */}
            <div className={`flex ${gridGap} items-start h-16.75`}>
              {topRowItems}
            </div>

            {/* HUD: timer · score · moves · action buttons */}
            <div className="flex items-center h-6.5">
              <div className="flex items-center gap-2.5 text-white/65 text-[11px] font-mono flex-1 min-w-0">
                {scoringMode === 'standard' && (
                  <><span title="Time" className="inline-flex items-center gap-1"><Timer size={11} strokeWidth={2} />{formatTime(elapsed)}</span>
                  <span title="Score" className="inline-flex items-center gap-1"><Star size={11} fill="currentColor" strokeWidth={0} />{standardScore}</span></>
                )}
                {scoringMode === 'vegas' && (
                  <span title="Vegas profit" className={`inline-flex items-center gap-1 ${vegasProfit >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                    <Coins size={12} strokeWidth={1.75} className="text-yellow-400" />{formatVegasScore(vegasProfit)}
                  </span>
                )}
                <span title="Moves">Moves: {moveCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="px-1.75 h-5.5 rounded-sm text-[10px] font-medium bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80 disabled:opacity-30 disabled:cursor-default transition-colors inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-white/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131f13]"
                  onClick={() => {
                    useAnimationStore.getState().setJustUndid(true)
                    undo()
                    requestAnimationFrame(() => { useAnimationStore.getState().setJustUndid(false) })
                  }}
                  disabled={!canUndo}
                  title="Undo"
                ><Undo2 size={11} strokeWidth={2} /> Undo</button>
                {hintsEnabled && (
                <button
                  className="px-1.75 h-5.5 rounded-sm text-[10px] font-medium bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80 transition-colors inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-white/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131f13]"
                  onClick={handleHint}
                  disabled={isAIPlaying}
                  title="Show hint"
                ><Lightbulb size={11} strokeWidth={2} /> Hint</button>
                )}
                {showAI4ME && (
                <button
                  className={`px-1.75 h-5.5 rounded-sm text-[10px] font-medium transition-colors inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-white/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131f13] ${
                    isAIPlaying
                      ? 'bg-[#9C528B]/40 hover:bg-[#9C528B]/55 text-[#e8b8de]'
                      : 'bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/80'
                  }`}
                  onClick={() => setIsAIPlaying(v => !v)}
                  disabled={won || isDealing || autoCompleting}
                  title={isAIPlaying ? 'Stop AI4ME' : 'AI4ME: auto-play the game'}
                ><Bot size={11} strokeWidth={2} /> AI4ME</button>
                )}
                {(canAutoComplete || autoCompleting) && (
                  <button
                    className={`px-1.75 h-5.5 rounded-sm text-[10px] font-medium transition-colors inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-white/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131f13] ${
                      autoCompleting
                        ? 'bg-emerald-500/40 hover:bg-emerald-500/55 text-emerald-200'
                        : 'bg-white/10 hover:bg-white/20 text-white/80'
                    }`}
                    onClick={() => setAutoCompleting(v => !v)}
                    disabled={isAIPlaying}
                    title="Auto-complete"
                  ><Zap size={11} strokeWidth={2} /> Auto</button>
                )}
              </div>
            </div>

            <DeadGameModal
              open={deadGame && !won}
              onClose={() => setDeadGame(false)}
              onNewGame={() => newGame()}
              onOpenSettings={onOpenSettings}
            />

            {/* Tableau */}
            <div className={`flex ${gridGap} items-start`}>
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
                  hintSourceCardIndex={
                    activeHint?.fromType === 'tableau' && activeHint.fromIndex === i
                      ? activeHint.cardIndex
                      : undefined
                  }
                  hintTargetHighlight={activeHint?.toType === 'tableau' && activeHint.toIndex === i}
                />
              ))}
            </div>
          </div>

          {/* WinCascade must be inside GameCanvas to share the CSS scale transform. */}
          <WinCascade active={won} foundations={foundations} onNewGame={() => newGame()} onOpenSettings={onOpenSettings} />

          {/* RecycleAnimation overlays the top row while waste cards fly back to stock. */}
          {isRecycling && (
            <RecycleAnimation
              visibleWasteCount={visibleWasteCount}
              deckLocation={deckLocation as 'left' | 'right'}
              cardBackId={cardBackId}
              canvasW={canvasW}
              gap={gridGapPx}
              onComplete={handleRecycleComplete}
            />
          )}
        </GameCanvas>

        {/* DragOverlay is portalled to document.body (screen space). */}
        <DragOverlay dropAnimation={null}>
          {dragSourceInfo && <DragStack cards={dragSourceInfo.cards} scale={scale} />}
        </DragOverlay>
      </DndContext>
      </LayoutGroup>
    </main>
  )
}

