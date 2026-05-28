/**
 * @module hints
 * Computes valid hint moves for the player by checking all playable cards
 * against all valid destination piles. Foundation moves are tested first
 * so the first hint returned is always the most optimal available move.
 */

import type { Card, Hint, Pile } from '../types/cards'

type HintableState = {
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
}

function isRed(card: Card) {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

function canGoToFoundation(card: Card, foundation: Pile): boolean {
  if (foundation.length === 0) return card.rank === 1
  const top = foundation[foundation.length - 1]
  return card.suit === top.suit && card.rank === top.rank + 1
}

function canGoToTableau(card: Card, pile: Pile): boolean {
  if (pile.length === 0) return card.rank === 13
  const top = pile[pile.length - 1]
  if (!top.faceUp) return false
  return isRed(card) !== isRed(top) && card.rank === top.rank - 1
}

/**
 * Returns all valid hint moves given the current board state.
 * Foundation moves come first. Tableau moves follow.
 * Returns an empty array when no moves are available.
 */
export function computeHints({ waste, foundations, tableau }: HintableState): Hint[] {
  const hints: Hint[] = []

  function tryCard(
    card: Card,
    fromType: Hint['fromType'],
    fromIndex: number | undefined,
    cardIndex: number,
  ) {
    // Foundation destinations first (always optimal)
    for (let fi = 0; fi < 4; fi++) {
      if (canGoToFoundation(card, foundations[fi])) {
        hints.push({ fromType, fromIndex, cardIndex, toType: 'foundation', toIndex: fi })
      }
    }
    // Tableau destinations
    for (let ti = 0; ti < 7; ti++) {
      if (fromType === 'tableau' && fromIndex === ti) continue
      if (canGoToTableau(card, tableau[ti])) {
        hints.push({ fromType, fromIndex, cardIndex, toType: 'tableau', toIndex: ti })
      }
    }
  }

  // Waste top card
  if (waste.length > 0) {
    const top = waste[waste.length - 1]
    tryCard(top, 'waste', undefined, waste.length - 1)
  }

  // Each face-up stack in tableau (card at index i is the bottom of a movable stack)
  for (let col = 0; col < 7; col++) {
    const pile = tableau[col]
    for (let i = 0; i < pile.length; i++) {
      if (!pile[i].faceUp) continue
      tryCard(pile[i], 'tableau', col, i)
    }
  }

  return hints
}

/**
 * Filters out hints that make no productive progress — specifically, moving a
 * King to an empty tableau column when there are no face-down cards underneath
 * it to reveal (a pure shuffle with no upside).
 *
 * Rules:
 * - King from waste → empty column: **keep** (unblocks waste, may reveal a
 *   card sequence that was buried)
 * - King from tableau, `cardIndex > 0` → empty column: **keep** (there is at
 *   least one face-down card beneath it; moving the King reveals it)
 * - King from tableau, `cardIndex === 0` → empty column: **discard** (the King
 *   IS the bottom card; nothing is hidden under it — purely circular)
 */
export function filterUsefulHints(
  hints: Hint[],
  tableau: HintableState['tableau'],
): Hint[] {
  return hints.filter(h => {
    // Not targeting an empty tableau column → always keep
    if (h.toType !== 'tableau' || tableau[h.toIndex].length !== 0) return true
    // King from waste to empty column → keep (progress)
    if (h.fromType !== 'tableau') return true
    // King from tableau → keep only when it reveals a hidden card
    return h.cardIndex > 0
  })
}
