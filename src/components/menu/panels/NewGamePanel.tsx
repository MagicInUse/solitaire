/**
 * @module NewGamePanel
 * Starts a fresh game. Draw mode and other rules live in the Rules panel.
 *
 * If a game is already in progress (moveCount > 0 and not won), a
 * confirmation step warns before discarding the current game.
 */

import { useState } from 'react'
import { useGameStore }    from '../../../store/useGameStore'
import { useOptionsStore } from '../../../store/useOptionsStore'
import { Button } from '../../ui/Button'

interface NewGamePanelProps {
  onClose: () => void
}

export function NewGamePanel({ onClose }: NewGamePanelProps) {
  const newGame   = useGameStore((s) => s.newGame)
  const moveCount = useGameStore((s) => s.moveCount)
  const won       = useGameStore((s) => s.won)
  const drawMode  = useOptionsStore((s) => s.drawMode)

  const [confirming, setConfirming] = useState(false)

  const hasActiveGame = moveCount > 0 && !won

  function handleNewGame() {
    if (hasActiveGame && !confirming) {
      setConfirming(true)
      return
    }
    newGame()
    onClose()
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Current rule summary */}
      <p className="text-white/35 text-[12px] leading-relaxed">
        Start a fresh game of Klondike Solitaire using your current rules
        ({drawMode === 1 ? 'Draw 1' : 'Draw 3'}).
        Adjust rules anytime from the <span className="text-white/55">Rules</span> tab.
      </p>

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
