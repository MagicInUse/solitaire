/**
 * @module engine/deadGame
 * Dead-game detection for Klondike Solitaire.
 *
 * This module is INTENTIONALLY separated from engine/hints.ts because the
 * criteria for "can the game make progress?" are different from the criteria
 * for "is this hint worth showing to the player?".
 *
 * Root bug in the old implementation: isDeadGame called filterUsefulHints
 * (a display function) to check whether a board had any useful moves.
 * filterUsefulHints aggressively suppresses tableau→tableau "shuffles" that
 * don't immediately reveal hidden cards — the right call for display, but
 * wrong for dead-game purposes where we need to know if ANY genuine progress
 * is theoretically possible, including staging moves to empty columns.
 *
 * Fix: isDirectProgress replaces filterUsefulHints in all dead-game checks.
 * It is more permissive: any waste→tableau move counts, and tableau→tableau
 * moves that reveal a hidden card OR empty the source column count.
 * Foundation back-moves are evaluated separately via isBackMoveProductive,
 * which in turn uses isDirectProgress for its own follow-up checks.
 */

import type { Hint, Pile } from '../types/cards'
import { canPlaceOnFoundation, canPlaceOnTableau } from './rules'
import { computeHints } from './hints'

type Tableau = [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
type Foundations = [Pile, Pile, Pile, Pile]

type BoardState = {
  waste: Pile
  foundations: Foundations
  tableau: Tableau
}

// ─── Core progress predicate ──────────────────────────────────────────────────

/**
 * Returns true when a hint represents direct, genuine progress on the board.
 *
 * Used exclusively by dead-game detection — NOT by the hint display system.
 * More permissive than filterUsefulHints: we care whether progress is
 * *theoretically possible*, not whether it avoids confusing hint cycles.
 *
 * Rules:
 *  - Any move to foundation           → always progress.
 *  - Any waste → tableau move         → always progress (draws down the waste).
 *  - Foundation → tableau back-moves  → not "direct" progress; handled
 *                                       separately by isBackMoveProductive.
 *  - Tableau → tableau                → progress only if it reveals a
 *                                       face-down card OR empties the source
 *                                       column (creates an open King slot).
 *                                       Applies regardless of whether the
 *                                       destination column is empty.
 */
export function isDirectProgress(h: Hint, tableau: Tableau): boolean {
  if (h.toType === 'foundation') return true
  if (h.fromType === 'waste')    return true
  if (h.fromType === 'foundation') return false  // handled by isBackMoveProductive

  // tableau → tableau
  const src          = tableau[h.fromIndex!]
  const revealsHidden = h.cardIndex > 0 && !src[h.cardIndex - 1].faceUp
  const emptiesSource = h.cardIndex === 0
  return revealsHidden || emptiesSource
}

// ─── Back-move productivity check ────────────────────────────────────────────

/**
 * Collects the set of direct-progress move keys on the given board.
 * Foundation back-moves are excluded (handled separately to avoid recursion).
 *
 * excludeFromIndex / excludeCardIndex name the single circular reversal to
 * skip (the just-placed back-move card going straight back to the foundation).
 * Pass -1 / -1 when building a baseline with no exclusion.
 */
function collectProgressKeys(
  waste: Pile,
  foundations: Foundations,
  tableau: Tableau,
  excludeFromIndex: number,
  excludeCardIndex: number,
): Set<string> {
  const keys = new Set<string>()
  const rawHints = computeHints({ waste, foundations, tableau })

  for (const h of rawHints) {
    if (h.fromType === 'foundation') continue
    if (
      h.fromType === 'tableau' &&
      h.fromIndex === excludeFromIndex &&
      h.cardIndex === excludeCardIndex
    ) continue

    if (isDirectProgress(h, tableau)) {
      keys.add(`${h.fromType}:${h.fromIndex ?? ''}:${h.cardIndex}:${h.toType}:${h.toIndex}`)
    }
  }
  return keys
}

/**
 * Returns true when placing the top card of foundations[h.fromIndex] onto
 * tableau[h.toIndex] unlocks at least one new direct-progress move.
 *
 * Uses isDirectProgress (not filterUsefulHints) for the follow-up check so
 * that back-move productivity is evaluated with the same permissive rules as
 * the rest of dead-game detection.
 */
function isBackMoveProductive(
  h: Hint,
  waste: Pile,
  foundations: Foundations,
  tableau: Tableau,
): boolean {
  const srcPile = foundations[h.fromIndex!]
  if (srcPile.length === 0) return false
  const card = srcPile[srcPile.length - 1]

  // Aces: nothing can land on top of them → always a circular trap.
  if (card.rank === 1) return false

  const simFoundations = foundations.map((p, i) =>
    i === h.fromIndex ? p.slice(0, -1) : p
  ) as Foundations
  const simTableau = tableau.map((p, i) =>
    i === h.toIndex ? [...p, { ...card, faceUp: true }] : p
  ) as Tableau

  const placedCardIndex = simTableau[h.toIndex].length - 1

  const originalKeys = collectProgressKeys(waste, foundations, tableau, -1, -1)
  const simKeys      = collectProgressKeys(
    waste,
    simFoundations,
    simTableau,
    h.toIndex,
    placedCardIndex,
  )

  for (const key of simKeys) {
    if (!originalKeys.has(key)) return true
  }
  return false
}

// ─── Main export ──────────────────────────────────────────────────────────────

type DeadGameParams = BoardState & {
  stock: Pile
  canRecycle: boolean
}

/**
 * Returns true when the game is genuinely unwinnable and no further progress
 * is possible regardless of how many recycles remain.
 *
 * Three-step check:
 *  1. Stock has cards → can always draw → not dead.
 *  2. Current board has any direct-progress hint or productive back-move → not dead.
 *  3. If recycling is possible and waste has cards, simulate each buried waste
 *     card being played:
 *     a. If it goes straight to a foundation → not dead.
 *     b. If it lands on any tableau column, check the resulting board for
 *        at least one direct-progress move → not dead.
 *     c. Second-order: two waste cards played in sequence.
 *
 * Key design: isDirectProgress (not filterUsefulHints) is used throughout so
 * that display-side filtering decisions cannot cause false dead-game positives.
 */
export function isDeadGame({
  stock,
  waste,
  foundations,
  tableau,
  canRecycle,
}: DeadGameParams): boolean {
  // 1. Draws still available
  if (stock.length > 0) return false

  // 2. Check current board
  const rawHints = computeHints({ waste, foundations, tableau })
  const hasProgress = rawHints.some(h =>
    h.fromType === 'foundation'
      ? isBackMoveProductive(h, waste, foundations, tableau)
      : isDirectProgress(h, tableau),
  )
  if (hasProgress) return false

  // 3. Buried waste cards + recycling
  if (waste.length > 0 && canRecycle) {
    // First-order: each buried waste card individually.
    //
    // Draw-order note: resetStock() reverses waste into stock, so waste[0]
    // is drawn FIRST after a recycle.  When card waste[i] is played, ALL
    // other waste cards remain accessible: cards below i are already in the
    // new waste pile, and cards above i will appear in subsequent draws.
    // simWaste must therefore include BOTH: [...waste[0..i-1], ...waste[i+1..n-1]].
    // Using only waste.slice(0, i) (the old logic) missed the "direction shift"
    // in draw-3 where the card above i (the original visible top) becomes
    // accessible again after a recycle and may now be playable on the modified
    // tableau — causing a false dead-game positive.
    const buried = waste.slice(0, waste.length > 1 ? -1 : undefined)

    const canUnblock = buried.some((card, i) => {
      // Foundation destination: always progress
      if (foundations.some(f => canPlaceOnFoundation(card, f))) return true

      // Tableau destination: simulate placement, check for a follow-up progress move.
      // Include ALL remaining cards (above and below i) in simWaste so the
      // follow-up check can see cards that become accessible through subsequent draws.
      const simWaste = [...waste.slice(0, i), ...waste.slice(i + 1)]
      for (let ti = 0; ti < 7; ti++) {
        if (!canPlaceOnTableau(card, tableau[ti])) continue
        const simTableau = tableau.map((p, k) =>
          k === ti ? [...p, { ...card, faceUp: true }] : p
        ) as Tableau
        const follow = computeHints({ waste: simWaste, foundations, tableau: simTableau })
        if (follow.some(h => h.fromType !== 'foundation' && isDirectProgress(h, simTableau))) {
          return true
        }
      }
      return false
    })
    if (canUnblock) return false

    // Second-order: two buried waste cards played in sequence.
    //
    // Placing cardA creates the only new tableau landing spot (on top of
    // itself).  We check if cardB can stack on cardA and whether the
    // resulting board has a follow-up direct-progress move.
    if (waste.length >= 2) {
      for (let i = 0; i < waste.length - 1; i++) {
        const cardA = waste[i]
        for (let ta = 0; ta < 7; ta++) {
          if (!canPlaceOnTableau(cardA, tableau[ta])) continue
          const simTableauA = tableau.map((p, k) =>
            k === ta ? [...p, { ...cardA, faceUp: true }] : p
          ) as Tableau

          for (let j = i + 1; j < waste.length; j++) {
            const cardB = waste[j]
            if (!canPlaceOnTableau(cardB, simTableauA[ta])) continue

            const simTableauAB = simTableauA.map((p, k) =>
              k === ta ? [...p, { ...cardB, faceUp: true }] : p
            ) as Tableau

            // Waste state when both A and B are played: cards before A,
            // between A and B, and after B — all remain accessible.
            const simWasteAB = [...waste.slice(0, i), ...waste.slice(i + 1, j), ...waste.slice(j + 1)]
            const follow = computeHints({ waste: simWasteAB, foundations, tableau: simTableauAB })
            if (follow.some(h => h.fromType !== 'foundation' && isDirectProgress(h, simTableauAB))) {
              return false
            }
          }
        }
      }
    }
  }

  return true
}
