import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core"
import { useEffect, useRef, useState } from "react"
import { createPortal } from 'react-dom'
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
import { Timer, Star, Coins } from 'lucide-react'
import { GameActions } from './GameActions'
import { isLegalDestination, type Destination } from '../controllers/interactions'
import { useAnimations } from '../hooks/useAnimations'
import { useAIPlayer }           from '../hooks/useAIPlayer'
import { useAutoComplete }       from '../controllers/useAutoComplete'
import { useDeadGameDetector }   from '../controllers/useDeadGameDetector'
import { useHintController }     from '../controllers/useHintController'
import { useStatsRecorder }      from '../controllers/useStatsRecorder'
import { useGameController }     from '../controllers/useGameController'
import { useBoardAnalysis }      from '../controllers/useBoardAnalysis'


/**
 * Root game component — layout and rendering only.
 *
 * All drag-and-drop logic lives in {@link useGameController}.
 * All game-rule logic lives in `src/engine/`.
 * Controller hooks own their respective side-effects.
 */
export function GameBoard({ onOpenSettings, settingsOpen = false }: { onOpenSettings?: () => void; settingsOpen?: boolean }) {
  const [a11yStatus, setA11yStatus] = useState('')
  const animationsEnabled = useAnimations()
  const lastAnnouncedMoveCount = useRef<number | null>(null)
  const {
    foundations, tableau,
    newGame, won, isDealing, setDealing, dealId,
    moveCount, undosUsed, activeHint, undo,
  } = useGameStore()
  const wasteLength = useGameStore((s) => s.waste.length)

  const { deckLocation, drawMode, cardBackId, undoLimit, hintsEnabled, scoringMode, showAI4ME,
    selectAndPlaceEnabled, highlightLegalTargets } = useOptionsStore()

  const canUndo = useGameStore((s) => s.history.length > 0)
    && (undoLimit === 'unlimited' || undosUsed < (undoLimit as number))

  const elapsed = useTimer(!won && !isDealing, dealId)
  const { scale, layout, isPhone }   = useGameScale()
  const canvasW = layout === 'portrait' ? CANVAS_W_PORTRAIT : CANVAS_W_LANDSCAPE
  const foundationCardCount = foundations.reduce((n, p) => n + p.length, 0)
  const standardScore = calculateScore({ drawMode: drawMode as 1 | 3, timeSeconds: elapsed, moves: moveCount, undosUsed })
  const vegasProfit   = calculateVegasScore(foundationCardCount)

  const { autoCompleting, setAutoCompleting, canAutoComplete } = useAutoComplete()
  const {
    sensors, collisionDetection, dragSourceInfo, dragOverInfo, selection, status,
    isRecycling, canRecycle,
    handleDragStart, handleDragOver, handleDragEnd, handleDragCancel, handleDoubleClick, handleStockClick, handleRecycleComplete,
    placeSelection, clearSelection, isGestureSuppressed,
  } = useGameController(settingsOpen)
  const analysis = useBoardAnalysis(autoCompleting || won || isDealing || isRecycling || dragSourceInfo !== null)
  const [deadGame, setDeadGame] = useDeadGameDetector(analysis)
  const { handleHint, stockHinted, hintMessage } = useHintController(analysis)
  const { isAIPlaying, setIsAIPlaying } = useAIPlayer(analysis)
  const handleManualDoubleClick: typeof handleDoubleClick = (...args) => {
    setIsAIPlaying(false)
    setAutoCompleting(false)
    if (selectAndPlaceEnabled && selection && args[2] !== 'waste' && args[3] !== undefined) {
      placeSelection({ toType: args[2], toIndex: args[3] })
      return
    }
    handleDoubleClick(...args)
  }

  function targetHighlighted(dest: Destination) {
    const source = dragSourceInfo ?? selection
    return !!source && isLegalDestination(useGameStore.getState(), source, dest) &&
      (highlightLegalTargets || dragOverInfo?.toType === dest.toType && dragOverInfo.toIndex === dest.toIndex)
  }

  const interactionBusy = !!dragSourceInfo || isRecycling || isDealing || autoCompleting
  const actions = (
    <GameActions mobile={isPhone} moveCount={moveCount} mobileScore={<>
      <span className="phone-stat-label">{scoringMode === 'vegas' ? 'Profit' : 'Score'}</span>
      <span className={`phone-stat-value ${scoringMode === 'vegas' ? (vegasProfit >= 0 ? 'text-emerald-300' : 'text-red-300') : ''}`}>
        {scoringMode === 'vegas' ? formatVegasScore(vegasProfit) : standardScore}
      </span>
      {scoringMode === 'standard' && <span className="phone-stat-time" title="Time" aria-label={`Time ${formatTime(elapsed)}`}>{formatTime(elapsed)}</span>}
    </>} canUndo={canUndo} hintsEnabled={hintsEnabled}
      hintDisabled={isAIPlaying || analysis.status !== 'ready'} showAI={showAI4ME}
      isAIPlaying={isAIPlaying} aiDisabled={won || interactionBusy}
      showAuto={canAutoComplete || autoCompleting} autoCompleting={autoCompleting}
      interactionBusy={!!dragSourceInfo || isRecycling || isDealing}
      onUndo={() => {
        clearSelection()
        setIsAIPlaying(false)
        useAnimationStore.getState().setJustUndid(true)
        undo()
        requestAnimationFrame(() => useAnimationStore.getState().setJustUndid(false))
      }}
      onHint={handleHint}
      onAI={() => { clearSelection(); setIsAIPlaying(v => !v) }}
      onAuto={() => { clearSelection(); setAutoCompleting(v => !v) }}
      onMenu={() => { clearSelection(); onOpenSettings?.() }}
    />
  )

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
      selected={selection?.sourceType === 'foundation' && selection.sourceIndex === i}
      legalTarget={targetHighlighted({ toType: 'foundation', toIndex: i })}
      onDoubleClick={selectAndPlaceEnabled ? handleManualDoubleClick : undefined}
      onDestination={selection ? () => { if (!isGestureSuppressed()) placeSelection({ toType: 'foundation', toIndex: i }) } : undefined}
      isGestureSuppressed={isGestureSuppressed}
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
  const stockEl          = <StockPile key="stock" isRecycling={isRecycling} canRecycle={canRecycle} onClick={() => { setIsAIPlaying(false); setAutoCompleting(false); handleStockClick() }} hinted={stockHinted} />
  const wastePlaceholder = <div key="waste-placeholder" className={`shrink-0 h-16.75 ${wastePlaceholderWidthClass}`} />
  const wasteEl          = <WastePile key="waste" scale={scale} isDraggingNow={dragSourceInfo !== null} onDoubleClick={handleManualDoubleClick}
    selected={selection?.sourceType === 'waste'} isGestureSuppressed={isGestureSuppressed} />

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
    <main className="w-full h-full" aria-label="Solitaire board" onClick={event => {
      if (event.target instanceof Element && !event.target.closest('[data-card-id], [data-pile], button, [role="dialog"]') && !isGestureSuppressed()) clearSelection()
    }}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {a11yStatus} {status}
      </div>
      <LayoutGroup id="board">
      {/* DndContext is OUTSIDE GameCanvas so all dnd-kit coordinate math happens
          in screen space, not inside the CSS transform: scale() container. */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        accessibility={{ screenReaderInstructions: { draggable: '' }, announcements: {
          onDragStart: () => '', onDragOver: () => '', onDragEnd: () => '', onDragCancel: () => '',
        } }}
        onDragStart={event => { setIsAIPlaying(false); setAutoCompleting(false); handleDragStart(event) }}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <GameCanvas>
          <div className="w-full min-h-full p-2.25 flex flex-col gap-1.5" onClick={event => {
            if (event.target === event.currentTarget && !isGestureSuppressed()) clearSelection()
          }}>
            {/* Top row: Stock / Waste / gap / Foundations (order depends on deckLocation) */}
            <div className={`flex ${gridGap} items-start h-16.75`}>
              {topRowItems}
            </div>

            {/* HUD: timer · score · moves · action buttons */}
            {!isPhone && <div className="flex items-center h-6.5" data-drop-block>
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
              {actions}
            </div>}

            <div className="text-white/80 text-[10px] h-3.5 truncate" role="status" aria-live="polite" data-drop-block>
              {analysis.status === 'error'
                ? `Move analysis unavailable: ${analysis.error}`
                : analysis.status === 'pending'
                  ? ''
                  : analysis.result?.status === 'unknown'
                    ? 'Search limit reached. No dead end proven; you can keep playing.'
                    : hintMessage}
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
                  isPhone={isPhone}
                  onDoubleClick={handleManualDoubleClick}
                  selectedCardIndex={selection?.sourceType === 'tableau' && selection.sourceIndex === i ? selection.cardIndex : undefined}
                  legalTarget={targetHighlighted({ toType: 'tableau', toIndex: i })}
                  onDestination={selection ? () => { if (!isGestureSuppressed()) placeSelection({ toType: 'tableau', toIndex: i }) } : undefined}
                  isGestureSuppressed={isGestureSuppressed}
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
        <DragOverlay dropAnimation={animationsEnabled ? {
          duration: 140,
          easing: 'ease-out',
          // Do not restore dnd-kit's captured opacity over Framer Motion's live value.
          sideEffects: ({ active }) => {
            active.node.dataset.returning = 'true'
            return () => { delete active.node.dataset.returning }
          },
        } : null}>
          {dragSourceInfo && <DragStack cards={dragSourceInfo.cards} scale={scale} offsets={dragSourceInfo.offsets} />}
        </DragOverlay>
      </DndContext>
      </LayoutGroup>
      {isPhone && createPortal(actions, document.body)}
    </main>
  )
}
