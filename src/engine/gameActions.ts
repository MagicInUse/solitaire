/**
 * @module engine/gameActions
 * Pure, React-free board transitions for Klondike Solitaire.
 *
 * Single source of truth for *how a board changes* in response to a semantic
 * action (draw, recycle, move, flip).  Both the live Zustand store
 * (useGameStore) and the deterministic replay engine (engine/replay) call
 * these functions, so the two can never drift apart — a board reconstructed
 * from a seed + action log is guaranteed to match live play.
 *
 * Each function takes a {@link Board} and returns a NEW board; inputs are
 * never mutated.  Metadata bookkeeping (move count, undo history, animation
 * ids) is intentionally NOT handled here — that belongs to the store.
 */

import type { GameState, Pile } from '../types/cards'

/** The mutable board piles. Alias of {@link GameState}. */
export type Board = GameState

/**
 * A single semantic action recorded in the game's move log.
 *
 * The log is replayable: dealing a seed and folding these actions in order
 * reproduces the exact final board (see engine/replay).  Actions are the
 * unit of reproducibility for *human* games — AI games reproduce from the
 * seed alone since the AI is deterministic given a board.
 */
export type LoggedAction =
  | { type: 'draw'; drawMode: 1 | 3 }
  | { type: 'recycle' }
  | {
      type: 'move'
      fromType: 'waste' | 'tableau' | 'foundation'
      fromIndex?: number
      cardIndex: number
      toType: 'tableau' | 'foundation'
      toIndex: number
    }
  | { type: 'flip'; colIndex: number }
  | { type: 'undo' }

/** Parameters describing a card/stack move. */
export type MoveParams = {
  fromType: 'waste' | 'tableau' | 'foundation'
  fromIndex?: number
  cardIndex: number
  toType: 'tableau' | 'foundation'
  toIndex: number
}

/**
 * Draws `drawMode` cards (clamped to stock size) from the top of the stock
 * onto the waste, flipping them face-up.  Returns the board unchanged when
 * the stock is empty.
 */
export function applyDraw(board: Board, drawMode: 1 | 3): Board {
  if (board.stock.length === 0) return board
  const count = Math.min(drawMode, board.stock.length)
  const newStock = board.stock.slice(0, board.stock.length - count)
  const drawn = board.stock
    .slice(board.stock.length - count)
    .map((c) => ({ ...c, faceUp: true }))
  return { ...board, stock: newStock, waste: [...board.waste, ...drawn] }
}

/**
 * Recycles the waste pile back into the stock: reversed and turned face-down.
 * The waste becomes empty.
 */
export function applyRecycle(board: Board): Board {
  return {
    ...board,
    stock: [...board.waste].reverse().map((c) => ({ ...c, faceUp: false })),
    waste: [],
  }
}

/**
 * Moves a card (or face-up stack) from one pile to another.
 *
 * Does NOT validate legality — callers are expected to have checked via
 * engine/rules.  Performs the pile slicing/appending immutably and returns
 * the new board.  Does not auto-flip the exposed source card; that is a
 * separate {@link applyFlip} action so the move log stays faithful to the
 * store, where reveal is a distinct step.
 */
export function applyMove(board: Board, params: MoveParams): Board {
  const { fromType, fromIndex, cardIndex, toType, toIndex } = params

  const sourcePile: Pile =
    fromType === 'waste'
      ? board.waste
      : fromType === 'tableau'
        ? board.tableau[fromIndex!]
        : board.foundations[fromIndex!]

  const movingCards = sourcePile.slice(cardIndex)
  const newSource = sourcePile.slice(0, cardIndex)

  const destPile = toType === 'tableau' ? board.tableau[toIndex] : board.foundations[toIndex]
  const newDest = [...destPile, ...movingCards]

  const nextTableau = [...board.tableau] as Board['tableau']
  const nextFoundations = [...board.foundations] as Board['foundations']
  const nextWaste = fromType === 'waste' ? newSource : board.waste

  if (fromType === 'tableau') nextTableau[fromIndex!] = newSource
  if (fromType === 'foundation') nextFoundations[fromIndex!] = newSource

  if (toType === 'tableau') nextTableau[toIndex] = newDest
  else nextFoundations[toIndex] = newDest

  return { ...board, tableau: nextTableau, foundations: nextFoundations, waste: nextWaste }
}

/**
 * Reveals (flips face-up) the top card of a tableau column when it is
 * currently face-down.  Idempotent: returns the board unchanged when the top
 * card is already face-up or the column is empty.
 */
export function applyFlip(board: Board, colIndex: number): Board {
  const col = board.tableau[colIndex]
  if (col.length === 0 || col[col.length - 1].faceUp) return board
  const nextCol = [...col]
  nextCol[nextCol.length - 1] = { ...nextCol[nextCol.length - 1], faceUp: true }
  const nextTableau = [...board.tableau] as Board['tableau']
  nextTableau[colIndex] = nextCol
  return { ...board, tableau: nextTableau }
}
