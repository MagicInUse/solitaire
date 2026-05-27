/**
 * @module layout
 * Utility functions for computing dynamic card layout within tableau columns.
 */

import type { Pile } from '../types/cards'
import {
  CARD_H,
  FACEDOWN_OFFSET,
  FACEUP_OFFSET,
  MIN_FACEDOWN_OFFSET,
  MIN_FACEUP_OFFSET,
  TABLEAU_AVAILABLE_H,
} from '../constants/canvas'

/**
 * Compute the per-column face-up and face-down card offsets.
 *
 * The industry-standard approach (Microsoft Solitaire, Google Solitaire,
 * MobilityWare, etc.): compress the visible peek between cards so the column
 * always fits within `tableauAvailableH`, while keeping a minimum offset so
 * rank/suit corners remain readable.
 *
 * Strategy (two-pass):
 * - **Pass 1** — compress face-up offset only; face-down stays at its default.
 * - **Pass 2** — if face-up is already at minimum and still overflowing,
 *   also compress the face-down offset.
 *
 * @param pile - The ordered array of cards in a single tableau column.
 * @param tableauAvailableH - Available vertical space for the tableau area.
 *   Defaults to `TABLEAU_AVAILABLE_H` (landscape). Pass the portrait value
 *   when rendering in portrait orientation.
 * @returns `fuOffset` — pixel gap between face-up cards;
 *          `fdOffset` — pixel gap between face-down cards.
 */
export function computeColumnOffsets(
  pile: Pile,
  tableauAvailableH: number = TABLEAU_AVAILABLE_H,
): { fuOffset: number; fdOffset: number } {
  if (pile.length <= 1) return { fuOffset: FACEUP_OFFSET, fdOffset: FACEDOWN_OFFSET }

  // Only the cards at indices [0, n-2] contribute an offset; the last card
  // shows at full CARD_H with no peek beneath it — matching TableauColumn math.
  const contributing = pile.slice(0, -1)
  const fdContrib = contributing.filter(c => !c.faceUp).length
  const fuContrib = contributing.filter(c => c.faceUp).length

  const naturalH = fdContrib * FACEDOWN_OFFSET + fuContrib * FACEUP_OFFSET + CARD_H
  if (naturalH <= tableauAvailableH) {
    return { fuOffset: FACEUP_OFFSET, fdOffset: FACEDOWN_OFFSET }
  }

  // Pass 1: solve for fuOffset that makes it fit, keep fdOffset at full
  let fuOffset = FACEUP_OFFSET
  let fdOffset = FACEDOWN_OFFSET
  if (fuContrib > 0) {
    const remaining = tableauAvailableH - fdContrib * FACEDOWN_OFFSET - CARD_H
    fuOffset = Math.max(MIN_FACEUP_OFFSET, Math.min(FACEUP_OFFSET, remaining / fuContrib))
  }

  // Pass 2: fuOffset was clamped to minimum and column still overflows →
  // solve for fdOffset too
  const h1 = fdContrib * fdOffset + fuContrib * fuOffset + CARD_H
  if (h1 > tableauAvailableH && fdContrib > 0) {
    const remaining = tableauAvailableH - fuContrib * fuOffset - CARD_H
    fdOffset = Math.max(MIN_FACEDOWN_OFFSET, Math.min(FACEDOWN_OFFSET, remaining / fdContrib))
  }

  return { fuOffset, fdOffset }
}
