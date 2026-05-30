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
import { computeHints, filterUsefulHints, isDeadGame } from './hints'

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
  drawMode: 1 | 3
  /**
   * When set, suppresses tableau→foundation hints from this tableau column
   * for one move.  Set after a productive back-move so the AI plays the
   * follow-up move instead of immediately reversing the back-move.
   */
  skipTableauFoundationCol?: number | null
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
  drawMode,
  skipTableauFoundationCol,
}: AIState): AIAction {
  if (won) return { type: 'idle' }

  // 1. Use first useful hint (foundations first, already sorted by computeHints)
  let hints = filterUsefulHints(
    computeHints({ waste, foundations, tableau }),
    tableau,
    foundations,
    waste,
  )

  // After a productive back-move, skip the immediate reversal for one move so
  // the follow-up that justified the back-move can execute first.
  if (skipTableauFoundationCol != null) {
    const withoutReversal = hints.filter(
      h => !(h.fromType === 'tableau' && h.fromIndex === skipTableauFoundationCol && h.toType === 'foundation'),
    )
    if (withoutReversal.length > 0) hints = withoutReversal
  }

  if (hints.length > 0) return { type: 'move', hint: hints[0] }

  // 2. Draw from stock
  if (stock.length > 0) return { type: 'draw' }

  // 3. Recycle waste → stock — but only if there is genuine progress buried in
  //    the waste.  isDeadGame() checks every buried card against the current
  //    (now unchangeable) board; if none can ever lead anywhere useful, recycling
  //    would just spin the deck forever.  Checking here rather than relying on
  //    the GameBoard useEffect avoids a one-render race where the AI recycles
  //    before the deadGame prop has been updated.
  const canRecycle = stockRecycles === 'unlimited' || recycleCount < (stockRecycles as number)
  const recyclesRemaining = stockRecycles === 'unlimited'
    ? Infinity
    : Math.max(0, (stockRecycles as number) - recycleCount)
  if (canRecycle && waste.length > 0) {
    if (!isDeadGame({ stock, waste, foundations, tableau, recyclesRemaining, drawMode })) {
      return { type: 'recycle' }
    }
  }

  // 4. Stuck
  return { type: 'idle' }
}
