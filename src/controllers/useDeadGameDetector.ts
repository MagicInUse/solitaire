/**
 * @module controllers/useDeadGameDetector
 * Detects whether the current game has reached a state where no further
 * progress is possible and the player cannot win.
 *
 * Reads board state from stores directly so the parent component doesn't need
 * to thread every pile through as a prop.  Accepts `autoCompleting` as a
 * parameter because the detector must be suppressed during auto-complete
 * (every card is moving to a foundation — the game is definitely not stuck).
 */

import { useEffect, useState } from 'react'
import type React from 'react'
import { useGameStore }    from '../store/useGameStore'
import { useOptionsStore } from '../store/useOptionsStore'
import { isDeadGame }      from '../engine/deadGame'

export function useDeadGameDetector(autoCompleting: boolean): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const stock       = useGameStore((s) => s.stock)
  const waste       = useGameStore((s) => s.waste)
  const foundations = useGameStore((s) => s.foundations)
  const tableau     = useGameStore((s) => s.tableau)
  const won         = useGameStore((s) => s.won)
  const isDealing   = useGameStore((s) => s.isDealing)
  const dealId      = useGameStore((s) => s.dealId)
  const recycleCount  = useGameStore((s) => s.recycleCount)
  const drawMode      = useOptionsStore((s) => s.drawMode) as 1 | 3
  const stockRecycles = useOptionsStore((s) => s.stockRecycles)

  const [deadGame, setDeadGame] = useState(false)
  // When the user dismisses the modal we suppress re-detection until the board
  // actually changes (so the modal doesn't immediately reappear).
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)

  const recyclesRemaining = stockRecycles === 'unlimited'
    ? Infinity
    : Math.max(0, (stockRecycles as number) - recycleCount)

  // Reset on every new game
  useEffect(() => { setDeadGame(false); setDismissedAt(null) }, [dealId])

  useEffect(() => {
    if (won || isDealing || autoCompleting) return

    // Build a cheap fingerprint of board state
    const boardFingerprint = `${stock.length}/${waste.length}/${recycleCount}/${tableau.map(c => c.length).join(',')}`

    // If the user dismissed at this exact board state, don't re-fire
    if (dismissedAt === boardFingerprint) return

    if (isDeadGame({ stock, waste, foundations, tableau, recyclesRemaining, drawMode })) {
      setDeadGame(true)
    } else {
      setDeadGame(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock, waste, foundations, tableau, won, isDealing, autoCompleting, recyclesRemaining])

  // Wrap setDeadGame to record dismissal fingerprint when user manually sets false
  const handleSetDeadGame: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    if (value === false || (typeof value === 'function' && value(true) === false)) {
      const boardFingerprint = `${stock.length}/${waste.length}/${recycleCount}/${tableau.map(c => c.length).join(',')}`
      setDismissedAt(boardFingerprint)
    }
    setDeadGame(value)
  }

  return [deadGame, handleSetDeadGame]
}
