export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

export interface Card {
  id: string       // e.g. "hearts-1", "spades-13"
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export type Pile = Card[]

export interface GameState {
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]   // one per suit, indexed 0-3
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]  // 7 columns
}
