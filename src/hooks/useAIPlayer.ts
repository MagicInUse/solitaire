/**
 * @module useAIPlayer
 * React hook that drives the AI4ME auto-player.
 *
 * The hook runs a `setTimeout`-based loop (mirroring the `autoCompleting`
 * pattern in GameBoard) that calls `getAIMove` each tick, optionally flashes
 * the hint highlight so the move is easy to follow, then executes the action.
 *
 * Speed presets:
 *  - slow   — 1 500 ms total; hint flashes at t=0, executes at t=900 ms
 *  - normal — 800 ms total;  hint flashes at t=0, executes at t=500 ms
 *  - fast   — 200 ms total;  no hint flash, executes immediately at t=200 ms
 */

import { useState, useEffect } from 'react'
import { useGameStore }    from '../store/useGameStore'
import { useOptionsStore } from '../store/useOptionsStore'
import { getAIMove }       from '../utils/aiPlayer'

interface SpeedConfig {
  /** Total delay (ms) before the effect re-fires to pick the next move. */
  totalDelay: number
  /** Delay (ms) after which the move is executed (≤ totalDelay). */
  execDelay: number
  /** Whether to flash the hint highlight before executing. */
  showHint: boolean
}

const SPEED_CONFIG: Record<'slow' | 'normal' | 'fast', SpeedConfig> = {
  slow:   { totalDelay: 1500, execDelay: 900,  showHint: true  },
  normal: { totalDelay: 800,  execDelay: 500,  showHint: true  },
  fast:   { totalDelay: 200,  execDelay: 200,  showHint: false },
}

export interface UseAIPlayerReturn {
  isAIPlaying: boolean
  setIsAIPlaying: React.Dispatch<React.SetStateAction<boolean>>
}

export function useAIPlayer(deadGame = false): UseAIPlayerReturn {
  const [isAIPlaying, setIsAIPlaying] = useState(false)

  const {
    stock, waste, foundations, tableau,
    won, isDealing,
    drawFromStock, resetStock, moveCards, flipTableauTop, setActiveHint,
    recycleCount,
  } = useGameStore()

  const dealId = useGameStore((s) => s.dealId)

  // Reset AI when a new game starts
  useEffect(() => { setIsAIPlaying(false) }, [dealId])

  const { stockRecycles, aiSpeed, drawMode } = useOptionsStore()

  const cfg = SPEED_CONFIG[aiSpeed]

  useEffect(() => {
    if (!isAIPlaying) return

    // Game ended or no moves remain — stop the AI and clear the active button state
    if (won || deadGame || isDealing) {
      setIsAIPlaying(false)
      return
    }

    const action = getAIMove({
      stock, waste, foundations, tableau,
      recycleCount, stockRecycles, won, drawMode,
    })

    if (action.type === 'idle') {
      // No useful moves remain — stop the AI and let normal UI handle it
      setIsAIPlaying(false)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []

    // Flash hint highlight (slow/normal only, and only for move actions)
    if (cfg.showHint && action.type === 'move') {
      timers.push(setTimeout(() => setActiveHint(action.hint), 0))
    }

    // Execute the action
    timers.push(
      setTimeout(() => {
        if (action.type === 'move') {
          const { hint } = action
          moveCards({
            fromType:  hint.fromType,
            fromIndex: hint.fromIndex,
            cardIndex: hint.cardIndex,
            toType:    hint.toType,
            toIndex:   hint.toIndex,
          })
          if (hint.fromType === 'tableau' && hint.fromIndex !== undefined) {
            flipTableauTop(hint.fromIndex)
          }
        } else if (action.type === 'draw') {
          drawFromStock(drawMode)
        } else if (action.type === 'recycle') {
          resetStock()
        }
      }, cfg.execDelay),
    )

    return () => { for (const t of timers) clearTimeout(t) }
  // Re-fire whenever board state changes, AI is toggled, or the dead-game flag flips.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIPlaying, stock, waste, foundations, tableau, won, deadGame, isDealing, cfg.execDelay, cfg.showHint])

  return { isAIPlaying, setIsAIPlaying }
}
