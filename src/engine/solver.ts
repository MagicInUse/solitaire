/**
 * @module engine/solver
 * Independent, test-only oracle for the three logic axes of Klondike.
 *
 * PURPOSE — this module is the harness's *second opinion*.  It re-derives
 * "liveness", "progress", and "redundancy" from first principles so that the
 * production heuristics (engine/hints.ts and engine/deadGame.ts) cannot
 * validate themselves.  It therefore imports ONLY:
 *   - engine/rules    — the canonical legal-placement rulebook (ground truth),
 *   - engine/gameActions — the shared board transitions (ground truth),
 *   - types/cards.
 * It deliberately does NOT import computeHints / filterUsefulHints /
 * isDirectProgress / isDeadGame.  If a production bug agreed with a buggy
 * oracle, the harness would be blind; independence is the whole point.
 *
 * NOT IN SCOPE: winnability / full solve (intractable, deferred).  Every
 * search here is BOUNDED and TRI-STATE: a definitive yes/no, or `unknown`
 * when the budget is exhausted.  An `unknown` is never counted as a bug — the
 * harness must never make a false accusation on a truncated search.
 *
 * THE THREE AXES (ratified definitions):
 *  1. LIVENESS  — drives the dead-game modal.  DEAD iff NO legal move of any
 *     kind exists in ANY state reachable via draws + remaining recycles.
 *  2. PROGRESS  — drives scoring / "genuine progress".  A per-move BOOLEAN:
 *     foundation up, hidden cards down, empty columns up, OR a waste card was
 *     played.  Never a sum of metrics.  Auto-flip is intrinsic to the move.
 *  3. REDUNDANCY — drives hint suppression / AI-loop detection.  A move is
 *     redundant if it makes no progress and, within a bounded multi-ply
 *     look-ahead, unlocks no progress that was not already available.
 */

import type { Card, Pile } from '../types/cards'
import { canPlaceOnFoundation, canPlaceOnTableau, canMoveStack, isValidRun } from './rules'
import { applyDraw, applyRecycle, applyMove, applyFlip, type Board, type MoveParams } from './gameActions'

// ─── Verdict & limits ─────────────────────────────────────────────────────────

/** Liveness verdict. `unknown` = search budget exhausted (never asserted as a bug). */
export type Liveness = 'alive' | 'dead' | 'unknown'

/** Redundancy verdict. `unknown` = search budget exhausted (never asserted as a bug). */
export type Redundancy = 'redundant' | 'productive' | 'unknown'

/** Bounds for the liveness draw/recycle traversal. */
export interface LivenessLimits {
  /** Hard cap on expanded states before returning `unknown`. */
  maxStates: number
}

/** Bounds for the redundancy multi-ply look-ahead. */
export interface RedundancyLimits {
  /** Hard cap on expanded states before returning `unknown`. */
  maxStates: number
  /** Maximum plies of non-progress "shuffles" to chase before giving up. */
  plyCap: number
}

/** Reference budgets, chosen to mirror deadGame.ts (MAX_DEPTH 80 / MAX_STATES 4000). */
export const DEFAULT_LIVENESS_LIMITS: LivenessLimits = { maxStates: 4000 }
export const DEFAULT_REDUNDANCY_LIMITS: RedundancyLimits = { maxStates: 4000, plyCap: 4 }

// ─── Placement model (the oracle's own legal-move enumeration) ─────────────────

/**
 * A single card/stack placement onto a build pile.  Draw and recycle are not
 * placements — they are traversal steps handled separately by the liveness
 * search.  Shaped to be directly usable as {@link MoveParams}.
 */
export interface Placement {
  fromType: 'waste' | 'tableau' | 'foundation'
  fromIndex?: number
  cardIndex: number
  toType: 'tableau' | 'foundation'
  toIndex: number
}

/** Index of the first face-up card in a column, or `col.length` if none. */
function firstFaceUp(col: Pile): number {
  for (let i = 0; i < col.length; i++) if (col[i].faceUp) return i
  return col.length
}

/**
 * Enumerates EVERY legal card placement on `board`, derived solely from the
 * rulebook (engine/rules).  This is the oracle's independent notion of "a
 * legal move", with no usefulness filtering whatsoever.
 *
 * @param includeFoundationSource - When true, also enumerates foundation→tableau
 *   back-moves.  Liveness counts these (any legal move keeps the game alive);
 *   most other callers leave them out.
 */
export function enumeratePlacements(board: Board, includeFoundationSource = false): Placement[] {
  const { waste, tableau, foundations } = board
  const out: Placement[] = []

  // Waste top → foundation / tableau.
  if (waste.length > 0) {
    const card = waste[waste.length - 1]
    const cardIndex = waste.length - 1
    for (let f = 0; f < 4; f++)
      if (canPlaceOnFoundation(card, foundations[f]))
        out.push({ fromType: 'waste', cardIndex, toType: 'foundation', toIndex: f })
    for (let t = 0; t < 7; t++)
      if (canPlaceOnTableau(card, tableau[t]))
        out.push({ fromType: 'waste', cardIndex, toType: 'tableau', toIndex: t })
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
            out.push({ fromType: 'tableau', fromIndex: i, cardIndex: ci, toType: 'foundation', toIndex: f })
      }
      for (let t = 0; t < 7; t++) {
        if (t === i) continue
        if (canMoveStack(run, tableau[t], 'tableau'))
          out.push({ fromType: 'tableau', fromIndex: i, cardIndex: ci, toType: 'tableau', toIndex: t })
      }
    }
  }

  // Foundation top → tableau (back-moves) — liveness only.
  if (includeFoundationSource) {
    for (let f = 0; f < 4; f++) {
      const fp = foundations[f]
      if (fp.length === 0) continue
      const card = fp[fp.length - 1]
      for (let t = 0; t < 7; t++)
        if (canPlaceOnTableau(card, tableau[t]))
          out.push({ fromType: 'foundation', fromIndex: f, cardIndex: fp.length - 1, toType: 'tableau', toIndex: t })
    }
  }

  return out
}

/**
 * Applies a placement, including the INTRINSIC auto-flip of the source column
 * (Vegas-style — revealing the exposed card is part of the move, not a
 * separate action).  Uses the shared transitions so the oracle's board math
 * is identical to live play.
 */
export function applyPlacement(board: Board, p: Placement): Board {
  let next = applyMove(board, p as MoveParams)
  if (p.fromType === 'tableau') next = applyFlip(next, p.fromIndex!)
  return next
}

/** A stable signature for a placement, board-relative (matches deadGame keying). */
function placementKey(p: Placement): string {
  return `${p.fromType}:${p.fromIndex ?? ''}:${p.cardIndex}:${p.toType}:${p.toIndex}`
}

// ─── AXIS 2: PROGRESS (exact, per-move boolean) ────────────────────────────────

interface Metrics {
  foundation: number
  hidden: number
  emptyCols: number
}

function metrics(b: Board): Metrics {
  let foundation = 0
  for (const f of b.foundations) foundation += f.length
  let hidden = 0
  let emptyCols = 0
  for (const col of b.tableau) {
    for (const c of col) if (!c.faceUp) hidden++
    if (col.length === 0) emptyCols++
  }
  return { foundation, hidden, emptyCols }
}

/**
 * Returns true when going from `before` to `after` advanced any monotone
 * metric, OR a waste card was played.  This is the canonical axis-2 predicate
 * the harness measures the production scoring/hint copy against.
 */
export function isProgress(before: Board, after: Board, fromWaste: boolean): boolean {
  const a = metrics(before)
  const b = metrics(after)
  return b.foundation > a.foundation || b.hidden < a.hidden || b.emptyCols > a.emptyCols || fromWaste
}

/**
 * AXIS 2 oracle: did playing `move` on `board` make genuine progress?
 * Exact (single-step metric comparison) — no search, no `unknown`.
 */
export function progressOracle(board: Board, move: Placement): boolean {
  const after = applyPlacement(board, move)
  return isProgress(board, after, move.fromType === 'waste')
}

// ─── State keying (for dedupe in bounded searches) ─────────────────────────────

function pileKey(p: Pile): string {
  return p.map((c: Card) => `${c.suit[0]}${c.rank}${c.faceUp ? 'u' : 'd'}`).join(',')
}

function boardKey(b: Board): string {
  return [
    b.stock.map((c) => `${c.suit[0]}${c.rank}`).join(','),
    pileKey(b.waste),
    b.foundations.map(pileKey).join('#'),
    b.tableau.map(pileKey).join('|'),
  ].join('/')
}

// ─── AXIS 1: LIVENESS (bounded draw/recycle traversal) ─────────────────────────

/**
 * AXIS 1 oracle: is the game still alive?
 *
 * ALIVE  — some state reachable by drawing/recycling admits at least one legal
 *          placement of ANY kind (including foundation→tableau back-moves and
 *          King-to-empty relocations — the strictest liveness ruling).
 * DEAD   — every reachable draw/recycle state has zero legal placements.
 * UNKNOWN— the state budget was exhausted first.
 *
 * The search only ever *traverses* via draw and recycle: the instant any state
 * has a placement, a legal move exists and the game is alive, so placements
 * never need to be followed (a placement would itself be the witness).  This
 * keeps liveness cheap while remaining exhaustive over draw-3 reachability and
 * the remaining recycles.
 */
export function livenessOracle(
  board: Board,
  recyclesRemaining: number,
  drawMode: 1 | 3,
  limits: LivenessLimits = DEFAULT_LIVENESS_LIMITS,
): Liveness {
  interface Node {
    board: Board
    recyclesLeft: number
  }

  const visited = new Set<string>()
  const queue: Node[] = []

  const enqueue = (node: Node): void => {
    const key = `${boardKey(node.board)}~${node.recyclesLeft}`
    if (visited.has(key)) return
    visited.add(key)
    queue.push(node)
  }

  enqueue({ board, recyclesLeft: Math.max(0, recyclesRemaining) })

  let explored = 0
  while (queue.length > 0) {
    if (explored >= limits.maxStates) return 'unknown'
    const node = queue.shift()!
    explored++

    // Witness: any legal move (incl. back-moves) → the game is alive.
    if (enumeratePlacements(node.board, true).length > 0) return 'alive'

    // Otherwise traverse: draw if able, else recycle if allowed.
    if (node.board.stock.length > 0) {
      enqueue({ board: applyDraw(node.board, drawMode), recyclesLeft: node.recyclesLeft })
    } else if (node.recyclesLeft > 0 && node.board.waste.length > 0) {
      enqueue({ board: applyRecycle(node.board), recyclesLeft: node.recyclesLeft - 1 })
    }
  }

  return 'dead'
}

// ─── AXIS 3: REDUNDANCY (bounded multi-ply look-ahead) ─────────────────────────

/**
 * AXIS 3 oracle: is `move` a redundant shuffle, or does it unlock progress?
 *
 * PRODUCTIVE — the move itself makes progress, OR within `plyCap` plies of
 *              non-progress shuffles it reaches a progress move that was NOT
 *              already directly available before the move.
 * REDUNDANT  — no immediate progress and no newly-unlocked progress within the
 *              budget (a pure loop: foundation↔tableau ping-pong, K-shuffle).
 * UNKNOWN    — the state budget was exhausted first.
 *
 * This generalises deadGame.ts's 1-ply `isBackMoveProductive` to a bounded
 * multi-ply search over all move types, derived independently from the
 * rulebook.  The verdict is bounded, so a `redundant` result is a *candidate*
 * for the harness to surface with its reproducing seed, not a proof.
 */
export function redundancyOracle(
  board: Board,
  move: Placement,
  limits: RedundancyLimits = DEFAULT_REDUNDANCY_LIMITS,
): Redundancy {
  const after = applyPlacement(board, move)

  // Immediate progress → unambiguously productive.
  if (isProgress(board, after, move.fromType === 'waste')) return 'productive'

  // Progress moves already available WITHOUT playing `move` — the baseline the
  // move must beat to count as productive.
  const baseline = new Set<string>()
  for (const p of enumeratePlacements(board, true)) {
    if (progressOracle(board, p)) baseline.add(placementKey(p))
  }

  // Bounded DFS through non-progress shuffles, looking for newly-unlocked
  // progress.  `board` is pre-visited so we never "rediscover" baseline
  // progress merely by undoing the move.
  const visited = new Set<string>([boardKey(board), boardKey(after)])
  const stack: { b: Board; depth: number }[] = [{ b: after, depth: 0 }]

  let explored = 0
  while (stack.length > 0) {
    if (explored >= limits.maxStates) return 'unknown'
    const node = stack.pop()!
    explored++

    for (const p of enumeratePlacements(node.b, true)) {
      const child = applyPlacement(node.b, p)
      if (isProgress(node.b, child, p.fromType === 'waste')) {
        // A progress move the baseline did not already offer, that does not
        // simply return to an already-seen state (e.g. undoing `move` straight
        // back to the foundation), counts as newly-unlocked → productive.
        if (!baseline.has(placementKey(p)) && !visited.has(boardKey(child))) return 'productive'
        continue // known progress, or a reversal — don't dig through it.
      }
      // Non-progress shuffle: chase it deeper, within the ply cap.
      if (node.depth >= limits.plyCap) continue
      const key = boardKey(child)
      if (visited.has(key)) continue
      visited.add(key)
      stack.push({ b: child, depth: node.depth + 1 })
    }
  }

  return 'redundant'
}
