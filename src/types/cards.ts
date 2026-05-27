/**
 * @module cards
 * Core domain types for a standard 52-card Klondike Solitaire game.
 */

/** One of the four standard suits. */
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

/** Card rank: 1 (Ace) through 13 (King). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

/** A single playing card. */
export interface Card {
  /** Unique stable identifier, e.g. `"hearts-1"` or `"spades-13"`. */
  id: string
  suit: Suit
  rank: Rank
  /** Whether the card's face is visible to the player. */
  faceUp: boolean
}

/** An ordered sequence of cards (stock, waste, foundation, or tableau column). */
export type Pile = Card[]

/** Full snapshot of a Klondike Solitaire game in progress. */
export interface GameState {
  /** Draw pile; cards are face-down. */
  stock: Pile
  /** Turned-over cards from the stock; only the top card is playable. */
  waste: Pile
  /** Four foundation piles — one per suit, built up from Ace to King. */
  foundations: [Pile, Pile, Pile, Pile]
  /** Seven tableau columns. */
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
}
