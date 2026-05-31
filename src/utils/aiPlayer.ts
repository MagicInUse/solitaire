/**
 * @module aiPlayer
 * Pure (React-free) logic for the AI4ME auto-player.
 *
 * `getAIMove` inspects the current board state and returns the single best
 * action the AI should take next, plus the (possibly updated) winning plan it
 * is following.  Decision order:
 *  1. Follow the queued winning plan, if one is in progress.
 *  2. Play a move that makes IMMEDIATE progress (foundation up, hidden down,
 *     empty column, or a waste card played) — cheap, and strictly monotone so
 *     it can never loop.
 *  3. When no immediate progress remains, hand off to the endgame solver
 *     (engine/planner).  If it finds a winning line, adopt it and start
 *     executing; this is what lets the AI finish all-face-up endgames instead
 *     of shuffling forever.
 *  4. Otherwise draw from stock.
 *  5. Otherwise recycle the waste — but only if genuine progress is reachable.
 *  6. Otherwise idle — no winning continuation and nothing useful to do.
 */

import type { Pile } from '../types/cards'
import type { Hint } from '../types/cards'
import { computeHints, applyHint } from './hints'
import { findWinningPlan, findProgressPlan, type PlanAction } from '../engine/planner'

/** A single action the AI should execute. */
export type AIAction =
  | { type: 'move'; hint: Hint }
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'idle' }

/** What the AI decided to do, plus the remaining plan it is committed to. */
export interface AIDecision {
  action: AIAction
  /** Remaining winning-plan steps after this action (empty when not planning). */
  plan: PlanAction[]
}

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
   * The winning plan currently being executed, if any.  When non-empty the AI
   * simply plays the next step; the queue is threaded back out through
   * {@link AIDecision.plan} so the caller can persist it across ticks.
   */
  plan?: PlanAction[]
}

/** Converts a plan step into the executable action for this tick. */
function planActionToAI(step: PlanAction): AIAction {
  if (step.kind === 'move') return { type: 'move', hint: step.move as Hint }
  if (step.kind === 'draw') return { type: 'draw' }
  return { type: 'recycle' }
}

/** Foundation card count + number of face-down tableau cards on a board. */
function monotoneMetrics(
  foundations: AIState['foundations'],
  tableau: AIState['tableau'],
): { foundation: number; hidden: number } {
  let foundation = 0
  for (const f of foundations) foundation += f.length
  let hidden = 0
  for (const col of tableau) for (const c of col) if (!c.faceUp) hidden++
  return { foundation, hidden }
}

/**
 * STRICTLY MONOTONE immediate progress: a move advances the game in a way it
 * can never undo — a card reaches the foundation, a face-down card is revealed,
 * or a waste card is played out.  Deliberately EXCLUDES the empty-column term
 * of {@link isProgressStep}: emptying/refilling columns is reversible, so
 * letting the greedy phase chase it produces King-shuffle livelocks.  Those
 * reversible maneuvers are the endgame solver's job instead.  Because
 * `foundation` (≤52) only rises and `hidden` (≤21) only falls, the greedy phase
 * built on this predicate is provably terminating.
 */
function isMonotoneProgress(
  before: { foundation: number; hidden: number },
  after: { foundation: number; hidden: number },
  fromWaste: boolean,
): boolean {
  return after.foundation > before.foundation || after.hidden < before.hidden || fromWaste
}

/**
 * Returns the next action the AI should take, and the plan it is committed to.
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
  plan,
}: AIState): AIDecision {
  if (won) return { action: { type: 'idle' }, plan: [] }

  // 1. Follow an in-progress plan.
  if (plan && plan.length > 0) {
    const [next, ...rest] = plan
    return { action: planActionToAI(next), plan: rest }
  }

  const recyclesRemaining = stockRecycles === 'unlimited'
    ? Infinity
    : Math.max(0, (stockRecycles as number) - recycleCount)
  const fullBoard = { stock, waste, foundations, tableau }
  const beforeMetrics = monotoneMetrics(foundations, tableau)

  // 2. Take any STRICTLY MONOTONE 1-ply move (a card to the foundation, a hidden
  //    reveal, or a waste card played).  Cheap fast path that handles the vast
  //    majority of ticks in both mid-game and endgame.
  const board = { waste, foundations, tableau }
  const immediate = computeHints(board).find(h => {
    const after = applyHint(board, h)
    const afterMetrics = monotoneMetrics(after.foundations, after.tableau)
    return isMonotoneProgress(beforeMetrics, afterMetrics, h.fromType === 'waste')
  })
  if (immediate) return { action: { type: 'move', hint: immediate }, plan: [] }

  // 3. No 1-ply progress — ask the planner for the shortest multi-step path to
  //    the NEXT monotone gain (it searches reversible King/stack shuffles, draws
  //    and recycles to unbury a card or free a foundation play).  Committing one
  //    bounded-progress plan after another walks the game forward — mid-game
  //    toward an all-face-up board, and in the endgame from one foundation card
  //    to the next — without ever livelocking, and keeps each committed line
  //    short (unlike a one-shot full-win DFS, which can wander thousands of
  //    reversible moves before completing).
  const progress = findProgressPlan({ board: fullBoard, recyclesRemaining, drawMode })
  if (progress && progress.length > 0) {
    const [next, ...rest] = progress
    return { action: planActionToAI(next), plan: rest }
  }

  // 4. Completeness fallback for the ALL FACE-UP endgame: when no single next
  //    gain is reachable, the position may still be winnable only via a longer
  //    setup that temporarily makes no monotone progress.  Run the full win
  //    solver to find a concrete line to 52 (or prove none exists).  This is the
  //    rare, genuinely hard endgame; mid-game boards (with hidden cards) are
  //    intractable to solve outright, so we don't attempt it there.
  if (beforeMetrics.hidden === 0) {
    const winning = findWinningPlan({ board: fullBoard, recyclesRemaining, drawMode })
    if (winning && winning.length > 0) {
      const [next, ...rest] = winning
      return { action: planActionToAI(next), plan: rest }
    }
  }

  // 5. Stuck — no advancing continuation of any kind remains.
  return { action: { type: 'idle' }, plan: [] }
}

