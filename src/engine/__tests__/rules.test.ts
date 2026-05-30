import { describe, it, expect } from 'vitest'
import type { Card, Pile } from '../../types/cards'
import {
  isRed,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  canMoveStack,
  isValidRun,
} from '../rules'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function card(suit: Card['suit'], rank: Card['rank'], faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp }
}

// ─── isRed ───────────────────────────────────────────────────────────────────

describe('isRed', () => {
  it('returns true for hearts', () => expect(isRed(card('hearts', 1))).toBe(true))
  it('returns true for diamonds', () => expect(isRed(card('diamonds', 5))).toBe(true))
  it('returns false for clubs', () => expect(isRed(card('clubs', 2))).toBe(false))
  it('returns false for spades', () => expect(isRed(card('spades', 13))).toBe(false))
})

// ─── canPlaceOnFoundation ─────────────────────────────────────────────────────

describe('canPlaceOnFoundation', () => {
  it('accepts Ace on empty foundation', () => {
    expect(canPlaceOnFoundation(card('hearts', 1), [])).toBe(true)
  })
  it('rejects non-Ace on empty foundation', () => {
    expect(canPlaceOnFoundation(card('hearts', 2), [])).toBe(false)
  })
  it('accepts same-suit next rank on non-empty foundation', () => {
    const foundation: Pile = [card('clubs', 1), card('clubs', 2)]
    expect(canPlaceOnFoundation(card('clubs', 3), foundation)).toBe(true)
  })
  it('rejects wrong suit', () => {
    const foundation: Pile = [card('clubs', 1)]
    expect(canPlaceOnFoundation(card('hearts', 2), foundation)).toBe(false)
  })
  it('rejects wrong rank (skip)', () => {
    const foundation: Pile = [card('clubs', 1)]
    expect(canPlaceOnFoundation(card('clubs', 3), foundation)).toBe(false)
  })
  it('rejects same rank (duplicate)', () => {
    const foundation: Pile = [card('clubs', 1)]
    expect(canPlaceOnFoundation(card('clubs', 1), foundation)).toBe(false)
  })
})

// ─── canPlaceOnTableau ────────────────────────────────────────────────────────

describe('canPlaceOnTableau', () => {
  it('accepts King on empty pile', () => {
    expect(canPlaceOnTableau(card('hearts', 13), [])).toBe(true)
  })
  it('rejects non-King on empty pile', () => {
    expect(canPlaceOnTableau(card('hearts', 12), [])).toBe(false)
  })
  it('accepts red on black descending', () => {
    const pile: Pile = [card('spades', 8)]
    expect(canPlaceOnTableau(card('hearts', 7), pile)).toBe(true)
  })
  it('accepts black on red descending', () => {
    const pile: Pile = [card('hearts', 8)]
    expect(canPlaceOnTableau(card('clubs', 7), pile)).toBe(true)
  })
  it('rejects same colour', () => {
    const pile: Pile = [card('spades', 8)]
    expect(canPlaceOnTableau(card('clubs', 7), pile)).toBe(false)
  })
  it('rejects wrong rank', () => {
    const pile: Pile = [card('spades', 8)]
    expect(canPlaceOnTableau(card('hearts', 6), pile)).toBe(false)
  })
  it('rejects face-down top card', () => {
    const pile: Pile = [card('spades', 8, false)]
    expect(canPlaceOnTableau(card('hearts', 7), pile)).toBe(false)
  })
})

// ─── isValidRun ───────────────────────────────────────────────────────────────

describe('isValidRun', () => {
  it('single card is always valid', () => {
    const pile: Pile = [card('spades', 5)]
    expect(isValidRun(pile, 0)).toBe(true)
  })
  it('valid alternating descending run', () => {
    const pile: Pile = [card('spades', 7), card('hearts', 6), card('clubs', 5)]
    expect(isValidRun(pile, 0)).toBe(true)
  })
  it('partial run starting mid-pile is valid', () => {
    const pile: Pile = [
      card('spades', 9),
      card('hearts', 7),  // broken: not rank-1 below previous
      card('clubs', 6),
      card('diamonds', 5),
    ]
    // Starting from index 1 — hearts-7, clubs-6, diamonds-5 is valid
    expect(isValidRun(pile, 1)).toBe(true)
  })
  it('invalid when consecutive same colour', () => {
    const pile: Pile = [card('spades', 7), card('clubs', 6)]
    expect(isValidRun(pile, 0)).toBe(false)
  })
  it('invalid when rank does not decrease', () => {
    const pile: Pile = [card('spades', 7), card('hearts', 7)]
    expect(isValidRun(pile, 0)).toBe(false)
  })
  it('invalid when next card is face-down', () => {
    const pile: Pile = [card('spades', 7), card('hearts', 6, false)]
    expect(isValidRun(pile, 0)).toBe(false)
  })
})

// ─── canMoveStack ─────────────────────────────────────────────────────────────

describe('canMoveStack', () => {
  it('moves single card to foundation', () => {
    expect(canMoveStack(
      [card('hearts', 1)],
      [],
      'foundation',
    )).toBe(true)
  })
  it('rejects multi-card stack to foundation', () => {
    expect(canMoveStack(
      [card('spades', 7), card('hearts', 6)],
      [],
      'foundation',
    )).toBe(false)
  })
  it('rejects empty stack', () => {
    expect(canMoveStack([], [], 'tableau')).toBe(false)
  })
  it('rejects face-down bottom card in stack', () => {
    expect(canMoveStack(
      [card('spades', 7, false)],
      [card('hearts', 8)],
      'tableau',
    )).toBe(false)
  })
  it('moves valid multi-card stack to tableau', () => {
    const moving = [card('spades', 7), card('hearts', 6), card('clubs', 5)]
    const dest: Pile = [card('hearts', 8)]
    expect(canMoveStack(moving, dest, 'tableau')).toBe(true)
  })
  it('rejects invalid internal sequence', () => {
    // clubs-7, clubs-6 — same colour
    const moving = [card('clubs', 7), card('clubs', 6)]
    const dest: Pile = [card('hearts', 8)]
    expect(canMoveStack(moving, dest, 'tableau')).toBe(false)
  })
  it('rejects stack that cannot land on dest', () => {
    const moving = [card('spades', 7)]
    const dest: Pile = [card('hearts', 7)]  // same rank, not rank-1
    expect(canMoveStack(moving, dest, 'tableau')).toBe(false)
  })
})
