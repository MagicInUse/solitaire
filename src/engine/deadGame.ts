/**
 * @module engine/deadGame
 * Liveness and progress analysis for Klondike Solitaire.
 *
 * This module answers TWO independent questions that used to be conflated in a
 * single `isDeadGame` function (the root of the FALSE-DEAD-MODAL bug):
 *
 *  1. AXIS 1 — LIVENESS (`isDeadGame`): is the game *genuinely* dead, i.e. is
 *     there NO legal move of any kind in any state reachable by drawing and
 *     recycling? This is the strictest possible definition and drives the
 *     dead-game MODAL. A pure shuffle, a foundation→tableau back-move, or a
 *     King-to-empty relocation all keep the game ALIVE.
 *
 *  2. AXIS 2/3 — REACHABLE PROGRESS (`hasReachableProgress`): can the player
 *     reach a move that actually advances the game (foundation play, revealed
 *     hidden card, emptied column, waste drawn down)? This is more demanding
 *     than liveness — a board can be alive (shuffles remain) yet have no
 *     reachable progress. It drives the AI's recycle decision, so the auto-
 *     player doesn't recycle the deck forever chasing moves that lead nowhere.
 *
 *  3. AXIS 4 — STUCK / UNWINNABLE (`isStuckGame`): can the game still be
 *     *played* in any meaningful sense, or are the only remaining moves
 *     reversible King/stack shuffles that push cards around without ever
 *     advancing? This is the predicate that drives the dead-game MODAL. It is
 *     broader than liveness (a board can be alive yet stuck) and is the product
 *     decision that "alive but pointless == game over": once neither progress
 *     nor a win is reachable, we offer the player a fresh deal.
 *
 * Splitting liveness from progress is the fix for the dead-game modal firing
 * while *useful* legal moves remained. The progress axis is not redefined here —
 * it is delegated to the single canonical `filterUsefulHints` predicate in
 * engine/hints, so the AI's recycle decision and the hint display can never
 * drift apart again.
 */

import type { Pile } from '../types/cards'
import { computeHints, filterUsefulHints } from './hints'
import { findProgressPlan, findWinningPlan } from './planner'
import type { Board } from './gameActions'

type Tableau = [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
type Foundations = [Pile, Pile, Pile, Pile]

type BoardState = {
  waste: Pile
  foundations: Foundations
  tableau: Tableau
}

// ─── Main exports ───────────────────────────────────────────────────────────

type DeadGameParams = BoardState & {
  stock: Pile
  recyclesRemaining: number
  drawMode?: 1 | 3
}

/**
 * AXIS 1 — LIVENESS. Returns true only when the game is genuinely dead: NO
 * legal move of ANY kind (foundation plays, tableau moves, waste plays,
 * foundation→tableau back-moves, King-to-empty relocations) exists in ANY
 * board state reachable by drawing and recycling the stock.
 *
 * This is the strictest possible "dead" definition: the instant a single legal
 * placement exists anywhere in the reachable draw/recycle frontier the game is
 * ALIVE by this axis — even if that move is a pure shuffle that leads nowhere
 * useful. It is the liveness PRIMITIVE; the dead-game MODAL itself is driven by
 * the broader `isStuckGame` (no reachable progress AND no win), so the player is
 * offered a new deal once only pointless shuffles remain, not only once every
 * last legal move is exhausted.
 *
 * Mirrors solver.ts `livenessOracle`: only draw/recycle traverse the frontier;
 * the existence of any `computeHints` entry on a reached state is the alive
 * witness (placements are never followed — a placement is itself the proof).
 * The tableau and foundations never change while traversing, so only the
 * stock/waste evolve, which keeps the search small and guaranteed to terminate
 * via the visited set even with unlimited recycles.
 */
export function isDeadGame({
  stock,
  waste,
  foundations,
  tableau,
  recyclesRemaining,
  drawMode = 3,
}: DeadGameParams): boolean {
  type LiveNode = { stock: Pile; waste: Pile; recyclesLeft: number }

  const MAX_STATES = 4000

  const toKey = (s: Pile, w: Pile, r: number): string =>
    s.map(c => `${c.suit[0]}${c.rank}`).join(',') + '/' +
    w.map(c => `${c.suit[0]}${c.rank}`).join(',') + `~${r}`

  const visited = new Set<string>()
  const queue: LiveNode[] = []

  const enqueue = (node: LiveNode): void => {
    const key = toKey(node.stock, node.waste, node.recyclesLeft)
    if (visited.has(key)) return
    visited.add(key)
    queue.push(node)
  }

  enqueue({ stock, waste, recyclesLeft: Math.max(0, recyclesRemaining) })

  let explored = 0
  while (queue.length > 0 && explored < MAX_STATES) {
    const node = queue.shift()!
    explored++

    // Witness: any legal placement (incl. back-moves / K-to-empty) → ALIVE.
    if (computeHints({ waste: node.waste, foundations, tableau }).length > 0) return false

    // Otherwise traverse: draw if able, else recycle if allowed.
    if (node.stock.length > 0) {
      const count    = Math.min(drawMode, node.stock.length)
      const newStock = node.stock.slice(0, node.stock.length - count)
      const drawn    = node.stock.slice(node.stock.length - count).map(c => ({ ...c, faceUp: true }))
      enqueue({ stock: newStock, waste: [...node.waste, ...drawn], recyclesLeft: node.recyclesLeft })
    } else if (node.recyclesLeft > 0 && node.waste.length > 0) {
      const newStock = [...node.waste].reverse().map(c => ({ ...c, faceUp: false }))
      enqueue({ stock: newStock, waste: [], recyclesLeft: node.recyclesLeft - 1 })
    }
  }

  // Frontier drained (or budget exhausted) with no placement anywhere → dead.
  return true
}

/**
 * AXIS 2/3 — REACHABLE PROGRESS. Returns true when the player can reach a board
 * on which a genuinely *useful* move exists, by drawing and recycling the
 * stock. The AI uses this to decide whether recycling the waste is worthwhile —
 * recycling when no progress is reachable would spin the deck forever.
 *
 * "Useful" is delegated entirely to the single canonical `filterUsefulHints`
 * predicate (engine/hints): a state has reachable progress iff some draw/recycle
 * frontier state offers a hint that `filterUsefulHints` keeps (an immediate-
 * progress move or a bounded-multi-ply move that unlocks new progress). This is
 * the SAME predicate the AI plays and the hint display shows, so the recycle
 * decision can never drift from what the AI will actually do next.
 *
 * Strictly stronger than `isDeadGame`: a board can be alive (legal shuffles
 * remain) yet have no reachable progress. Only the stock/waste evolve while
 * traversing — the tableau and foundations are fixed — so the visited set keeps
 * the search small and guarantees termination even with unlimited recycles.
 */
export function hasReachableProgress({
  stock,
  waste,
  foundations,
  tableau,
  recyclesRemaining,
  drawMode = 3,
}: DeadGameParams): boolean {
  type Node = { stock: Pile; waste: Pile; recyclesLeft: number }

  const MAX_STATES = 4000

  const toKey = (s: Pile, w: Pile, r: number): string =>
    s.map(c => `${c.suit[0]}${c.rank}`).join(',') + '/' +
    w.map(c => `${c.suit[0]}${c.rank}`).join(',') + `~${r}`

  const visited = new Set<string>()
  const queue: Node[] = []

  const enqueue = (node: Node): void => {
    const key = toKey(node.stock, node.waste, node.recyclesLeft)
    if (visited.has(key)) return
    visited.add(key)
    queue.push(node)
  }

  enqueue({ stock, waste, recyclesLeft: Math.max(0, recyclesRemaining) })

  let explored = 0
  while (queue.length > 0 && explored < MAX_STATES) {
    const node = queue.shift()!
    explored++

    // Canonical witness: any hint kept by filterUsefulHints on this frontier
    // state means real progress is reachable.
    const hints = computeHints({ waste: node.waste, foundations, tableau })
    if (filterUsefulHints(hints, tableau, foundations, node.waste).length > 0) return true

    // Traverse the stock/waste frontier: draw if able, else recycle if allowed.
    if (node.stock.length > 0) {
      const count    = Math.min(drawMode, node.stock.length)
      const newStock = node.stock.slice(0, node.stock.length - count)
      const drawn    = node.stock.slice(node.stock.length - count).map(c => ({ ...c, faceUp: true }))
      enqueue({ stock: newStock, waste: [...node.waste, ...drawn], recyclesLeft: node.recyclesLeft })
    } else if (node.recyclesLeft > 0 && node.waste.length > 0) {
      const newStock = [...node.waste].reverse().map(c => ({ ...c, faceUp: false }))
      enqueue({ stock: newStock, waste: [], recyclesLeft: node.recyclesLeft - 1 })
    }
  }

  return false
}

/**
 * AXIS 4 — STUCK / UNWINNABLE. Returns true when the game can no longer be
 * *played* in any meaningful sense: there is no reachable PROGRESS (a card
 * reaching a foundation or a face-down card being revealed) AND no full win
 * reachable by the deeper planner search. Whatever moves remain (if any) are
 * reversible King/stack relocations that push cards around without ever
 * advancing — "pushing colored rocks around."
 *
 * This is the predicate that drives the dead-game MODAL. It is intentionally
 * BROADER than `isDeadGame` (strict liveness): a board can be alive — legal
 * shuffles remain — yet be stuck, and that is exactly when we want to offer the
 * player a new deal.
 *
 * Progress is measured by the production planner's `findProgressPlan`, whose
 * goal is the strict monotone pair {foundation up, hidden down}. We deliberately
 * do NOT use `hasReachableProgress` here: its underlying `filterUsefulHints`
 * counts *emptying a column* as progress, so on an endgame whose only moves swap
 * Kings between already-empty columns it would report "progress reachable" for a
 * move that furthers nothing — the very colored-rocks shuffle this axis exists
 * to catch. `findProgressPlan` credits an emptied column only instrumentally,
 * when its BFS can chain it to a real foundation play or reveal.
 *
 * Two-stage by design:
 *   1. `findProgressPlan` is the cheap primary gate (the same search the AI
 *      uses to advance). If it finds any next gain the game is genuinely
 *      playable — return early, NOT stuck. On a typical mid-game the next gain
 *      is a ply or two deep so this returns almost immediately.
 *   2. Only once no progress is found do we run `findWinningPlan`, a deeper BFS
 *      (larger node/recycle budget). This guards against a false "stuck" when a
 *      board's next advancing move lies just beyond the progress search's
 *      budget: if a full win is still reachable we keep the game open. Because
 *      stage 2 only fires once stage 1 already failed, the expensive search runs
 *      only in genuine endgames where the remaining state space is tiny.
 */
export function isStuckGame({
  board,
  recyclesRemaining,
  drawMode = 3,
}: {
  board: Board
  recyclesRemaining: number
  drawMode?: 1 | 3
}): boolean {
  const state = { board, recyclesRemaining, drawMode }
  if (findProgressPlan(state) !== null) return false
  return findWinningPlan(state) === null
}
