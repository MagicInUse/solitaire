/**
 * @module useGameStore
 * Zustand store managing the full Klondike Solitaire game state.
 *
 * State is persisted to `localStorage` under the key `"solitaire-game"`
 * (v4 — bumped when `seed` + `moveLog` were added for reproducible deals).
 *
 * Transient fields (`history`, `activeHint`) are excluded from persistence
 * via `partialize` and reset to defaults on hydration.  `seed` and `moveLog`
 * ARE persisted so an in-progress game can be replayed deterministically.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Pile, GameStateSnapshot, Hint } from '../types/cards'
import { dealKlondike } from '../engine/deck'
import { checkWin }    from '../engine/gameLogic'
import {
  applyDraw, applyRecycle, applyMove, applyFlip,
  type Board, type LoggedAction,
} from '../engine/gameActions'

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

  /** String seed that produced this game's deal; enables exact replay. */
  seed: string
  /**
   * Ordered log of every board-mutating action this game (draw, recycle,
   * move, flip, undo).  Combined with `seed` it deterministically
   * reconstructs the current board via engine/replay — the unit of
   * reproducibility for human games.
   */
  moveLog: LoggedAction[]

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
  /**
   * Start a fresh game with a new shuffled deal.
   * @param seed - Optional string seed for a reproducible deal (dev/replay).
   *   When omitted a fresh random seed is generated.
   */
  newGame: (seed?: string) => void
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
      moveLog: [],

      // ── Transient defaults (populated in memory only) ───────────────────
      history: [],
      activeHint: null,
      isDealing: false,
      dealId: 0,
      drawId: 0,

      // ── Actions ─────────────────────────────────────────────────────────

      newGame(seed?: string) {
        set({
          ...dealKlondike(seed ? { seed } : {}),
          won: false,
          moveCount: 0,
          undosUsed: 0,
          recycleCount: 0,
          moveLog: [],
          history: [],
          activeHint: null,
          isDealing: true,
          dealId: get().dealId + 1,
        })
      },

      drawFromStock(drawMode) {
        const state = get()
        if (state.stock.length === 0) return

        const board: Board = {
          stock: state.stock, waste: state.waste,
          foundations: state.foundations, tableau: state.tableau,
        }
        const next = applyDraw(board, drawMode)

        set({
          stock: next.stock,
          waste: next.waste,
          drawId: get().drawId + 1,
          history: [...state.history, snapshot(state)].slice(-MAX_HISTORY),
          moveLog: [...state.moveLog, { type: 'draw', drawMode }],
          activeHint: null,
        })
      },

      resetStock() {
        const state = get()
        const board: Board = {
          stock: state.stock, waste: state.waste,
          foundations: state.foundations, tableau: state.tableau,
        }
        const next = applyRecycle(board)
        set({
          stock: next.stock,
          waste: next.waste,
          recycleCount: state.recycleCount + 1,
          history: [...state.history, snapshot(state)].slice(-MAX_HISTORY),
          moveLog: [...state.moveLog, { type: 'recycle' }],
          activeHint: null,
        })
      },

      moveCards({ fromType, fromIndex, cardIndex, toType, toIndex }) {
        const state = get()
        const board: Board = {
          stock: state.stock, waste: state.waste,
          foundations: state.foundations, tableau: state.tableau,
        }
        const next = applyMove(board, { fromType, fromIndex, cardIndex, toType, toIndex })
        const won = checkWin(next.foundations)

        set({
          tableau:     next.tableau,
          foundations: next.foundations,
          waste:       next.waste,
          won,
          moveCount:   state.moveCount + 1,
          history:     [...state.history, snapshot(state)].slice(-MAX_HISTORY),
          moveLog:     [...state.moveLog, { type: 'move', fromType, fromIndex, cardIndex, toType, toIndex }],
          activeHint:  null,
        })
      },

      flipTableauTop(colIndex) {
        const state = get()
        const board: Board = {
          stock: state.stock, waste: state.waste,
          foundations: state.foundations, tableau: state.tableau,
        }
        const next = applyFlip(board, colIndex)
        if (next === board) return // top already face-up — nothing to log
        set({
          tableau: next.tableau,
          moveLog: [...state.moveLog, { type: 'flip', colIndex }],
        })
      },

      undo() {
        const { history, undosUsed, moveLog } = get()
        if (history.length === 0) return
        const prev = history[history.length - 1]
        set({
          ...prev,
          won:        false,
          undosUsed:  undosUsed + 1,
          history:    history.slice(0, -1),
          moveLog:    [...moveLog, { type: 'undo' }],
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
      version: 4,
      // Exclude transient state from localStorage (seed + moveLog ARE persisted)
      partialize: ({ history: _h, activeHint: _a, isDealing: _d, dealId: _id, drawId: _did, setDealing: _sd, ...persisted }) => persisted,
    }
  )
)
