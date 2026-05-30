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
  recyclesRemaining: number
  drawMode?: 1 | 3
}

/**
 * Returns true when the game is genuinely unwinnable.
 *
 * Uses a bounded BFS over reachable board states, correctly modelling draw-3
 * accessibility (only the top of each draw group is playable per pass).
 *
 * The search expands:
 *  - Draw: pop drawMode cards from stock onto waste (if stock non-empty)
 *  - Recycle: flip waste back into stock (if recyclesRemaining > 0 and stock empty)
 *  - Play top waste card to any valid tableau column or foundation
 *  - Any tableau→tableau or tableau→foundation move that is direct progress
 *
 * "Direct progress" (isDirectProgress) means the game state is advancing:
 * card to foundation, waste card played, hidden card revealed, or column emptied.
 * If any reachable state has a direct-progress move, the game is NOT dead.
 *
 * Depth is capped to avoid excessive computation. The cap is generous enough
 * to see through multi-card draw-3 cycles but bounded for performance.
 */
export function isDeadGame({
  stock,
  waste,
  foundations,
  tableau,
  recyclesRemaining,
  drawMode = 3,
}: DeadGameParams): boolean {
  // ── Fast path: draws still available ──────────────────────────────────────
  if (stock.length > 0) return false

  // ── Step 2: immediate board check ─────────────────────────────────────────
  // Uses isDirectProgress (which counts waste→tableau as immediate progress)
  // so the player always has agency when any current move is available.
  const initialHints = computeHints({ waste, foundations, tableau })
  const hasImmediateProgress = initialHints.some(h =>
    h.fromType === 'foundation'
      ? isBackMoveProductive(h, waste, foundations, tableau)
      : isDirectProgress(h, tableau),
  )
  if (hasImmediateProgress) return false

  // If no recycle and no stock, no moves can ever surface → dead.
  if (recyclesRemaining <= 0) return true

  // ── Step 3: BFS over states reachable by draws, one recycle, and moves ────
  //
  // The BFS explores what becomes accessible after drawing and recycling.
  // "Truly not dead" (→ return false) requires reaching a state that has:
  //   • Any move to foundation (waste→foundation or tableau→foundation)
  //   • Any tableau→tableau move that reveals a hidden card
  //   • Any tableau→tableau move that empties the source column
  //
  // waste→tableau alone is NOT treated as "not dead" here — it is added to
  // the queue so we can continue searching from the resulting state. This
  // prevents false "not dead" on dead-end shuffles (e.g. a buried card can
  // land on the tableau but afterward nothing useful can happen).
  //
  // Step 2 already handled the case where an immediate waste→tableau move is
  // available (game not dead), so we only reach the BFS when no current move
  // exists on the board at all.

  type BFSNode = {
    stock: Pile
    waste: Pile
    tableau: Tableau
    recyclesLeft: number
    depth: number
  }

  const MAX_DEPTH  = 80
  const MAX_STATES = 4000

  const toKey = (s: Pile, w: Pile, t: Tableau): string =>
    s.map(c => `${c.suit[0]}${c.rank}`).join(',') + '/' +
    w.map(c => `${c.suit[0]}${c.rank}`).join(',') + '/' +
    t.map(col => col.map(c => `${c.suit[0]}${c.rank}${c.faceUp ? 'u' : 'd'}`).join(',')).join('|')

  const visited = new Set<string>()
  const queue: BFSNode[] = []

  const enqueue = (node: BFSNode) => {
    if (node.depth > MAX_DEPTH) return
    const key = toKey(node.stock, node.waste, node.tableau)
    if (visited.has(key)) return
    visited.add(key)
    queue.push(node)
  }

  enqueue({ stock, waste, tableau, recyclesLeft: Math.min(recyclesRemaining, 2), depth: 0 })

  let explored = 0
  while (queue.length > 0 && explored < MAX_STATES) {
    const node = queue.shift()!
    explored++

    // ── Draw ────────────────────────────────────────────────────────────────
    if (node.stock.length > 0) {
      const count    = Math.min(drawMode, node.stock.length)
      const newStock = node.stock.slice(0, node.stock.length - count)
      const drawn    = node.stock.slice(node.stock.length - count).map(c => ({ ...c, faceUp: true }))
      enqueue({ ...node, stock: newStock, waste: [...node.waste, ...drawn], depth: node.depth + 1 })
      // Don't skip other actions — waste top from *before* the draw may also be playable.
    }

    // ── Recycle (stock exhausted) ────────────────────────────────────────────
    if (node.stock.length === 0 && node.recyclesLeft > 0 && node.waste.length > 0) {
      const newStock = [...node.waste].reverse().map(c => ({ ...c, faceUp: false }))
      enqueue({ stock: newStock, waste: [], tableau: node.tableau, recyclesLeft: node.recyclesLeft - 1, depth: node.depth + 1 })
    }

    // ── Play top waste card ──────────────────────────────────────────────────
    if (node.waste.length > 0) {
      const top      = node.waste[node.waste.length - 1]
      const newWaste = node.waste.slice(0, -1)

      // To foundation = TRUE progress → not dead
      if (foundations.some(f => canPlaceOnFoundation(top, f))) return false

      // To tableau = add to queue (not immediate "not dead" — may be dead-end shuffle)
      for (let ti = 0; ti < 7; ti++) {
        if (!canPlaceOnTableau(top, node.tableau[ti])) continue
        const newTab = node.tableau.map((p, k) =>
          k === ti ? [...p, { ...top, faceUp: true }] : p
        ) as Tableau
        enqueue({ ...node, waste: newWaste, tableau: newTab, depth: node.depth + 1 })
      }
    }

    // ── Tableau moves ────────────────────────────────────────────────────────
    const tabHints = computeHints({ waste: node.waste, foundations, tableau: node.tableau })
    for (const h of tabHints) {
      if (h.fromType !== 'tableau') continue

      // Tableau → foundation = TRUE progress → not dead
      if (h.toType === 'foundation') return false

      if (h.toType !== 'tableau') continue

      const src         = node.tableau[h.fromIndex!]
      const revealsHidden = h.cardIndex > 0 && !src[h.cardIndex - 1].faceUp
      const emptiesSource = h.cardIndex === 0

      // Reveals hidden card or empties column = TRUE progress → not dead
      if (revealsHidden || emptiesSource) return false

      // Pure shuffle: add to queue — it might change accessibility for future draws
      const moving = src.slice(h.cardIndex)
      const newSrc = src.slice(0, h.cardIndex)
      const newDst = [...node.tableau[h.toIndex], ...moving]
      const newTab = node.tableau.map((p, k) => {
        if (k === h.fromIndex) return newSrc
        if (k === h.toIndex)   return newDst
        return p
      }) as Tableau
      enqueue({ ...node, tableau: newTab, depth: node.depth + 1 })
    }
  }

  return true
}
