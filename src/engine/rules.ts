/**
 * @module engine/rules
 * Pure Klondike rule functions — the single source of truth for all card
 * placement logic.  No React, no state, no side-effects.
 *
 * Every other module that needs to decide "can card X land on pile Y?"
 * should import from here rather than re-implementing the logic locally.
 */

import type { Card, Pile } from '../types/cards'

/** Returns true when the card is a red suit (hearts or diamonds). */
export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

/**
 * Returns true when `card` can legally be placed on `foundation`.
 * Foundations accept Aces on empty piles, then ascending same-suit sequence.
 */
export function canPlaceOnFoundation(card: Card, foundation: Pile): boolean {
  if (foundation.length === 0) return card.rank === 1
  const top = foundation[foundation.length - 1]
  return card.suit === top.suit && card.rank === top.rank + 1
}

/**
 * Returns true when `card` can legally be placed on `pile` as a tableau column.
 * Tableau requires alternating colours and descending rank.
 * Kings (rank 13) are the only cards that may go onto an empty pile.
 */
export function canPlaceOnTableau(card: Card, pile: Pile): boolean {
  if (pile.length === 0) return card.rank === 13
  const top = pile[pile.length - 1]
  if (!top.faceUp) return false
  return isRed(card) !== isRed(top) && card.rank === top.rank - 1
}

/**
 * Returns true when pile[startIndex..] is a valid alternating-colour
 * descending sequence (each card one rank lower than and opposite colour to
 * the card above it).  A single card is trivially valid.
 */
export function isValidRun(pile: Pile, startIndex: number): boolean {
  for (let j = startIndex; j < pile.length - 1; j++) {
    const cur  = pile[j]
    const next = pile[j + 1]
    if (!next.faceUp)               return false
    if (next.rank !== cur.rank - 1) return false
    if (isRed(next) === isRed(cur)) return false
  }
  return true
}

/**
 * Returns true when `movingCards` form a valid stack and can legally land on
 * `destPile` at the given destination type.
 *
 * Validates:
 *  - Non-empty stack and top card is face-up.
 *  - Foundation destinations: single card only, canPlaceOnFoundation.
 *  - Tableau destinations: internal alternating-colour descending sequence,
 *    then canPlaceOnTableau for the bottom card of the moving stack.
 */
export function canMoveStack(
  movingCards: Card[],
  destPile: Pile,
  toType: 'tableau' | 'foundation',
): boolean {
  if (movingCards.length === 0) return false
  if (!movingCards[0].faceUp) return false

  if (toType === 'foundation') {
    if (movingCards.length !== 1) return false
    return canPlaceOnFoundation(movingCards[0], destPile)
  }

  // Validate the internal stack sequence
  for (let j = 0; j < movingCards.length - 1; j++) {
    const cur = movingCards[j]
    const nxt = movingCards[j + 1]
    if (!nxt.faceUp)               return false
    if (nxt.rank !== cur.rank - 1) return false
    if (isRed(nxt) === isRed(cur)) return false
  }

  return canPlaceOnTableau(movingCards[0], destPile)
}
