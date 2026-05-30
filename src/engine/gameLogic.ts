/**
 * @module engine/gameLogic
 * High-level game-state predicates.  No React, no Zustand.
 */

import type { Pile } from '../types/cards'

/** Returns true when all four foundations hold exactly 13 cards (52 total). */
export function checkWin(foundations: [Pile, Pile, Pile, Pile]): boolean {
  return foundations.every(p => p.length === 13)
}
