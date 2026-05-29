/**
 * @module aiPlayer
 * Pure (React-free) logic for the AI4ME auto-player.
 *
 * `getAIMove` inspects the current board state and returns the single best
 * action the AI should take next.  Priority order:
 *  1. Play the first useful hint (foundation move > tableau move).
 *  2. Draw from stock.
 *  3. Recycle the waste pile back to stock.
 *  4. Idle — no moves remain (dead game or already won).
 */

import type { Pile } from '../types/cards'
import type { Hint } from '../types/cards'
import { computeHints, filterUsefulHints } from './hints'

/** A single action the AI should execute. */
export type AIAction =
  | { type: 'move'; hint: Hint }
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'idle' }

export interface AIState {
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
  recycleCount: number
  stockRecycles: number | 'unlimited'
  won: boolean
}

/**
 * Returns the next action the AI should take given the current board state.
 * Always returns `{ type: 'idle' }` when won or truly stuck.
 */
export function getAIMove({
  stock,
  waste,
  foundations,
  tableau,
  recycleCount,
  stockRecycles,
  won,
}: AIState): AIAction {
  if (won) return { type: 'idle' }

  // 1. Use first useful hint (foundations first, already sorted by computeHints)
  const hints = filterUsefulHints(
    computeHints({ waste, foundations, tableau }),
    tableau,
    foundations,
    waste,
  )
  if (hints.length > 0) return { type: 'move', hint: hints[0] }

  // 2. Draw from stock
  if (stock.length > 0) return { type: 'draw' }

  // 3. Recycle waste → stock
  const canRecycle = stockRecycles === 'unlimited' || recycleCount < (stockRecycles as number)
  if (canRecycle && waste.length > 0) return { type: 'recycle' }

  // 4. Stuck
  return { type: 'idle' }
}
