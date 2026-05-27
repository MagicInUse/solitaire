import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Card, Pile, Rank, Suit } from '../types/cards'

// ─── Deck helpers ────────────────────────────────────────────────────────────

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank: rank as Rank, faceUp: false })
    }
  }
  return deck
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function deal(deck: Card[]): {
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
} {
  const cards = shuffle(deck)
  const tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile] = [[], [], [], [], [], [], []]

  // Deal cards into tableau: column i gets i+1 cards, last card face-up
  let cursor = 0
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      tableau[col].push({ ...cards[cursor], faceUp: row === col })
      cursor++
    }
  }

  const stock = cards.slice(cursor).map(c => ({ ...c, faceUp: false }))

  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
  }
}

// ─── Store types ─────────────────────────────────────────────────────────────

interface GameStore {
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]

  newGame: () => void
  drawFromStock: () => void
  resetStock: () => void

  /** Move a card (or stack) from one pile to another. */
  moveCards: (params: {
    fromType: 'waste' | 'tableau' | 'foundation'
    fromIndex?: number   // tableau/foundation column index
    cardIndex: number    // index of the card in its source pile
    toType: 'tableau' | 'foundation'
    toIndex: number
  }) => void

  /** Flip the top card of a tableau column face-up. */
  flipTableauTop: (colIndex: number) => void
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...deal(buildDeck()),

      newGame() {
        set(deal(buildDeck()))
      },

      drawFromStock() {
        const { stock, waste } = get()
        if (stock.length === 0) return
        const [top, ...rest] = [...stock].reverse()
        set({
          stock: rest.reverse(),
          waste: [...waste, { ...top, faceUp: true }],
        })
      },

      resetStock() {
        const { waste } = get()
        set({
          stock: [...waste].reverse().map(c => ({ ...c, faceUp: false })),
          waste: [],
        })
      },

      moveCards({ fromType, fromIndex, cardIndex, toType, toIndex }) {
        const state = get()

        // Grab source pile reference
        let sourcePile: Pile
        if (fromType === 'waste') sourcePile = state.waste
        else if (fromType === 'tableau') sourcePile = state.tableau[fromIndex!]
        else sourcePile = state.foundations[fromIndex!]

        const movingCards = sourcePile.slice(cardIndex)
        const newSource = sourcePile.slice(0, cardIndex)

        // Grab destination pile
        const destPile =
          toType === 'tableau'
            ? state.tableau[toIndex]
            : state.foundations[toIndex]

        const newDest = [...destPile, ...movingCards]

        // Build next state immutably
        const nextTableau = [...state.tableau] as typeof state.tableau
        const nextFoundations = [...state.foundations] as typeof state.foundations
        const nextWaste = fromType === 'waste' ? newSource : state.waste

        if (fromType === 'tableau') nextTableau[fromIndex!] = newSource
        if (fromType === 'foundation') nextFoundations[fromIndex!] = newSource

        if (toType === 'tableau') nextTableau[toIndex] = newDest
        else nextFoundations[toIndex] = newDest

        set({ tableau: nextTableau, foundations: nextFoundations, waste: nextWaste })
      },

      flipTableauTop(colIndex) {
        const nextTableau = [...get().tableau] as GameStore['tableau']
        const col = [...nextTableau[colIndex]]
        if (col.length > 0 && !col[col.length - 1].faceUp) {
          col[col.length - 1] = { ...col[col.length - 1], faceUp: true }
          nextTableau[colIndex] = col
          set({ tableau: nextTableau })
        }
      },
    }),
    {
      name: 'solitaire-game',    // localStorage key
      version: 2,               // bumped to clear any corrupted v1 state
    }
  )
)
