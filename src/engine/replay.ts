/**
 * @module engine/replay
 * Deterministic replay of a Klondike game from its seed + action log.
 *
 * Pairs with engine/gameActions: dealing the seed reproduces the exact opening
 * board, then folding the recorded {@link LoggedAction}s reconstructs the live
 * board move-for-move.  Because replay and the live store share the SAME pure
 * transitions (engine/gameActions), a faithfully recorded log is guaranteed to
 * reproduce the live board — the determinism guarantee the harness relies on.
 *
 * This is the reproducibility primitive for *human* games (the move log).
 * AI games reproduce from the seed alone since the AI is deterministic.
 */

import { dealKlondike } from './deck'
import {
  applyDraw, applyRecycle, applyMove, applyFlip,
  type Board, type LoggedAction,
} from './gameActions'

/** Strips metadata off a deal result, returning just the board piles. */
function boardFromDeal(seed: string): Board {
  const { stock, waste, foundations, tableau } = dealKlondike({ seed })
  return { stock, waste, foundations, tableau }
}

/**
 * Reconstructs the final board produced by dealing `seed` and applying
 * `actions` in order.
 *
 * Undo is modelled exactly as the live store does it: draw / recycle / move
 * push a pre-action snapshot, `flip` does not (it is folded into the move it
 * follows), and `undo` pops the most recent snapshot.  This mirrors the store,
 * where `flipTableauTop` runs in a separate `set()` without recording history.
 *
 * @param seed - The deal seed.
 * @param actions - The recorded move log.
 * @returns The reconstructed board after the final action.
 */
export function replay(seed: string, actions: LoggedAction[]): Board {
  let board = boardFromDeal(seed)
  const history: Board[] = []

  for (const action of actions) {
    switch (action.type) {
      case 'draw':
        history.push(board)
        board = applyDraw(board, action.drawMode)
        break
      case 'recycle':
        history.push(board)
        board = applyRecycle(board)
        break
      case 'move':
        history.push(board)
        board = applyMove(board, action)
        break
      case 'flip':
        // Reveal is part of the preceding move, not its own history point.
        board = applyFlip(board, action.colIndex)
        break
      case 'undo':
        board = history.pop() ?? board
        break
    }
  }

  return board
}
