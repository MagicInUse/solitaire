/**
 * Independent 3-axis oracle (engine/solver) — validated against hand-crafted
 * boards whose correct verdicts can be reasoned out by hand.
 *
 * These tests pin the oracle's *definitions* so that later sim-harness
 * disagreements with production can be trusted to indict production, not the
 * oracle.  They assert the ratified rulings:
 *   - liveness counts ANY legal move (incl. back-moves / K-to-empty);
 *   - progress is a per-move boolean over monotone metrics + waste-played;
 *   - redundancy distinguishes pure loops from genuine multi-ply unlocks.
 */

import { describe, it, expect } from 'vitest'
import type { Board } from '../gameActions'
import type { Card, Suit, Rank } from '../../types/cards'
import {
  enumeratePlacements,
  progressOracle,
  livenessOracle,
  redundancyOracle,
  type Placement,
} from '../solver'

const card = (suit: Suit, rank: Rank, faceUp = true): Card => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
  faceUp,
})

function emptyBoard(): Board {
  return {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
  }
}

describe('enumeratePlacements', () => {
  it('finds a King → empty column placement', () => {
    const b = emptyBoard()
    b.waste = [card('spades', 13)]
    const moves = enumeratePlacements(b)
    expect(moves).toContainEqual<Placement>({
      fromType: 'waste',
      cardIndex: 0,
      toType: 'tableau',
      toIndex: 0,
    })
  })

  it('omits foundation back-moves unless asked', () => {
    const b = emptyBoard()
    b.foundations[0] = [card('hearts', 1), card('hearts', 2)]
    b.tableau[0] = [card('spades', 3)]
    expect(enumeratePlacements(b, false).some((m) => m.fromType === 'foundation')).toBe(false)
    expect(enumeratePlacements(b, true).some((m) => m.fromType === 'foundation')).toBe(true)
  })
})

describe('livenessOracle (AXIS 1)', () => {
  it('reports DEAD when no stock, no recycles, and no placement exists', () => {
    expect(livenessOracle(emptyBoard(), 0, 1)).toBe('dead')
  })

  it('reports ALIVE when a placement exists right now', () => {
    const b = emptyBoard()
    b.waste = [card('spades', 13)] // King → empty column
    expect(livenessOracle(b, 0, 1)).toBe('alive')
  })

  it('reports ALIVE when a draw surfaces a playable card', () => {
    const b = emptyBoard()
    b.stock = [card('spades', 13, false)] // drawing reveals a King for the empty board
    expect(livenessOracle(b, 0, 1)).toBe('alive')
  })

  it('reports DEAD when draws never surface anything playable', () => {
    const b = emptyBoard()
    b.stock = [card('clubs', 2, false)] // a lone 2 can never be placed on an empty board
    expect(livenessOracle(b, 0, 1)).toBe('dead')
  })

  it('counts a foundation back-move as keeping the game alive (strict liveness)', () => {
    const b = emptyBoard()
    b.foundations[0] = [card('hearts', 1), card('hearts', 2)] // 2h can come back onto a 3
    b.tableau[0] = [card('spades', 3)]
    expect(livenessOracle(b, 0, 1)).toBe('alive')
  })
})

describe('progressOracle (AXIS 2)', () => {
  it('counts a waste card played as progress', () => {
    const b = emptyBoard()
    b.waste = [card('hearts', 6)]
    b.tableau[0] = [card('spades', 7)]
    const move: Placement = { fromType: 'waste', cardIndex: 0, toType: 'tableau', toIndex: 0 }
    expect(progressOracle(b, move)).toBe(true)
  })

  it('counts a tableau → foundation move as progress', () => {
    const b = emptyBoard()
    b.foundations[0] = [card('spades', 1)]
    b.tableau[0] = [card('spades', 2)]
    const move: Placement = { fromType: 'tableau', fromIndex: 0, cardIndex: 0, toType: 'foundation', toIndex: 0 }
    expect(progressOracle(b, move)).toBe(true)
  })

  it('counts revealing a hidden card as progress', () => {
    const b = emptyBoard()
    b.tableau[0] = [card('clubs', 9, false), card('hearts', 5)]
    b.tableau[1] = [card('spades', 6)]
    const move: Placement = { fromType: 'tableau', fromIndex: 0, cardIndex: 1, toType: 'tableau', toIndex: 1 }
    expect(progressOracle(b, move)).toBe(true)
  })

  it('does NOT count a foundation back-move with no metric gain as progress', () => {
    const b = emptyBoard()
    b.foundations[0] = [card('hearts', 1), card('hearts', 2)]
    b.tableau[0] = [card('spades', 3)]
    const move: Placement = { fromType: 'foundation', fromIndex: 0, cardIndex: 1, toType: 'tableau', toIndex: 0 }
    expect(progressOracle(b, move)).toBe(false)
  })
})

describe('redundancyOracle (AXIS 3)', () => {
  it('flags a foundation ↔ tableau ping-pong as redundant', () => {
    const b = emptyBoard()
    b.foundations[0] = [card('hearts', 1), card('hearts', 2)]
    b.tableau[0] = [card('spades', 3)]
    const move: Placement = { fromType: 'foundation', fromIndex: 0, cardIndex: 1, toType: 'tableau', toIndex: 0 }
    expect(redundancyOracle(b, move)).toBe('redundant')
  })

  it('recognises a multi-ply back-move that unlocks a hidden-card reveal as productive', () => {
    const b = emptyBoard()
    // 7h sits on the foundation; pulling it down bridges 6c → 7h, which then
    // reveals the hidden card under 6c. No reveal is possible at baseline
    // (no red 7 is on the tableau), so the back-move is genuinely productive.
    b.foundations[0] = [
      card('hearts', 1), card('hearts', 2), card('hearts', 3),
      card('hearts', 4), card('hearts', 5), card('hearts', 6), card('hearts', 7),
    ]
    b.tableau[0] = [card('diamonds', 10, false), card('clubs', 6)]
    b.tableau[1] = [card('spades', 8)]
    const move: Placement = { fromType: 'foundation', fromIndex: 0, cardIndex: 6, toType: 'tableau', toIndex: 1 }
    expect(progressOracle(b, move)).toBe(false) // the move itself makes no progress
    expect(redundancyOracle(b, move)).toBe('productive')
  })

  it('returns the immediate-progress move as productive without searching', () => {
    const b = emptyBoard()
    b.foundations[0] = [card('spades', 1)]
    b.tableau[0] = [card('spades', 2)]
    const move: Placement = { fromType: 'tableau', fromIndex: 0, cardIndex: 0, toType: 'foundation', toIndex: 0 }
    expect(redundancyOracle(b, move)).toBe('productive')
  })
})
