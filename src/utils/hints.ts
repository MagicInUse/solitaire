/**
 * @module hints
 * Computes valid hint moves for the player by checking all playable cards
 * against all valid destination piles. Foundation moves are tested first
 * so the first hint returned is always the most optimal available move.
 */

import type { Card, Hint, Pile } from '../types/cards'

type HintableState = {
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
}

function isRed(card: Card) {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

function canGoToFoundation(card: Card, foundation: Pile): boolean {
  if (foundation.length === 0) return card.rank === 1
  const top = foundation[foundation.length - 1]
  return card.suit === top.suit && card.rank === top.rank + 1
}

function canGoToTableau(card: Card, pile: Pile): boolean {
  if (pile.length === 0) return card.rank === 13
  const top = pile[pile.length - 1]
  if (!top.faceUp) return false
  return isRed(card) !== isRed(top) && card.rank === top.rank - 1
}

/**
 * Returns all valid hint moves given the current board state.
 * Foundation moves come first. Tableau moves follow.
 * Returns an empty array when no moves are available.
 *
 * Sources checked:
 *  - Waste top card
 *  - Every face-up card in each tableau column (bottom of a movable stack)
 *  - Top card of each foundation pile (legal in standard Klondike to move back
 *    to the tableau to unblock sequences)
 */
export function computeHints({ waste, foundations, tableau }: HintableState): Hint[] {
  const hints: Hint[] = []

  function tryCard(
    card: Card,
    fromType: Hint['fromType'],
    fromIndex: number | undefined,
    cardIndex: number,
    isTopCard = true,
  ) {
    // Foundation destinations — never valid from a foundation source, and only
    // valid from a tableau source when the card is the TOP of its pile.  Moving
    // a sub-stack (multiple cards) to a foundation is illegal (foundations only
    // accept one card at a time), so suggesting it would highlight cards the
    // player physically cannot move there without first clearing what's above.
    if (fromType !== 'foundation' && isTopCard) {
      for (let fi = 0; fi < 4; fi++) {
        if (canGoToFoundation(card, foundations[fi])) {
          hints.push({ fromType, fromIndex, cardIndex, toType: 'foundation', toIndex: fi })
        }
      }
    }
    // Tableau destinations
    for (let ti = 0; ti < 7; ti++) {
      if (fromType === 'tableau' && fromIndex === ti) continue
      if (canGoToTableau(card, tableau[ti])) {
        hints.push({ fromType, fromIndex, cardIndex, toType: 'tableau', toIndex: ti })
      }
    }
  }

  // Waste top card
  if (waste.length > 0) {
    const top = waste[waste.length - 1]
    tryCard(top, 'waste', undefined, waste.length - 1)
  }

  // Each face-up stack in tableau (card at index i is the bottom of a movable stack).
  // Guard: only emit hints for substacks that form a valid alternating descending
  // sequence — broken runs (e.g. from corrupted persisted state) are not legal moves
  // and must not be counted as progress for dead-game detection.
  for (let col = 0; col < 7; col++) {
    const pile = tableau[col]
    for (let i = 0; i < pile.length; i++) {
      if (!pile[i].faceUp) continue
      if (!isValidRun(pile, i)) continue
      const isTopCard = i === pile.length - 1
      tryCard(pile[i], 'tableau', col, i, isTopCard)
    }
  }

  // Foundation top cards — can be moved back to tableau to unblock sequences.
  // This is a legal Klondike move and occasionally the only way to make progress.
  for (let fi = 0; fi < 4; fi++) {
    const pile = foundations[fi]
    if (pile.length === 0) continue
    const top = pile[pile.length - 1]
    tryCard(top, 'foundation', fi, pile.length - 1)
  }

  return hints
}

/**
 * Returns true when pile.slice(startIndex) is a valid alternating-colour
 * descending sequence (each card one rank lower than and opposite colour to
 * the card above it). A single card is trivially valid.
 */
function isValidRun(pile: Pile, startIndex: number): boolean {
  for (let j = startIndex; j < pile.length - 1; j++) {
    const cur  = pile[j]
    const next = pile[j + 1]
    if (!next.faceUp) return false
    if (next.rank !== cur.rank - 1) return false
    if (isRed(next) === isRed(cur)) return false
  }
  return true
}

/**
 * Filters out hints that make no productive progress.
 *
 * A tableau→tableau move is useful only when it either:
 *  - Reveals at least one face-down card (cards exist below the moving stack
 *    and at least one is still hidden), OR
 *  - Empties the source column entirely (cardIndex === 0), which creates a
 *    valuable open slot that a King can fill.
 *
 * Moves that satisfy neither condition are pure shuffles — they rearrange
 * already-accessible cards between non-empty piles with no strategic upside
 * and produce the "redundant hints" loop-trap.
 *
 * Non-tableau destinations (foundation, etc.) and non-tableau sources
 * (waste, foundation) are always kept.
 */
/**
 * Returns true when moving `card` (rank R) from a foundation onto a tableau
 * column would enable at least one OTHER tableau card to land on it in a
 * way that makes genuine progress (i.e. reveals a face-down card or empties
 * a column).
 *
 * A back-move is worthless — and will immediately be contradicted by the
 * next hint — unless it creates a new landing spot that triggers progress.
 * Classic circular trap: move A♠ foundation→tableau, then hint says move
 * A♠ tableau→foundation, repeat forever.
 */
function isProductiveBackMove(
  h: Hint,
  foundations: HintableState['foundations'],
  tableau: HintableState['tableau'],
): boolean {
  const srcPile = foundations[h.fromIndex!]
  if (srcPile.length === 0) return false
  const card = srcPile[srcPile.length - 1]

  // After card lands, things of rank (card.rank - 1) opposite colour can go on it.
  // If rank - 1 < 1 (i.e. Aces) nothing can ever go on top → always circular.
  const neededRank = card.rank - 1
  if (neededRank < 1) return false

  for (let col = 0; col < 7; col++) {
    if (col === h.toIndex) continue // skip destination column itself
    const pile = tableau[col]
    if (pile.length === 0) continue
    const top = pile[pile.length - 1]
    if (!top.faceUp) continue
    if (top.rank !== neededRank) continue
    if (isRed(top) === isRed(card)) continue // must be opposite colour

    // This top card could land on the moved card.  Is doing so productive?
    const hasHiddenBelow = pile.slice(0, pile.length - 1).some(c => !c.faceUp)
    const emptiesColumn = pile.length === 1
    if (hasHiddenBelow || emptiesColumn) return true
  }

  return false
}

export function filterUsefulHints(
  hints: Hint[],
  tableau: HintableState['tableau'],
  foundations: HintableState['foundations'],
): Hint[] {
  const filtered = hints.filter(h => {
    // Non-tableau destination (e.g. foundation) → always keep
    if (h.toType !== 'tableau') return true
    // Foundation→tableau back-moves: keep tentatively, pruned below if better moves exist
    if (h.fromType === 'foundation') return true
    // Source is waste → always keep
    if (h.fromType !== 'tableau') return true

    const srcPile = tableau[h.fromIndex!]
    const hasHiddenBelow = srcPile.slice(0, h.cardIndex).some(c => !c.faceUp)
    const toEmpty = tableau[h.toIndex].length === 0

    if (toEmpty) {
      // Moving to an empty column: only useful when it reveals a hidden card.
      // (All-face-up King stacks shuffling between empty slots = circular trap.)
      return hasHiddenBelow
    }

    // Moving to a non-empty column: useful when it reveals a hidden card OR
    // when it empties the source column (creates a new open slot for a King).
    return hasHiddenBelow || h.cardIndex === 0
  })

  // Foundation back-moves are a last resort.  When any waste/tableau hint is
  // available, suppress them to avoid visual confusion.
  // When back-moves ARE the only option, only keep the ones that are genuinely
  // productive (they enable a subsequent move that reveals a face-down card or
  // empties a column).  Circular back-moves — e.g. A→tableau where nothing
  // can land on an Ace — are silently dropped, letting dead-game detection
  // trigger correctly when truly no progress is possible.
  const nonBacktrack = filtered.filter(h => h.fromType !== 'foundation')
  if (nonBacktrack.length > 0) return nonBacktrack

  const productiveBackMoves = filtered
    .filter(h => h.fromType === 'foundation')
    .filter(h => isProductiveBackMove(h, foundations, tableau))
  return productiveBackMoves.slice(0, 1)
}

type DeadGameParams = HintableState & {
  stock: Pile
  canRecycle: boolean
}

/**
 * Returns true when the game is genuinely unwinnable and no further progress
 * is possible — regardless of remaining recycle count.
 *
 * Logic:
 *  1. Stock has cards → always false (more draws available).
 *  2. Current board has useful hints → false.
 *  3. Waste has cards AND recycling is still permitted:
 *     - Check every buried waste card (not the top — already covered by
 *       computeHints) against the current foundations and tableau.
 *     - If any buried card could legally reach any destination after a
 *       recycle, the game is not dead.
 *  4. Otherwise → dead game.
 *
 * Key insight: if no current moves exist (step 2 fails), the tableau and
 * foundations cannot change.  Recycling the same stuck cards against an
 * unchanged board always produces the same result, so the buried-card check
 * (step 3) is both necessary and sufficient — without it the banner never
 * appears when recycles remain.
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

  // 2. Current board state has at least one useful move
  const hints = filterUsefulHints(
    computeHints({ waste, foundations, tableau }),
    tableau,
    foundations,
  )
  if (hints.length > 0) return false

  // 3. Check buried waste cards against the (now confirmed unchangeable) board.
  //    waste.slice(0, -1) = everything except the top, which computeHints
  //    already evaluated above.
  //
  //    Foundation destinations: always real progress — no lookahead needed.
  //
  //    Tableau destinations: a raw canGoToTableau check is not enough.
  //    Placing a buried card on a tableau pile can be a "pure shuffle" that
  //    leads nowhere — identical to the trap filterUsefulHints already handles
  //    for tableau→tableau moves.  With unlimited recycling, any such dead-end
  //    placement would prevent the modal from ever triggering.
  //
  //    Fix: for tableau placements, simulate the move (append card to that
  //    column, remove card from waste) and check whether filterUsefulHints
  //    finds at least one subsequent useful move.  Only if it does is the game
  //    considered alive.
  if (waste.length > 0 && canRecycle) {
    const buried = waste.slice(0, waste.length > 1 ? -1 : undefined)
    const canUnblock = buried.some(card => {
      // Foundation — always progress
      if (foundations.some(f => canGoToFoundation(card, f))) return true

      // Tableau — simulate and verify a follow-up move exists
      for (let ti = 0; ti < 7; ti++) {
        if (!canGoToTableau(card, tableau[ti])) continue
        const simTableau = tableau.map((p, i) =>
          i === ti ? [...p, { ...card, faceUp: true }] : p
        ) as typeof tableau
        const simWaste = waste.filter(c => c.id !== card.id)
        const follow = filterUsefulHints(
          computeHints({ waste: simWaste, foundations, tableau: simTableau }),
          simTableau,
          foundations,
        )
        if (follow.length > 0) return true
      }

      return false
    })
    if (canUnblock) return false
  }

  return true
}
