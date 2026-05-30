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

/**
 * Collects the set of useful follow-up move keys available on the given board.
 * Only considers non-foundation-source moves to prevent mutual recursion.
 * Keys encode all hint fields so two identical moves produce the same string.
 *
 * excludeFromIndex / excludeCardIndex identify the single tableau→foundation
 * circular reversal to skip (the just-placed card going straight back).
 * Pass -1 for both when building a baseline with no exclusion.
 */
export function collectUsefulFollowUpKeys(
  waste: Pile,
  foundations: BoardState['foundations'],
  tableau: BoardState['tableau'],
  excludeFromIndex: number,
  excludeCardIndex: number,
): Set<string> {
  const keys = new Set<string>()
  const rawHints = computeHints({ waste, foundations, tableau })

  for (const fh of rawHints) {
    if (fh.fromType === 'foundation') continue

    if (fh.toType === 'foundation') {
      if (
        fh.fromType === 'tableau' &&
        fh.fromIndex === excludeFromIndex &&
        fh.cardIndex === excludeCardIndex
      ) continue
      keys.add(`${fh.fromType}:${fh.fromIndex ?? ''}:${fh.cardIndex}:foundation:${fh.toIndex}`)
      continue
    }

    // fh.toType === 'tableau'
    if (fh.fromType !== 'tableau') {
      keys.add(`waste::${fh.cardIndex}:tableau:${fh.toIndex}`)
      continue
    }

    const srcPile = tableau[fh.fromIndex!]
    const revealsHidden = fh.cardIndex > 0 && !srcPile[fh.cardIndex - 1].faceUp
    const toEmpty = tableau[fh.toIndex].length === 0
    if (toEmpty ? revealsHidden : (revealsHidden || fh.cardIndex === 0)) {
      keys.add(`tableau:${fh.fromIndex}:${fh.cardIndex}:tableau:${fh.toIndex}`)
    }
  }
  return keys
}

/**
 * Returns true when moving the top card of foundations[h.fromIndex] to
 * tableau[h.toIndex] unlocks at least one new useful follow-up move.
 *
 * Back-moves are worthless — and will immediately be contradicted by the
 * next hint — unless they create a new landing spot that triggers progress.
 * Classic circular trap: move A♠ foundation→tableau, then hint says move
 * A♠ tableau→foundation, repeat forever.
 */
export function isProductiveBackMove(
  h: Hint,
  waste: Pile,
  foundations: BoardState['foundations'],
  tableau: BoardState['tableau'],
): boolean {
  const srcPile = foundations[h.fromIndex!]
  if (srcPile.length === 0) return false
  const card = srcPile[srcPile.length - 1]

  // Aces: nothing can ever land on top of them → always circular.
  if (card.rank - 1 < 1) return false

  const simFoundations = foundations.map((p, i) =>
    i === h.fromIndex ? p.slice(0, -1) : p
  ) as BoardState['foundations']
  const simTableau = tableau.map((p, i) =>
    i === h.toIndex ? [...p, { ...card, faceUp: true }] : p
  ) as BoardState['tableau']

  const placedCardIndex = simTableau[h.toIndex].length - 1

  const originalKeys = collectUsefulFollowUpKeys(waste, foundations, tableau, -1, -1)
  const simKeys      = collectUsefulFollowUpKeys(
    waste,
    simFoundations,
    simTableau,
    h.toIndex,
    placedCardIndex,
  )

  for (const key of simKeys) {
    if (!originalKeys.has(key)) return true
  }
  return false
}

/**
 * Filters out hints that make no productive progress from the player's
 * perspective (display-only concern).
 *
 * A tableau→tableau move is useful only when it either:
 *  - Reveals at least one face-down card, OR
 *  - Empties the source column entirely (cardIndex === 0), creating an open
 *    slot that a King can fill.
 *
 * Moves satisfying neither condition are pure shuffles — they rearrange
 * already-accessible cards between non-empty piles with no strategic upside.
 *
 * Non-tableau destinations and non-tableau sources are always kept.
 * Foundation back-moves are suppressed when any non-back-move hint exists,
 * and otherwise only kept when they're genuinely productive.
 *
 * NOTE: This function is for DISPLAY only. Never call it from isDeadGame —
 * its filtering can cause false dead-game positives.  Use engine/deadGame.ts.
 */
export function filterUsefulHints(
  hints: Hint[],
  tableau: BoardState['tableau'],
  foundations: BoardState['foundations'],
  waste: Pile = [],
): Hint[] {
  const filtered = hints.filter(h => {
    if (h.toType !== 'tableau') return true
    if (h.fromType === 'foundation') return true
    if (h.fromType !== 'tableau') return true

    const srcPile = tableau[h.fromIndex!]
    const revealsHidden = h.cardIndex > 0 && !srcPile[h.cardIndex - 1].faceUp
    const toEmpty = tableau[h.toIndex].length === 0

    if (toEmpty) {
      return revealsHidden
    }
    return revealsHidden || h.cardIndex === 0
  })

  const nonBacktrack = filtered.filter(h => h.fromType !== 'foundation')
  if (nonBacktrack.length > 0) return nonBacktrack

  const productiveBackMoves = filtered
    .filter(h => h.fromType === 'foundation')
    .filter(h => isProductiveBackMove(h, waste, foundations, tableau))
  return productiveBackMoves.slice(0, 1)
}
