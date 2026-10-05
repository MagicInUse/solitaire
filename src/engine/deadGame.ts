/**
 * @module engine/deadGame
 * Synchronous compatibility predicates for engine tests and diagnostic tools.
 * isDeadGame measures strict legal-placement liveness; hasReachableProgress
 * retains the legacy bounded hint metric. Neither drives live UI anymore.
 * isStuckGame uses visible-card analysis and never treats unknown as stuck.
 * Live hints, Auto Play, and the modal consume one shared worker result.
 */

import type { Pile } from '../types/cards'
import { computeHints, filterUsefulHints } from './hints'
import { analyze, visibleBoard } from './analysis'
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
 * useful. This diagnostic primitive does not drive the live modal; the shared
 * worker searches for visible progress and preserves an explicit unknown state.
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

  // A truncated frontier cannot prove the absence of a legal placement.
  return queue.length === 0
}

/**
 * AXIS 2/3 — REACHABLE PROGRESS. Returns true when the player can reach a board
 * on which a genuinely *useful* move exists, by drawing and recycling the
 * stock. Retained for legacy diagnostic comparisons, not live recycle decisions.
 *
 * "Useful" is delegated entirely to the single canonical `filterUsefulHints`
 * predicate (engine/hints): a state has reachable progress iff some draw/recycle
 * frontier state offers a hint that `filterUsefulHints` keeps (an immediate-
 * progress move or a bounded-multi-ply move that unlocks new progress). This is
 * the legacy bounded hint predicate. Live assists instead share worker analysis.
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

/** Synchronous compatibility predicate. Unknown is never stuck; live UI uses the worker result. */
export function isStuckGame({
  board,
  recyclesRemaining,
  drawMode = 3,
}: {
  board: Board
  recyclesRemaining: number
  drawMode?: 1 | 3
}): boolean {
  return analyze({ board: visibleBoard(board), recyclesRemaining, drawMode }).status === 'no-progress'
}
