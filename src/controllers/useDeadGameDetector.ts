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
  const stockRecycles = useOptionsStore((s) => s.stockRecycles)

  const [deadGame, setDeadGame] = useState(false)

  const canRecycle = stockRecycles === 'unlimited' || recycleCount < (stockRecycles as number)

  // Reset on every new game
  useEffect(() => { setDeadGame(false) }, [dealId])

  useEffect(() => {
    if (won || isDealing || autoCompleting) return
    setDeadGame(isDeadGame({ stock, waste, foundations, tableau, canRecycle }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock, waste, foundations, tableau, won, isDealing, autoCompleting, canRecycle])

  return [deadGame, setDeadGame]
}
