/**
 * @module engine/deck
 * Pure deck-building and dealing functions.  No React, no state.
 *
 * Separation rationale: useGameStore currently embeds buildDeck / shuffle /
 * deal as private helpers.  Extracting them here makes them independently
 * testable and removes the Zustand dependency from deal logic.
 */

import type { Card, Pile, Suit, Rank } from '../types/cards'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

/** Builds a fresh, unshuffled 52-card deck. */
export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank: rank as Rank, faceUp: false })
    }
  }
  return deck
}

/**
 * Returns a new array with the elements in a uniformly random order
 * (Fisher-Yates / Knuth shuffle).  Does not mutate the input.
 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Shuffles the deck and deals it into the standard Klondike opening position:
 *  - Seven tableau columns — column i has i+1 cards, last card face-up.
 *  - Remaining cards placed face-down on the stock.
 *  - Waste and all four foundations start empty.
 *
 * @param deck - Optional pre-built deck.  Defaults to a fresh shuffled deck.
 */
export function dealKlondike(deck?: Card[]): {
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
} {
  const cards = shuffle(deck ?? buildDeck())
  const tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile] = [[], [], [], [], [], [], []]

  let cursor = 0
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      tableau[col].push({ ...cards[cursor], faceUp: row === col })
      cursor++
    }
  }

  const stock = cards.slice(cursor).map(c => ({ ...c, faceUp: false }))

  return { stock, waste: [], foundations: [[], [], [], []], tableau }
}
