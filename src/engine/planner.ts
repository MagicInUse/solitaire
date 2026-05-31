/**
 * @module engine/planner
 * Production endgame solver for the AI4ME auto-player.
 *
 * The greedy auto-player (utils/aiPlayer.getAIMove) makes immediate progress
 * cheaply, but it cannot finish positions that require look-ahead — most
 * notably the all-face-up endgame where the only moves are King/stack shuffles
 * between columns.  A purely greedy player wanders those forever (livelock).
 *
 * This module gives the auto-player a real brain for exactly those moments: a
 * bounded depth-first search with a transposition table that returns a concrete
 * winning line of actions, or `null` when none is found within the node budget.
 * The auto-player follows a returned plan straight to a full clear.
 *
 * INDEPENDENCE: this is PRODUCTION code.  It imports only the ground-truth
 * rulebook (engine/rules) and shared board transitions (engine/gameActions) —
 * never the test-only oracle (engine/solver), so the harness keeps an
 * independent second opinion.
 *
 * TRACTABILITY: the search collapses two big symmetries that otherwise make the
 * endgame branch explode —
 *   1. EMPTY COLUMNS are interchangeable: a King (or stack) may legally move to
 *      any empty tableau column, but all such destinations are equivalent, so
 *      only the first empty column is ever tried.
 *   2. The transposition table prunes any position (board + recycles-left)
 *      already visited on the current search.
 * Together with a foundation-first move ordering, these let the all-face-up
 * endgame solve in well under the node budget.
 */

import type { Pile } from '../types/cards'
import { canPlaceOnFoundation, canPlaceOnTableau, canMoveStack, isValidRun } from './rules'
import { applyDraw, applyRecycle, applyMove, applyFlip, type Board, type MoveParams } from './gameActions'

/** A single executable step in a winning plan. */
export type PlanAction =
  | { kind: 'move'; move: MoveParams }
  | { kind: 'draw' }
  | { kind: 'recycle' }

/** Tuning bounds for {@link findWinningPlan}. */
export interface PlannerLimits {
  /** Hard cap on expanded nodes before the search gives up and returns null. */
  maxNodes: number
  /** Cap on stock recycles the search may use when recycles are unlimited. */
  recycleCap: number
}

export const DEFAULT_PLANNER_LIMITS: PlannerLimits = { maxNodes: 200_000, recycleCap: 8 }

/**
 * Leaner bounds for {@link findProgressPlan}.  The next monotone gain — a
 * foundation card or a hidden-card reveal — is almost always a handful of plies
 * away, so a wide breadth-first frontier finds it quickly when it exists.  When
 * it does NOT exist the search must exhaust its budget before giving up, and
 * that give-up path is the auto-player's hot path (it runs every time the AI is
 * about to idle).  A tighter node cap keeps that decision snappy in the live
 * game without costing wins: gains buried deeper than this are not reliably
 * reachable greedily anyway (verified empirically — widening the budget did not
 * convert additional deals).  The full {@link DEFAULT_PLANNER_LIMITS} budget is
 * still used by {@link findWinningPlan} for the genuinely hard all-face-up
 * endgame solve.
 */
export const PROGRESS_PLANNER_LIMITS: PlannerLimits = { maxNodes: 100_000, recycleCap: 4 }

/** Inputs describing the full game position to solve from. */
export interface PlannerState {
  board: Board
  /** Recycles still permitted from here (Infinity for unlimited). */
  recyclesRemaining: number
  drawMode: 1 | 3
}

/** True when all four foundations are complete (52 cards home). */
function isWon(b: Board): boolean {
  let n = 0
  for (const f of b.foundations) n += f.length
  return n === 52
}

/** Index of the first face-up card in a column, or `col.length` if none. */
function firstFaceUp(col: Pile): number {
  for (let i = 0; i < col.length; i++) if (col[i].faceUp) return i
  return col.length
}

/**
 * Enumerates legal card placements on `board`, ordered for fast solving
 * (foundation plays and hidden-card reveals first), with empty-column symmetry
 * collapsed so a King/stack is only ever sent to the FIRST empty column.
 *
 * Foundation→tableau back-moves are included last: rarely needed, but some
 * winning lines require temporarily un-stacking a foundation card.
 */
function orderedPlacements(board: Board): MoveParams[] {
  const { waste, tableau, foundations } = board
  const toFoundation: MoveParams[] = []
  const reveals: MoveParams[] = []
  const wasteToTableau: MoveParams[] = []
  const tableauShuffles: MoveParams[] = []
  const backMoves: MoveParams[] = []

  const firstEmptyCol = tableau.findIndex((c) => c.length === 0)

  // Waste top → foundation / tableau.
  if (waste.length > 0) {
    const card = waste[waste.length - 1]
    const cardIndex = waste.length - 1
    for (let f = 0; f < 4; f++)
      if (canPlaceOnFoundation(card, foundations[f]))
        toFoundation.push({ fromType: 'waste', cardIndex, toType: 'foundation', toIndex: f })
    for (let t = 0; t < 7; t++) {
      if (tableau[t].length === 0 && t !== firstEmptyCol) continue // empty-col symmetry
      if (canPlaceOnTableau(card, tableau[t]))
        wasteToTableau.push({ fromType: 'waste', cardIndex, toType: 'tableau', toIndex: t })
    }
  }

  // Tableau runs → foundation (single card) / other tableau columns.
  for (let i = 0; i < 7; i++) {
    const col = tableau[i]
    const start = firstFaceUp(col)
    for (let ci = start; ci < col.length; ci++) {
      if (!isValidRun(col, ci)) continue
      const run = col.slice(ci)

      if (run.length === 1) {
        for (let f = 0; f < 4; f++)
          if (canPlaceOnFoundation(run[0], foundations[f]))
            toFoundation.push({ fromType: 'tableau', fromIndex: i, cardIndex: ci, toType: 'foundation', toIndex: f })
      }

      // Moving the WHOLE column off its base reveals a hidden card or empties
      // the column — flag those as "reveals" so they are tried before idle
      // shuffles. A move that leaves a face-down card behind reveals it.
      const revealsHidden = ci > 0 && !col[ci - 1].faceUp
      const emptiesColumn = ci === 0

      for (let t = 0; t < 7; t++) {
        if (t === i) continue
        if (tableau[t].length === 0) {
          if (t !== firstEmptyCol) continue // empty-col symmetry
          // Moving a stack that is already the whole column into an empty
          // column accomplishes nothing — skip the no-op relocation.
          if (emptiesColumn) continue
        }
        if (!canMoveStack(run, tableau[t], 'tableau')) continue
        const mv: MoveParams = { fromType: 'tableau', fromIndex: i, cardIndex: ci, toType: 'tableau', toIndex: t }
        if (revealsHidden) reveals.push(mv)
        else tableauShuffles.push(mv)
      }
    }
  }

  // Foundation top → tableau (back-moves) — last resort.
  for (let f = 0; f < 4; f++) {
    const fp = foundations[f]
    if (fp.length === 0) continue
    const card = fp[fp.length - 1]
    for (let t = 0; t < 7; t++) {
      if (tableau[t].length === 0 && t !== firstEmptyCol) continue
      if (canPlaceOnTableau(card, tableau[t]))
        backMoves.push({ fromType: 'foundation', fromIndex: f, cardIndex: fp.length - 1, toType: 'tableau', toIndex: t })
    }
  }

  return [...toFoundation, ...reveals, ...wasteToTableau, ...tableauShuffles, ...backMoves]
}

/** Applies a placement including the intrinsic auto-flip of the source column. */
function applyPlacement(board: Board, mv: MoveParams): Board {
  let next = applyMove(board, mv)
  if (mv.fromType === 'tableau') next = applyFlip(next, mv.fromIndex!)
  return next
}

/** A stable signature for a full board position (used by the transposition table). */
function boardKey(b: Board): string {
  const pile = (p: Pile) => p.map((c) => `${c.suit[0]}${c.rank}${c.faceUp ? 'u' : 'd'}`).join(',')
  return [
    b.stock.map((c) => `${c.suit[0]}${c.rank}`).join(','),
    pile(b.waste),
    b.foundations.map(pile).join('#'),
    b.tableau.map(pile).join('|'),
  ].join('/')
}

/**
 * Searches for a sequence of actions that wins the game from `state`.
 *
 * Returns the winning plan (root-first) or `null` when no win is found within
 * the node budget.  The search is sound — every action in the returned plan is
 * legal and the final board is a complete win — but NOT complete: a `null`
 * result means "no win proven within budget", not "unwinnable".
 */
export function findWinningPlan(
  state: PlannerState,
  limits: PlannerLimits = DEFAULT_PLANNER_LIMITS,
): PlanAction[] | null {
  return search(state, limits, isWon)
}

/** Total foundation cards + face-down tableau cards (the monotone progress pair). */
function progressSignature(b: Board): { foundation: number; hidden: number } {
  let foundation = 0
  for (const f of b.foundations) foundation += f.length
  let hidden = 0
  for (const col of b.tableau) for (const c of col) if (!c.faceUp) hidden++
  return { foundation, hidden }
}

/**
 * Searches for the shortest action sequence that achieves the NEXT strictly
 * monotone gain from `state` — a card reaches the foundation, or a face-down
 * card is revealed.  The path may include reversible King/stack shuffles, draws
 * and recycles as setup, but its endpoint is provably "better" on a bounded
 * metric (foundation ≤52 only rises, hidden ≤21 only falls), so committing one
 * such plan after another drives the game forward without ever livelocking.
 *
 * This is what lets the greedy auto-player escape mid-game positions whose only
 * advancing move is a multi-step unburying maneuver, and — in the all-face-up
 * endgame — chain "next foundation card" plans straight to a full clear.
 *
 * Returns the plan (root-first) or `null` when no gain is reachable in budget.
 */
export function findProgressPlan(
  state: PlannerState,
  limits: PlannerLimits = PROGRESS_PLANNER_LIMITS,
): PlanAction[] | null {
  const start = progressSignature(state.board)
  const isGoal = (b: Board): boolean => {
    const s = progressSignature(b)
    return s.foundation > start.foundation || s.hidden < start.hidden
  }
  return search(state, limits, isGoal)
}

/**
 * Bounded breadth-first search shared by {@link findWinningPlan} and
 * {@link findProgressPlan}.  Explores placements (foundation-first), then a
 * draw, then a recycle, pruning revisited positions with a transposition table
 * and stopping at the first board satisfying `isGoal`.
 *
 * BFS (not DFS) is deliberate: it returns the SHORTEST action sequence to the
 * goal.  A depth-first search would happily return the *first* line it stumbles
 * on — which, threading reversible King/stack shuffles, can be thousands of
 * moves long even when the goal is two moves away.  Such a line is valid but
 * useless: it blows the auto-player's step budget and is unwatchable in the
 * live game.  BFS guarantees a near-optimal, executable plan.
 *
 * Parent pointers (not per-node plan copies) keep the frontier compact; the
 * winning line is reconstructed by walking back from the goal's parent.  The
 * search is sound but NOT complete: a `null` result means "no goal reachable
 * within the node budget", not "impossible".
 */
function search(
  state: PlannerState,
  limits: PlannerLimits,
  isGoal: (b: Board) => boolean,
): PlanAction[] | null {
  const { board, drawMode } = state
  const startRecycles = state.recyclesRemaining === Infinity
    ? limits.recycleCap
    : Math.min(state.recyclesRemaining, limits.recycleCap)

  if (isGoal(board)) return []

  const successors = (b: Board, recyclesLeft: number): PlanAction[] => {
    const out: PlanAction[] = []
    for (const mv of orderedPlacements(b)) out.push({ kind: 'move', move: mv })
    if (b.stock.length > 0) out.push({ kind: 'draw' })
    else if (b.waste.length > 0 && recyclesLeft > 0) out.push({ kind: 'recycle' })
    return out
  }

  const advance = (b: Board, recyclesLeft: number, action: PlanAction): { board: Board; recyclesLeft: number } => {
    if (action.kind === 'move') return { board: applyPlacement(b, action.move), recyclesLeft }
    if (action.kind === 'draw') return { board: applyDraw(b, drawMode), recyclesLeft }
    return { board: applyRecycle(b), recyclesLeft: recyclesLeft - 1 }
  }

  const visitKey = (b: Board, r: number) => `${boardKey(b)}~${r}`

  interface Node {
    board: Board
    recyclesLeft: number
    key: string
  }

  // Back-pointer per discovered state: how we got here and from where.
  const parent = new Map<string, { parentKey: string | null; via: PlanAction | null }>()

  // Reconstructs the root-first action list that reaches `key`.
  const reconstruct = (key: string, finalAction: PlanAction): PlanAction[] => {
    const rev: PlanAction[] = [finalAction]
    let k: string | null = key
    while (k !== null) {
      const e = parent.get(k)
      if (!e || e.via === null) break
      rev.push(e.via)
      k = e.parentKey
    }
    rev.reverse()
    return rev
  }

  const rootKey = visitKey(board, startRecycles)
  parent.set(rootKey, { parentKey: null, via: null })

  const queue: Node[] = [{ board, recyclesLeft: startRecycles, key: rootKey }]
  let head = 0
  let budget = limits.maxNodes

  while (head < queue.length) {
    if (budget <= 0) return null
    const node = queue[head++]
    budget -= 1

    for (const action of successors(node.board, node.recyclesLeft)) {
      const child = advance(node.board, node.recyclesLeft, action)

      if (isGoal(child.board)) {
        return reconstruct(node.key, action)
      }

      const key = visitKey(child.board, child.recyclesLeft)
      if (parent.has(key)) continue
      parent.set(key, { parentKey: node.key, via: action })
      queue.push({ board: child.board, recyclesLeft: child.recyclesLeft, key })
    }
  }

  return null
}
