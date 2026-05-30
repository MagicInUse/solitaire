/**
 * @module useGameStore
 * Zustand store managing the full Klondike Solitaire game state.
 *
 * State is persisted to `localStorage` under the key `"solitaire-game"`
 * (v3 — bumped to clear v2 state after schema additions).
 *
 * Transient fields (`history`, `activeHint`) are excluded from persistence
 * via `partialize` and reset to defaults on hydration.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Pile, GameStateSnapshot, Hint } from '../types/cards'
import { dealKlondike } from '../engine/deck'
import { checkWin }    from '../engine/gameLogic'

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Captures a shallow-but-sufficient snapshot of the mutable board piles. */
function snapshot(state: Pick<GameStore, 'stock' | 'waste' | 'foundations' | 'tableau' | 'moveCount'>): GameStateSnapshot {
  return {
    stock:       [...state.stock],
    waste:       [...state.waste],
    foundations: state.foundations.map((p) => [...p]) as [Pile, Pile, Pile, Pile],
    tableau:     state.tableau.map((p) => [...p]) as [Pile, Pile, Pile, Pile, Pile, Pile, Pile],
    moveCount:   state.moveCount,
  }
}

const MAX_HISTORY = 100

// ─── Store types ─────────────────────────────────────────────────────────────

/** Shape of the Zustand game store — state slices plus action methods. */
interface GameStore {
  // ── Board state ──────────────────────────────────────────────────────────
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]

  // ── Game metadata ────────────────────────────────────────────────────────
  /** True once all 52 cards have reached the foundations. */
  won: boolean
  /** Total card moves made this game (incremented by moveCards). */
  moveCount: number
  /** Number of times the player has used undo this game. */
  undosUsed: number
  /** Number of times the waste pile has been recycled to stock this game. */
  recycleCount: number

  // ── Transient (not persisted) ────────────────────────────────────────────
  /** Board snapshots for undo; not persisted — cleared on page reload. */
  history: GameStateSnapshot[]
  /** Currently highlighted hint move; null when no hint is active. */
  activeHint: Hint | null
  /** True while the deal-in animation is playing after a new game. */
  isDealing: boolean
  /** Incremented on each newGame() so CardViews can detect a fresh deal. */
  dealId: number
  /** Incremented on each drawFromStock() so the waste fan can animate the new batch. */
  drawId: number

  // ── Actions ──────────────────────────────────────────────────────────────
  /** Start a fresh game with a new shuffled deal. */
  newGame: () => void
  /**
   * Draw cards from the stock onto the waste pile.
   * The caller must pass the current `drawMode` (1 or 3) from useOptionsStore.
   */
  drawFromStock: (drawMode: 1 | 3) => void
  /**
   * Recycle the waste pile back into the stock.
   * The caller (GameBoard) is responsible for checking the recycle limit
   * before invoking this action.
   */
  resetStock: () => void
  /** Move a card (or stack) from one pile to another. */
  moveCards: (params: {
    fromType: 'waste' | 'tableau' | 'foundation'
    fromIndex?: number
    cardIndex: number
    toType: 'tableau' | 'foundation'
    toIndex: number
  }) => void
  /** Flip the top card of a tableau column face-up (called after moveCards). */
  flipTableauTop: (colIndex: number) => void
  /** Restore the board to its state before the last action. */
  undo: () => void
  /** Set or clear the active hint highlight. */
  setActiveHint: (hint: Hint | null) => void
  /** Clears the isDealing flag (called by GameBoard after the deal animation). */
  setDealing: (v: boolean) => void
}

// ─── Store implementation ─────────────────────────────────────────────────────

/**
 * Primary Zustand hook for the Klondike Solitaire game.
 *
 * Persists state to `localStorage` (key: `"solitaire-game"`, version 3).
 * Transient fields (`history`, `activeHint`) are excluded via `partialize`.
 * Consume via `const { stock, moveCards, ... } = useGameStore()`.
 */
export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...dealKlondike(),

      // ── Metadata defaults ───────────────────────────────────────────────
      won: false,
      moveCount: 0,
      undosUsed: 0,
      recycleCount: 0,

      // ── Transient defaults (populated in memory only) ───────────────────
      history: [],
      activeHint: null,
      isDealing: false,
      dealId: 0,
      drawId: 0,

      // ── Actions ─────────────────────────────────────────────────────────

      newGame() {
        set({
          ...dealKlondike(),
          won: false,
          moveCount: 0,
          undosUsed: 0,
          recycleCount: 0,
          history: [],
          activeHint: null,
          isDealing: true,
          dealId: get().dealId + 1,
        })
      },

      drawFromStock(drawMode) {
        const state = get()
        if (state.stock.length === 0) return

        const count = Math.min(drawMode, state.stock.length)

        // stock[last] is the top — slice from the end
        const newStock = state.stock.slice(0, state.stock.length - count)
        const drawn = state.stock
          .slice(state.stock.length - count)
          .map((c) => ({ ...c, faceUp: true }))

        set({
          stock: newStock,
          waste: [...state.waste, ...drawn],
          drawId: get().drawId + 1,
          history: [...state.history, snapshot(state)].slice(-MAX_HISTORY),
          activeHint: null,
        })
      },

      resetStock() {
        const state = get()
        set({
          stock: [...state.waste].reverse().map((c) => ({ ...c, faceUp: false })),
          waste: [],
          recycleCount: state.recycleCount + 1,
          history: [...state.history, snapshot(state)].slice(-MAX_HISTORY),
          activeHint: null,
        })
      },

      moveCards({ fromType, fromIndex, cardIndex, toType, toIndex }) {
        const state = get()

        // ── Resolve source pile ──────────────────────────────────────────
        let sourcePile: Pile
        if (fromType === 'waste') sourcePile = state.waste
        else if (fromType === 'tableau') sourcePile = state.tableau[fromIndex!]
        else sourcePile = state.foundations[fromIndex!]

        const movingCards = sourcePile.slice(cardIndex)
        const newSource   = sourcePile.slice(0, cardIndex)

        // ── Resolve destination pile ─────────────────────────────────────
        const destPile = toType === 'tableau'
          ? state.tableau[toIndex]
          : state.foundations[toIndex]
        const newDest = [...destPile, ...movingCards]

        // ── Build next state immutably ───────────────────────────────────
        const nextTableau     = [...state.tableau]     as typeof state.tableau
        const nextFoundations = [...state.foundations] as typeof state.foundations
        const nextWaste       = fromType === 'waste' ? newSource : state.waste

        if (fromType === 'tableau')    nextTableau[fromIndex!]     = newSource
        if (fromType === 'foundation') nextFoundations[fromIndex!] = newSource

        if (toType === 'tableau') nextTableau[toIndex]      = newDest
        else                      nextFoundations[toIndex]  = newDest

        const won = checkWin(nextFoundations)

        set({
          tableau:     nextTableau,
          foundations: nextFoundations,
          waste:       nextWaste,
          won,
          moveCount:   state.moveCount + 1,
          history:     [...state.history, snapshot(state)].slice(-MAX_HISTORY),
          activeHint:  null,
        })
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

      undo() {
        const { history, undosUsed } = get()
        if (history.length === 0) return
        const prev = history[history.length - 1]
        set({
          ...prev,
          won:        false,
          undosUsed:  undosUsed + 1,
          history:    history.slice(0, -1),
          activeHint: null,
        })
      },

      setActiveHint(hint) {
        set({ activeHint: hint })
      },

      setDealing(v: boolean) {
        set({ isDealing: v })
      },
    }),
    {
      name: 'solitaire-game',
      version: 3,
      // Exclude transient state from localStorage
      partialize: ({ history: _h, activeHint: _a, isDealing: _d, dealId: _id, drawId: _did, setDealing: _sd, ...persisted }) => persisted,
    }
  )
)
