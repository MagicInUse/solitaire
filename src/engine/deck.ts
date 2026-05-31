/**
 * @module engine/deck
 * Pure deck-building and dealing functions.  No React, no state.
 *
 * Separation rationale: useGameStore currently embeds buildDeck / shuffle /
 * deal as private helpers.  Extracting them here makes them independently
 * testable and removes the Zustand dependency from deal logic.
 */

import type { Card, Pile, Suit, Rank } from '../types/cards'
import { makeRng, randomSeed, type Rng } from './rng'

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
 *
 * @param arr - The array to shuffle (left untouched).
 * @param rng - Optional deterministic random source.  When provided, the
 *   shuffle is fully reproducible; when omitted it falls back to
 *   `Math.random()` for ordinary (non-seeded) play.
 */
export function shuffle<T>(arr: T[], rng?: Rng): T[] {
  const rand = rng ? rng.next : Math.random
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
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
 * @param opts.deck - Optional pre-built deck.  Defaults to a fresh deck.
 * @param opts.seed - Optional string seed for a reproducible deal.  When
 *   provided (and no explicit `rng` is given) the deal is fully
 *   deterministic and `seed` is echoed back in the result.
 * @param opts.rng - Optional pre-built deterministic random source.  Takes
 *   precedence over `seed`.
 * @returns The dealt board plus the `seed` that produced it (a freshly
 *   generated random seed when none was supplied).
 */
export function dealKlondike(opts: {
  deck?: Card[]
  seed?: string
  rng?: Rng
} = {}): {
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
  seed: string
} {
  const rng = opts.rng ?? makeRng(opts.seed ?? randomSeed())
  const cards = shuffle(opts.deck ?? buildDeck(), rng)
  const tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile] = [[], [], [], [], [], [], []]

  let cursor = 0
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      tableau[col].push({ ...cards[cursor], faceUp: row === col })
      cursor++
    }
  }

  const stock = cards.slice(cursor).map(c => ({ ...c, faceUp: false }))

  return { stock, waste: [], foundations: [[], [], [], []], tableau, seed: rng.seed }
}
