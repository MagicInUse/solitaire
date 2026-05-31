/**
 * Tests for engine/deadGame.ts — the two independent axes it now exposes:
 * isDeadGame (AXIS 1 — liveness) and hasReachableProgress (AXIS 2/3 — progress).
 *
 * Key scenarios validated:
 *  - isDeadGame is pure liveness: ANY legal move (incl. shuffles/back-moves)
 *    in any reachable draw/recycle state means ALIVE
 *  - hasReachableProgress is stronger: a board can be alive yet have no
 *    reachable useful move (delegated to the canonical filterUsefulHints)
 *  - Buried waste card logic works correctly
 *  - Stock cards always mean not-dead
 */

import { describe, it, expect } from 'vitest'
import type { Card, Pile } from '../../types/cards'
import { isDeadGame, hasReachableProgress, isStuckGame } from '../deadGame'
import type { Board } from '../gameActions'

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

// ─── isDeadGame ───────────────────────────────────────────────────────────────

describe('isDeadGame (AXIS 1 — liveness)', () => {
  it('returns false when a stock card can eventually be placed', () => {
    // A♥ in the stock: drawing it surfaces a legal foundation play → ALIVE.
    expect(isDeadGame({
      stock: [card('hearts', 1)],
      waste: [],
      foundations: emptyFoundations(),
      tableau: emptyTableau(),
      recyclesRemaining: 0,
    })).toBe(false)
  })

  it('returns true when stock cards exist but none can ever be placed', () => {
    // Lone 5♣ with a frozen empty board and no recycle: it can be drawn but
    // never placed (non-King can't go to an empty column, no Ace foundations).
    // Under strict liveness, an undrawable-into-a-move card is dead.
    expect(isDeadGame({
      stock: [card('clubs', 5)],
      waste: [],
      foundations: emptyFoundations(),
      tableau: emptyTableau(),
      recyclesRemaining: 0,
    })).toBe(true)
  })

  it('returns false when the board offers a foundation back-move (alive, though won)', () => {
    // All 52 cards on the foundations, tableau empty. A King can legally be
    // moved foundation→empty-column — a legal move of *some* kind — so under
    // strict liveness the board is ALIVE. (The modal is suppressed on a won
    // board separately, so this never surfaces to the player.)
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
    })).toBe(false)
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

  it('returns false when a buried waste card can be placed, even into a dead-end (liveness)', () => {
    // waste = [9♠(buried), 3♥(top)]; tableau [10♦],[8♣]; unlimited recycles.
    // Recycling surfaces 9♠, which legally lands on 10♦ — that placement alone
    // keeps the game ALIVE under axis-1 liveness, even though no further
    // PROGRESS follows (8♣ can't continue on 9♠, same colour). The "leads
    // nowhere" judgement belongs to hasReachableProgress, not isDeadGame.
    const tableau2 = emptyTableau()
    tableau2[0] = [card('diamonds', 10)]  // 10♦ — 9♠ can land here
    tableau2[1] = [card('clubs', 8)]      // 8♣ — can't go on 9♠ (same colour black)

    const waste2: Pile = [card('spades', 9), card('hearts', 3)]

    expect(isDeadGame({
      stock: [],
      waste: waste2,
      foundations: emptyFoundations(),
      tableau: tableau2,
      recyclesRemaining: Infinity,
    })).toBe(false)
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

describe('hasReachableProgress (AXIS 2/3 — genuine advancement)', () => {
  it('returns false when the board is alive but every move is a redundant shuffle', () => {
    // col0 = K♠ Q♥ J♠ 10♥ (all face-up, no hidden); col1 = J♣.
    // The ONLY legal move is 10♥ → J♣ — a pure shuffle that reveals nothing,
    // empties nothing, and reaches no foundation. The game is ALIVE (a move
    // exists) yet NO progress is reachable, so the AI must idle, not recycle.
    const tableau = emptyTableau()
    tableau[0] = [card('spades', 13), card('hearts', 12), card('spades', 11), card('hearts', 10)]
    tableau[1] = [card('clubs', 11)]

    expect(hasReachableProgress({
      stock: [],
      waste: [],
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: Infinity,
    })).toBe(false)
  })

  it('returns true when a reachable waste card can be played to the tableau', () => {
    // 9♠ is buried in the waste; after a recycle + draw it surfaces and lands
    // on 10♦. Drawing the waste down is genuine progress per the ratified
    // axis-2 definition (fromWaste), so progress IS reachable.
    const tableau = emptyTableau()
    tableau[0] = [card('diamonds', 10)]
    tableau[1] = [card('clubs', 8)]
    const waste: Pile = [card('spades', 9), card('hearts', 3)]

    expect(hasReachableProgress({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: Infinity,
    })).toBe(true)
  })

  it('returns true when a tableau move reveals a hidden card', () => {
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 9, false), card('spades', 7), card('hearts', 6)]
    tableau[3] = [card('hearts', 8)]

    expect(hasReachableProgress({
      stock: [],
      waste: [],
      foundations: emptyFoundations(),
      tableau,
      recyclesRemaining: 0,
    })).toBe(true)
  })

  it('returns true when an Ace at the cycle-2 draw-3 position can reach the foundation', () => {
    const waste: Pile = [
      card('diamonds', 2),
      card('clubs', 9),
      card('hearts', 1),   // Ace — only exposed on cycle 2
      card('spades', 5),
      card('clubs', 8),
      card('diamonds', 12),
    ]
    expect(hasReachableProgress({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau: emptyTableau(),
      recyclesRemaining: 2,
      drawMode: 3,
    })).toBe(true)
  })

  it('returns false for the same Ace board when only 1 recycle is available', () => {
    const waste: Pile = [
      card('diamonds', 2),
      card('clubs', 9),
      card('hearts', 1),
      card('spades', 5),
      card('clubs', 8),
      card('diamonds', 12),
    ]
    expect(hasReachableProgress({
      stock: [],
      waste,
      foundations: emptyFoundations(),
      tableau: emptyTableau(),
      recyclesRemaining: 1,
      drawMode: 3,
    })).toBe(false)
  })
})

describe('isStuckGame (AXIS 4 — modal: alive-but-unwinnable counts as over)', () => {
  it('fires on a real alive-but-unwinnable endgame (the colored-rocks state)', () => {
    // A genuine end position reached in play: every tableau card is face-up
    // except a few, the stock is empty, and the only legal moves are reversible
    // King/stack relocations between two empty columns plus a foundation
    // back-move. The game is ALIVE (legal moves remain) but UNWINNABLE — the
    // waste's 10♦/9♦ can never be placed and no shuffle advances anything.
    const board: Board = {
      stock: [],
      waste: [card('diamonds', 10), card('diamonds', 9)],
      foundations: [
        [1, 2, 3, 4, 5, 6].map((r) => card('hearts', r as Card['rank'])),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => card('clubs', r as Card['rank'])),
        [1, 2, 3, 4].map((r) => card('spades', r as Card['rank'])),
        [1, 2, 3, 4].map((r) => card('diamonds', r as Card['rank'])),
      ] as [Pile, Pile, Pile, Pile],
      tableau: [
        [card('hearts', 13), card('clubs', 12), card('diamonds', 11)],
        [
          card('clubs', 13), card('diamonds', 12), card('spades', 11), card('hearts', 10),
          card('spades', 9), card('hearts', 8), card('spades', 7), card('diamonds', 6),
        ],
        [],
        [],
        [card('spades', 12, false), card('diamonds', 13, false), card('hearts', 12)],
        [card('diamonds', 5, false), card('diamonds', 8)],
        [
          card('hearts', 7, false), card('spades', 5, false), card('clubs', 11, false),
          card('spades', 13, false), card('hearts', 11), card('spades', 10), card('hearts', 9),
          card('spades', 8), card('diamonds', 7), card('spades', 6),
        ],
      ] as [Pile, Pile, Pile, Pile, Pile, Pile, Pile],
    }

    // Strict liveness still says ALIVE (legal King-stack shuffles remain)…
    expect(isDeadGame({
      stock: board.stock,
      waste: board.waste,
      foundations: board.foundations,
      tableau: board.tableau,
      recyclesRemaining: Infinity,
      drawMode: 3,
    })).toBe(false)

    // …but the modal predicate correctly calls it over: no reachable progress
    // and no winnable plan.
    expect(isStuckGame({ board, recyclesRemaining: Infinity, drawMode: 3 })).toBe(true)
  })

  it('does NOT fire while genuine progress is still reachable', () => {
    // A tableau move reveals a hidden card — real progress remains, so the
    // player must be left to keep playing.
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 9, false), card('spades', 7), card('hearts', 6)]
    tableau[3] = [card('hearts', 8)]
    const board: Board = { stock: [], waste: [], foundations: emptyFoundations(), tableau }

    expect(isStuckGame({ board, recyclesRemaining: Infinity, drawMode: 3 })).toBe(false)
  })

  it('fires on a genuinely dead board (no legal move of any kind)', () => {
    // Red-on-red singletons, no empties, no stock, no recycles — zero legal
    // moves. The strictest dead case is a subset of "stuck".
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 2)]
    tableau[1] = [card('hearts', 4)]
    tableau[2] = [card('hearts', 6)]
    tableau[3] = [card('hearts', 8)]
    const board: Board = { stock: [], waste: [], foundations: emptyFoundations(), tableau }

    expect(isStuckGame({ board, recyclesRemaining: 0, drawMode: 3 })).toBe(true)
  })
})
