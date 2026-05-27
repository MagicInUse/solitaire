/**
 * @module NewGamePanel
 * Lets the player start a fresh game and pick their draw mode.
 *
 * If a game is already in progress (moveCount > 0 and not won), a
 * confirmation step warns before discarding the current game.
 */

import { useState } from 'react'
import { useGameStore }   from '../../../store/useGameStore'
import { useOptionsStore } from '../../../store/useOptionsStore'
import { useStatsStore }   from '../../../store/useStatsStore'
import { Button } from '../../ui/Button'

interface NewGamePanelProps {
  onClose: () => void
}

export function NewGamePanel({ onClose }: NewGamePanelProps) {
  const newGame      = useGameStore((s) => s.newGame)
  const moveCount    = useGameStore((s) => s.moveCount)
  const won          = useGameStore((s) => s.won)

  const { drawMode, setDrawMode } = useOptionsStore()

  const recordLoss         = useStatsStore((s) => s.recordLoss)
  const recordGameStarted  = useStatsStore((s) => s.recordGameStarted)

  const [confirming, setConfirming] = useState(false)

  const hasActiveGame = moveCount > 0 && !won

  function handleNewGame() {
    if (hasActiveGame && !confirming) {
      setConfirming(true)
      return
    }
    if (hasActiveGame) recordLoss()
    recordGameStarted()
    newGame()
    onClose()
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Draw mode selector */}
      <div>
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-2.5">
          Draw Mode
        </h3>
        <div className="flex gap-2">
          {([1, 3] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDrawMode(mode)}
              className={[
                'flex-1 py-3 rounded-xl text-[13px] font-semibold',
                'border transition-colors cursor-pointer',
                drawMode === mode
                  ? 'bg-[#3da85e]/15 border-[#3da85e]/55 text-[#6ee08a]'
                  : 'bg-white/5 border-white/12 text-white/45 hover:border-white/28 hover:text-white/65',
              ].join(' ')}
            >
              Draw {mode}
            </button>
          ))}
        </div>
        <p className="text-white/28 text-[11px] mt-2 leading-relaxed">
          {drawMode === 1
            ? 'Draw one card at a time from the stock.'
            : 'Draw three cards at a time. Only the top card is playable.'}
        </p>
      </div>

      {/* Confirmation warning */}
      {confirming && (
        <p className="text-amber-300/80 text-[12px] bg-amber-900/15 border border-amber-700/30 rounded-xl px-3 py-2.5 leading-relaxed">
          Your current game will be lost. Are you sure you want to start over?
        </p>
      )}

      {/* Primary CTA */}
      <Button
        variant={confirming ? 'danger' : 'primary'}
        className="w-full"
        onClick={handleNewGame}
      >
        {confirming ? 'Yes, Start New Game' : 'Start New Game'}
      </Button>

      {confirming && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      )}
    </div>
  )
}
