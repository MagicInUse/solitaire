/**
 * @module engine/hints
 * Computes and filters hint moves for the player.
 *
 * This module is the DISPLAY layer for hints — it decides which moves are
 * worth showing to the player.  It deliberately suppresses "pure shuffle"
 * moves that provide no strategic value.
 *
 * IMPORTANT: Do not use filterUsefulHints for dead-game detection.
 * Its display-side filtering can incorrectly classify a board as stuck.
 * Use engine/deadGame.ts → isDeadGame() instead.
 */

import type { Card, Hint, Pile } from '../types/cards'
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  isValidRun,
} from './rules'

export type BoardState = {
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
}

// Re-export isValidRun so callers (GameBoard, etc.) don't need two imports.
export { isValidRun }

/**
 * Returns all valid hint moves given the current board state.
 * Foundation moves come first.  Tableau moves follow.
 * Returns an empty array when no moves are available.
 *
 * Sources checked:
 *  - Waste top card
 *  - Every face-up card in each tableau column (bottom of a movable stack)
 *  - Top card of each foundation pile (legal in standard Klondike to move back
 *    to the tableau to unblock sequences)
 */
export function computeHints({ waste, foundations, tableau }: BoardState): Hint[] {
  const hints: Hint[] = []

  function tryCard(
    card: Card,
    fromType: Hint['fromType'],
    fromIndex: number | undefined,
    cardIndex: number,
    isTopCard = true,
  ) {
    // Foundation destinations — never valid from a foundation source, and only
    // valid from a tableau source when the card is the TOP of its pile.
    if (fromType !== 'foundation' && isTopCard) {
      for (let fi = 0; fi < 4; fi++) {
        if (canPlaceOnFoundation(card, foundations[fi])) {
          hints.push({ fromType, fromIndex, cardIndex, toType: 'foundation', toIndex: fi })
        }
      }
    }
    // Tableau destinations
    for (let ti = 0; ti < 7; ti++) {
      if (fromType === 'tableau' && fromIndex === ti) continue
      if (canPlaceOnTableau(card, tableau[ti])) {
        hints.push({ fromType, fromIndex, cardIndex, toType: 'tableau', toIndex: ti })
      }
    }
  }

  // Waste top card
  if (waste.length > 0) {
    const top = waste[waste.length - 1]
    tryCard(top, 'waste', undefined, waste.length - 1)
  }

  // Each face-up stack in tableau.
  // Guard: only emit hints for substacks that form a valid alternating descending
  // sequence — broken runs are not legal moves.
  for (let col = 0; col < 7; col++) {
    const pile = tableau[col]
    for (let i = 0; i < pile.length; i++) {
      if (!pile[i].faceUp) continue
      if (!isValidRun(pile, i)) continue
      const isTopCard = i === pile.length - 1
      tryCard(pile[i], 'tableau', col, i, isTopCard)
    }
  }

  // Foundation top cards — can be moved back to tableau to unblock sequences.
  for (let fi = 0; fi < 4; fi++) {
    const pile = foundations[fi]
    if (pile.length === 0) continue
    const top = pile[pile.length - 1]
    tryCard(top, 'foundation', fi, pile.length - 1)
  }

  return hints
}

// ─── Canonical "useful move" predicate (multi-ply, bounded) ────────────────────
//
// THE single production definition of whether a move is worth showing/playing.
// Both the hint display (filterUsefulHints) and the AI's reachable-progress
// check (engine/deadGame.hasReachableProgress) derive from this, so the two can
// never drift apart again.  It is a production twin of the test-only
// engine/solver.redundancyOracle — independently implemented (over computeHints
// rather than the oracle's own enumeration) so the harness can still cross-check
// production against an independent second opinion.
//
// A move is PRODUCTIVE when it makes immediate progress, OR when within a
// bounded multi-ply look-ahead of non-progress shuffles it unlocks a progress
// move that was not already directly available.  Otherwise it is REDUNDANT
// (a pure loop / dead-end shuffle).  UNKNOWN means the search budget was
// exhausted; callers treat unknown conservatively (not useful) to stay loop-safe.

export type MoveUsefulness = 'productive' | 'redundant' | 'unknown'

/** Budgets, mirroring engine/solver.DEFAULT_REDUNDANCY_LIMITS. */
const USEFUL_MAX_STATES = 4000
const USEFUL_PLY_CAP = 4

interface ProgressMetrics {
  foundation: number
  hidden: number
  emptyCols: number
}

function progressMetrics(b: BoardState): ProgressMetrics {
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
 * AXIS 2 — did going from `before` to `after` advance any monotone metric
 * (foundation up, hidden down, empty columns up) or play a waste card?  This is
 * the canonical per-move progress boolean (identical in spirit to
 * engine/solver.isProgress).
 */
export function isProgressStep(before: BoardState, after: BoardState, fromWaste: boolean): boolean {
  const a = progressMetrics(before)
  const b = progressMetrics(after)
  return b.foundation > a.foundation || b.hidden < a.hidden || b.emptyCols > a.emptyCols || fromWaste
}

/**
 * Applies a hint as a placement on a BoardState, including the INTRINSIC
 * auto-flip of the exposed source card (revealing it is part of the move).
 * Operates only on the three display piles — no stock — since the multi-ply
 * look-ahead only ever chases placements, never draws/recycles.
 */
export function applyHint(board: BoardState, h: Hint): BoardState {
  const { waste, foundations, tableau } = board
  const src: Pile =
    h.fromType === 'waste'
      ? waste
      : h.fromType === 'tableau'
        ? tableau[h.fromIndex!]
        : foundations[h.fromIndex!]

  const moving = src.slice(h.cardIndex).map(c => ({ ...c, faceUp: true }))
  const newSrc = src.slice(0, h.cardIndex)

  const nextTableau = [...tableau] as BoardState['tableau']
  const nextFoundations = [...foundations] as BoardState['foundations']
  const nextWaste = h.fromType === 'waste' ? newSrc : waste

  if (h.fromType === 'tableau') {
    // Auto-flip the newly exposed top card of the source column.
    if (newSrc.length > 0 && !newSrc[newSrc.length - 1].faceUp) {
      newSrc[newSrc.length - 1] = { ...newSrc[newSrc.length - 1], faceUp: true }
    }
    nextTableau[h.fromIndex!] = newSrc
  } else if (h.fromType === 'foundation') {
    nextFoundations[h.fromIndex!] = newSrc
  }

  const dest = h.toType === 'tableau' ? tableau[h.toIndex] : foundations[h.toIndex]
  const newDest = [...dest, ...moving]
  if (h.toType === 'tableau') nextTableau[h.toIndex] = newDest
  else nextFoundations[h.toIndex] = newDest

  return { waste: nextWaste, foundations: nextFoundations, tableau: nextTableau }
}

function hintKey(h: Hint): string {
  return `${h.fromType}:${h.fromIndex ?? ''}:${h.cardIndex}:${h.toType}:${h.toIndex}`
}

function boardStateKey(b: BoardState): string {
  const pile = (p: Pile) => p.map(c => `${c.suit[0]}${c.rank}${c.faceUp ? 'u' : 'd'}`).join(',')
  return pile(b.waste) + '#' + b.foundations.map(pile).join('#') + '|' + b.tableau.map(pile).join('|')
}

/**
 * Classifies a single move on `board` as productive / redundant / unknown using
 * a bounded multi-ply look-ahead.  Faithful production twin of
 * engine/solver.redundancyOracle.
 */
export function classifyMove(board: BoardState, h: Hint): MoveUsefulness {
  const after = applyHint(board, h)

  // Immediate progress → unambiguously productive.
  if (isProgressStep(board, after, h.fromType === 'waste')) return 'productive'

  // Progress moves already available WITHOUT playing `h` — the baseline this
  // move must beat to count as productive.
  const baseline = new Set<string>()
  for (const p of computeHints(board)) {
    if (isProgressStep(board, applyHint(board, p), p.fromType === 'waste')) baseline.add(hintKey(p))
  }

  // Bounded DFS through non-progress shuffles, looking for newly-unlocked
  // progress.  `board` and `after` are pre-visited so we never "rediscover"
  // baseline progress merely by undoing the move.
  const visited = new Set<string>([boardStateKey(board), boardStateKey(after)])
  const stack: { b: BoardState; depth: number }[] = [{ b: after, depth: 0 }]

  let explored = 0
  while (stack.length > 0) {
    if (explored >= USEFUL_MAX_STATES) return 'unknown'
    const node = stack.pop()!
    explored++

    for (const p of computeHints(node.b)) {
      const child = applyHint(node.b, p)
      if (isProgressStep(node.b, child, p.fromType === 'waste')) {
        // Progress the baseline did not already offer, reaching a not-yet-seen
        // state (i.e. not merely undoing `h`) → newly unlocked → productive.
        if (!baseline.has(hintKey(p)) && !visited.has(boardStateKey(child))) return 'productive'
        continue // known / reversal progress — don't dig through it.
      }
      if (node.depth >= USEFUL_PLY_CAP) continue
      const key = boardStateKey(child)
      if (visited.has(key)) continue
      visited.add(key)
      stack.push({ b: child, depth: node.depth + 1 })
    }
  }

  return 'redundant'
}

/**
 * Returns the subset of `hints` worth showing to the player / playing by the
 * AI, ordered so that moves making IMMEDIATE progress come first and merely
 * progress-unlocking shuffles follow.
 *
 * "Useful" = `classifyMove` returns `productive`.  Redundant shuffles, circular
 * back-moves, and budget-exhausted `unknown` moves are dropped.  The
 * immediate-first ordering is what keeps the AI loop-free: it only ever plays a
 * non-progress shuffle when no immediate-progress move exists, and takes the
 * real progress the instant a shuffle unlocks it.
 */
export function filterUsefulHints(
  hints: Hint[],
  tableau: BoardState['tableau'],
  foundations: BoardState['foundations'],
  waste: Pile = [],
): Hint[] {
  const board: BoardState = { waste, foundations, tableau }
  const immediate: Hint[] = []
  const unlockOnly: Hint[] = []

  for (const h of hints) {
    const after = applyHint(board, h)
    if (isProgressStep(board, after, h.fromType === 'waste')) {
      immediate.push(h)
      continue
    }
    if (classifyMove(board, h) === 'productive') unlockOnly.push(h)
  }

  return [...immediate, ...unlockOnly]
}
