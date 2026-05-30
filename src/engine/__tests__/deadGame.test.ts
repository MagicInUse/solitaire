/**
 * Tests for engine/deadGame.ts — specifically the isDirectProgress function
 * and the isDeadGame bug fixes.
 *
 * Key scenarios validated:
 *  - isDirectProgress is more permissive than filterUsefulHints for empty columns
 *  - isDeadGame false positive fix: tableau reshuffles no longer trigger dead game
 *  - isDeadGame false negative fix: game IS dead when only circular moves exist
 *  - Buried waste card logic works correctly
 *  - Second-order waste check works correctly
 *  - Stock cards always mean not-dead
 */

import { describe, it, expect } from 'vitest'
import type { Card, Hint, Pile } from '../../types/cards'
import { isDirectProgress, isDeadGame } from '../deadGame'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function card(suit: Card['suit'], rank: Card['rank'], faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp }
}

function emptyTableau(): [Pile, Pile, Pile, Pile, Pile, Pile, Pile] {
  return [[], [], [], [], [], [], []]
}

function emptyFoundations(): [Pile, Pile, Pile, Pile] {
  return [[], [], [], []]
}

function hint(
  fromType: Hint['fromType'],
  fromIndex: number | undefined,
  cardIndex: number,
  toType: Hint['toType'],
  toIndex: number,
): Hint {
  return { fromType, fromIndex, cardIndex, toType, toIndex }
}

// ─── isDirectProgress ─────────────────────────────────────────────────────────

describe('isDirectProgress', () => {
  const tableau = emptyTableau()

  it('always true for foundation destination', () => {
    expect(isDirectProgress(hint('tableau', 0, 3, 'foundation', 0), tableau)).toBe(true)
    expect(isDirectProgress(hint('waste', undefined, 0, 'foundation', 1), tableau)).toBe(true)
  })

  it('always true for waste source', () => {
    expect(isDirectProgress(hint('waste', undefined, 0, 'tableau', 3), tableau)).toBe(true)
  })

  it('always false for foundation source (back-moves handled separately)', () => {
    expect(isDirectProgress(hint('foundation', 0, 5, 'tableau', 2), tableau)).toBe(false)
  })

  describe('tableau → tableau', () => {
    it('true when reveals a hidden card', () => {
      const t = emptyTableau()
      // column 2: [hidden, face-up 7♠, face-up 6♥]  — cardIndex 1 reveals hidden
      t[2] = [card('hearts', 9, false), card('spades', 7), card('hearts', 6)]
      const h = hint('tableau', 2, 1, 'tableau', 5)
      expect(isDirectProgress(h, t)).toBe(true)
    })

    it('true when empties the source column into a non-empty destination (cardIndex === 0)', () => {
      const t = emptyTableau()
      // column 0: [7♠] alone, moving to column 1 which has [8♥] — empties source into non-empty dest
      t[0] = [card('spades', 7)]
      t[1] = [card('hearts', 8)]
      const h = hint('tableau', 0, 0, 'tableau', 1)
      expect(isDirectProgress(h, t)).toBe(true)
    })

    it('false when empties source into empty destination (K-shuffle, no net gain)', () => {
      // Moving a K-run from one column to an empty column is a pure shuffle:
      // the source empties but the dest fills — zero net new empty columns.
      // filterUsefulHints excludes this, and isDirectProgress now agrees.
      // The BFS will still enqueue this state and explore it, just not short-circuit.
      const t = emptyTableau()
      t[0] = [card('spades', 13), card('hearts', 12)]
      // t[1] is empty — moving whole K-run (cardIndex 0) to empty dest
      const h = hint('tableau', 0, 0, 'tableau', 1)
      expect(isDirectProgress(h, t)).toBe(false)
    })

    it('false for pure shuffle (no reveal, no empty source)', () => {
      const t = emptyTableau()
      // col 0: [5♠, 4♥] both face-up; col 1: [8♣]
      t[0] = [card('spades', 5), card('hearts', 4)]
      t[1] = [card('clubs', 8), card('diamonds', 7), card('clubs', 6)]
      // moving 4♥ (cardIndex 1) from col 0 to col 1 top (6♣→5♥): not valid by rank
      // but let's construct a valid shuffle: col 0 has [9♣], col 1 has [K♠, Q♥, J♠, 10♥]
      t[0] = [card('clubs', 9)]
      t[1] = [card('spades', 13), card('hearts', 12), card('clubs', 11), card('diamonds', 10)]
      // moving 9♣ (cardIndex 0, but that EMPTIES source) to col 1 → actually empties source
      // Let's use cardIndex === 0 for true pure shuffle (no empty, no reveal):
      // Two face-up cards in source, moving the BOTTOM one (not the top, not all)
      t[0] = [card('clubs', 7), card('hearts', 6)]
      // cardIndex 1 moves only 6♥ (top card), source still has 7♣: not reveal, not empty
      const h = hint('tableau', 0, 1, 'tableau', 2)
      expect(isDirectProgress(h, t)).toBe(false)
    })

    it('false when card below is face-up (no hidden reveal)', () => {
      const t = emptyTableau()
      t[0] = [card('clubs', 7, true), card('hearts', 6, true)]
      // cardIndex 1 moves 6♥; card below (index 0) is face-up — no reveal
      const h = hint('tableau', 0, 1, 'tableau', 3)
      expect(isDirectProgress(h, t)).toBe(false)
    })
  })
})

// ─── isDeadGame ───────────────────────────────────────────────────────────────

describe('isDeadGame', () => {
  it('returns false when stock has cards (can still draw)', () => {
    expect(isDeadGame({
      stock: [card('clubs', 5)],
      waste: [],
      foundations: emptyFoundations(),
      tableau: emptyTableau(),
      recyclesRemaining: 0,
    })).toBe(false)
  })

  it('returns true when no cards anywhere and no moves', () => {
    // Edge case: empty board (all on foundations essentially)
    const foundations: [Pile, Pile, Pile, Pile] = [
      Array.from({ length: 13 }, (_, i) => card('hearts',   (i + 1) as Card['rank'])),
      Array.from({ length: 13 }, (_, i) => card('diamonds', (i + 1) as Card['rank'])),
      Array.from({ length: 13 }, (_, i) => card('clubs',    (i + 1) as Card['rank'])),
      Array.from({ length: 13 }, (_, i) => card('spades',   (i + 1) as Card['rank'])),
    ]
    expect(isDeadGame({
      stock: [],
      waste: [],
      foundations,
      tableau: emptyTableau(),
      recyclesRemaining: 0,
    })).toBe(true)  // technically game is won, but dead-game detection also returns true here
  })

  it('returns false when tableau→tableau move reveals hidden card', () => {
    const tableau = emptyTableau()
    // col 0: [hidden, 7♠, 6♥] — moving 7♠+6♥ (cardIndex 1) reveals the hidden card
    tableau[0] = [card('hearts', 9, false), card('spades', 7), card('hearts', 6)]
    // col 3: [8♥] — 7♠ (black) can land on 8♥ (red), alternating colour
    tableau[3] = [card('hearts', 8)]

    expect(isDeadGame({
      stock: [],
      waste: [],
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: 0,
    })).toBe(false)
  })

  it('returns true when only pure tableau shuffles exist (the old false-negative bug)', () => {
    // All cards face-up, no hidden cards, no waste, no stock.
    // The only available moves are reshuffles that don't reveal anything.
    // Under the old code, filterUsefulHints would pass these through as "useful"
    // because they "empty the source column". Under isDirectProgress they don't
    // count as progress unless they empty the source... actually they do if cardIndex===0.
    //
    // Let's create a scenario where NO move qualifies:
    // - No foundation moves (cards can't go to foundation)
    // - No waste moves (waste empty)
    // - All tableau moves are pure shuffles (nothing reveals hidden, nothing empties source
    //   AND there's no move where the whole column moves away)
    //
    // Specifically: single-card columns facing up, none can be built (all same colour or wrong rank)
    const tableau = emptyTableau()
    // All hearts (red): 2♥, 4♥, 6♥, 8♥ — can't place red on red
    // No foundation moves (need Aces first)
    tableau[0] = [card('hearts', 2)]
    tableau[1] = [card('hearts', 4)]
    tableau[2] = [card('hearts', 6)]
    tableau[3] = [card('hearts', 8)]
    // These can't go anywhere (red on red is invalid, no empty columns for non-kings)

    expect(isDeadGame({
      stock: [],
      waste: [],
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: 0,
    })).toBe(true)
  })

  it('returns false when a tableau move empties a column (direct progress)', () => {
    // col 0: single face-up card that can move to col 1
    // This empties col 0 (cardIndex === 0), which is direct progress
    const tableau = emptyTableau()
    tableau[0] = [card('spades', 7)]
    tableau[1] = [card('hearts', 8)]

    expect(isDeadGame({
      stock: [],
      waste: [],
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: 0,
    })).toBe(false)
  })

  it('returns false when waste card can go straight to foundation', () => {
    const foundations: [Pile, Pile, Pile, Pile] = [[], [], [], []]
    // hearts foundation is empty, we have A♥ in waste
    const waste: Pile = [card('hearts', 1)]

    expect(isDeadGame({
      stock: [],
      waste,
      foundations,
      tableau: emptyTableau(),
      recyclesRemaining: Infinity,
    })).toBe(false)
  })

  it('returns false when buried waste card can unlock tableau progress', () => {
    // waste: [6♥, 7♠(top)] — top (7♠) has nowhere to go; buried 6♥ can land on tableau
    // After recycling, 6♥ comes out first
    // tableau col 0: [8♣] — 7♠ could go there, but 6♥ can go on 7♠ (which would be placed by the first-order check of 7♠)
    // Actually, let's make it simpler:
    // buried 7♠ can land on 8♥ in tableau, then there's a follow-up: 6♥ from waste[last]
    //
    // waste = [buried_7spades, top_something_useless]
    // After recycle: 7♠ is drawn first; tableau has 8♥; placing 7♠ on 8♥ lets 6♣ (in tableau) land there
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 8)]  // 8♥ — 7♠ can land here
    tableau[1] = [card('hearts', 6)]  // 6♥ — after 7♠ lands, 6♣ or 6♦ could land on 7♠

    // Buried: 7♠ (index 0), Top: 9♦ (index 1, current top — can't go anywhere)
    const waste: Pile = [card('spades', 7), card('diamonds', 9)]

    // After recycle: 7♠ → tableau[0] (on 8♥); follow-up: any direct progress move on new board?
    // New board: tableau[0] = [8♥, 7♠]; need something to go on 7♠ or any other progress
    // tableau[1] = [6♥] — 6♥ can't go on 7♠ (same colour red on black is fine, but 6♥ is red, 7♠ is black: yes!)
    // Actually 6♥ (red) on 7♠ (black) with 6 = 7-1: valid!
    // But 6♥ is in tableau col 1, and moving it to 7♠ in col 0 is a tableau move.
    // Does it reveal hidden? col1 only has [6♥], moving it empties col 1 → cardIndex===0 → isDirectProgress=true

    expect(isDeadGame({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: Infinity,
    })).toBe(false)
  })

  it('returns true when buried waste card leads only to a dead-end shuffle', () => {
    // waste = [buried_K♠, top_useless]
    // tableau has two empty columns — K♠ can land on either empty column
    // After placing K♠ on empty col, no subsequent progress (all other cards can't go anywhere)
    // Under the old code, placing K♠ would produce a waste→tableau "useful" follow-up check
    // Under the new code, we check isDirectProgress on the resulting board directly
    const tableau = emptyTableau()
    // Make sure K♠ is in buried waste
    // After placing K♠, the only moves available are other Ks trying to go to empty columns
    // Let's have a Q♥ in another column that can't go anywhere useful
    tableau[0] = [card('hearts', 12)]  // Q♥ — nothing to land on (no K♠ on tableau yet)
    // waste = [K♠ (buried), 2♦ (top useless)]
    // After recycle: K♠ → empty col (col 1, 2, 3... all empty)
    // New board: tableau[0]=[Q♥], tableau[1]=[K♠] — can Q♥ land on K♠? Yes! Q♥(red) on K♠(black), rank 12=13-1 ✓
    // So this is NOT a dead-end — Q♥ can land on K♠ after we place it
    // That means this test would return false (not dead) which makes sense.
    // Let me create an actual dead-end scenario:

    // All Ks already placed, Q♥ is the only card left but nothing to go on
    // (Actually if K is on tableau and Q♥ exists, Q can go on K)
    // Hard to make a "truly stuck" scenario with buried waste in a small example.
    // Use: buried card can land on tableau but follow-up boards have NO progress moves

    // waste = [9♠ (buried), 3♦ (top, useless)]
    // tableau: [10♦(red), 8♣(black)] — 9♠ can land on 10♦, but after that:
    //   simTableau: col0=[10♦, 9♠], col1=[8♣]
    //   8♣ can go on 9♠? 8♣(black) on 9♠(black) → SAME COLOR → no
    //   simWaste (cards before 9♠) = [] → empty
    //   computeHints on new board: 8♣ can't go on 9♠ (same color), nowhere else
    //   → no direct progress → buried card scenario dead-ends

    const tableau2 = emptyTableau()
    tableau2[0] = [card('diamonds', 10)]  // 10♦ — 9♠ can land here
    tableau2[1] = [card('clubs', 8)]      // 8♣ — can't go on 9♠ (same colour black)

    const waste2: Pile = [card('spades', 9), card('hearts', 3)]
    // top card (3♥) can't go anywhere (foundations empty, tableau top ranks are 10 and 8)

    expect(isDeadGame({
      stock: [],
      waste: waste2,
      foundations: emptyFoundations(),
      tableau: tableau2,
      recyclesRemaining: Infinity,
    })).toBe(true)
  })

  it('returns false on direction-shift: buried card enables the original top card to play (draw-3 regression)', () => {
    // Regression test for the "direction shift" false-positive.
    //
    // Scenario: waste = [2♦, K♣, 7♠(buried=i=2), 5♦(top=i=3, can't play)]
    //   draw-3 first pass: only 5♦ was accessible (top of last draw group), not playable.
    //   After recycle + draw-3: first draw group = [2♦, K♣, 7♠], 7♠ on top → accessible!
    //   7♠ on 8♥ (col 0): valid.
    //   After placing 7♠, simWaste should include 5♦ (above 7♠ in original waste).
    //   5♦ on 6♣ (col 1)? 5♦(red) on 6♣(black), 5=6-1 → YES → direct progress.
    //
    // Old bug: simWaste = waste.slice(0, 2) = [2♦, K♣]; top = K♣.
    //   K♣ can't go on modified tableau (no empty col, tableau tops are 8♥/7♠ and 6♣).
    //   No follow-up found → false dead-game declared.
    //
    // Fix: simWaste = [...waste.slice(0,2), ...waste.slice(3)] = [2♦, K♣, 5♦]; top = 5♦.
    //   5♦ on 6♣ → direct progress found → correctly NOT dead.
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 8)]    // 8♥ — 7♠ can land here
    tableau[1] = [card('clubs', 6)]     // 6♣ — 5♦ can land here after 7♠ is placed

    const waste: Pile = [
      card('diamonds', 2),  // i=0, buried
      card('clubs', 13),    // i=1, buried (K♣ — can't go on non-empty tableau)
      card('spades', 7),    // i=2, buried — this is the card drawn first after recycle in draw-3
      card('diamonds', 5),  // i=3, original top — couldn't play, but CAN after 7♠ is placed
    ]

    expect(isDeadGame({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: Infinity,
    })).toBe(false)
  })

  it('returns false when second-order waste card sequence unblocks the game', () => {
    // cardA (buried earlier) places on tableau, enabling cardB to stack on top
    // which then has a follow-up progress move

    // waste = [7♠(i=0), 6♥(i=1), useless(top)]
    // tableau[0] = [8♥] — 7♠ lands here
    // After placing 7♠ on [8♥]: tableau[0]=[8♥,7♠]
    // 6♥ can land on 7♠? 6♥(red) on 7♠(black), 6=7-1 ✓
    // After placing 6♥ on 7♠: tableau[0]=[8♥,7♠,6♥]
    // Follow-up: tableau[1]=[5♣] can go on 6♥? 5♣(black) on 6♥(red), 5=6-1 ✓
    // That empties col 1 → cardIndex===0 → isDirectProgress=true

    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 8)]
    tableau[1] = [card('clubs', 5)]

    const waste: Pile = [
      card('spades', 7),   // i=0 buried
      card('hearts', 6),   // i=1 buried
      card('diamonds', 2), // top — useless
    ]

    expect(isDeadGame({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: Infinity,
    })).toBe(false)
  })

  it('returns false when recyclesRemaining is 0 but top waste card has a direct move', () => {
    // No recycling needed — top of waste goes straight to tableau
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 8)]  // 7♠ can land here

    const waste: Pile = [card('spades', 7)]  // single card, is top and only

    expect(isDeadGame({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: 0,
    })).toBe(false)
  })

  it('returns true with recyclesRemaining 0 and no moves at all', () => {
    // No stock, no useful moves on board, waste top can't go anywhere, no recycling
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 2)]
    tableau[1] = [card('hearts', 4)]

    const waste: Pile = [card('hearts', 6)]  // can't go to tableau (heart on heart) or foundation

    expect(isDeadGame({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: 0,
    })).toBe(true)
  })

  it('returns false when playable card is at cycle-2 draw-3 position (needs 2 recycles)', () => {
    // waste = [2♦(pos0), 9♣(pos1), A♥(pos2), 5♠(pos3), 8♣(pos4), Q♦(pos5=top)]
    // Draw-3 cycle-1: exposes pos0 (2♦) then pos3 (5♠) — neither goes to empty foundations
    // Draw-3 cycle-2: exposes pos2 (A♥) — goes straight to empty foundation!
    // With recyclesRemaining=2 the BFS finds A♥ → foundation → returns false (not dead)
    const waste: Pile = [
      card('diamonds', 2),  // pos0
      card('clubs', 9),     // pos1
      card('hearts', 1),    // pos2 — Ace, only reachable on cycle 2
      card('spades', 5),    // pos3
      card('clubs', 8),     // pos4
      card('diamonds', 12), // pos5 top
    ]
    expect(isDeadGame({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau: emptyTableau(),
      recyclesRemaining: 2,
      drawMode: 3,
    })).toBe(false)
  })

  it('returns true for same cycle-2 scenario with only 1 recycle available', () => {
    // Same board — A♥ is at cycle-2 position, but with only 1 recycle available
    // the BFS only explores cycle-1 positions (pos0 and pos3), never reaches A♥
    const waste: Pile = [
      card('diamonds', 2),  // pos0
      card('clubs', 9),     // pos1
      card('hearts', 1),    // pos2 — only exposed on cycle 2
      card('spades', 5),    // pos3
      card('clubs', 8),     // pos4
      card('diamonds', 12), // pos5 top
    ]
    expect(isDeadGame({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau: emptyTableau(),
      recyclesRemaining: 1,
      drawMode: 3,
    })).toBe(true)
  })
})
