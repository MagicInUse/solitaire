/**
 * @module controllers/useStatsRecorder
 * Side-effect hook that records game-lifecycle events (start, win, loss) to
 * the stats store and plays the win sound effect.
 *
 * Accepts pre-computed score values as parameters because `useTimer` and the
 * scoring utilities are called at the GameBoard level (their outputs are also
 * needed for HUD display).
 */

import { useEffect, useRef } from 'react'
import { useGameStore }    from '../store/useGameStore'
import { useOptionsStore } from '../store/useOptionsStore'
import { useStatsStore }   from '../store/useStatsStore'
import { useSounds }       from '../hooks/useSounds'

export interface StatsRecorderInput {
  /** Elapsed seconds from useTimer — used in the win record. */
  elapsed: number
  /** Pre-calculated Vegas net profit (foundations × $5 − $52 buy-in). */
  vegasProfit: number
  /** Pre-calculated standard score. */
  standardScore: number
}

export function useStatsRecorder({
  elapsed,
  vegasProfit,
  standardScore,
}: StatsRecorderInput): void {
  const won        = useGameStore((s) => s.won)
  const dealId     = useGameStore((s) => s.dealId)
  const moveCount  = useGameStore((s) => s.moveCount)
  const undosUsed  = useGameStore((s) => s.undosUsed)

  const drawMode    = useOptionsStore((s) => s.drawMode)
  const scoringMode = useOptionsStore((s) => s.scoringMode)

  const { recordGameStarted, recordWin, recordLoss } = useStatsStore()
  const { playSfx } = useSounds()

  const prevWonRef          = useRef(false)
  const statsGameTrackedRef = useRef(false)

  // Record game started on each new game; record loss if previous game wasn't won
  useEffect(() => {
    if (dealId === 0) return
    if (statsGameTrackedRef.current && !prevWonRef.current) recordLoss()
    prevWonRef.current    = false
    statsGameTrackedRef.current = true
    recordGameStarted()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId])

  // Record win and play win SFX when the game is completed
  useEffect(() => {
    if (!won) return
    prevWonRef.current = true
    playSfx('WIN')
    const score = scoringMode === 'vegas' ? vegasProfit : standardScore
    recordWin({
      drawMode:     drawMode as 1 | 3,
      scoringMode:  scoringMode === 'vegas' ? 'vegas' : 'standard',
      timeSeconds:  elapsed,
      moves:        moveCount,
      score,
      undosUsed,
      skipLeaderboard: scoringMode === 'casual',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won])
}
