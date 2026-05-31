/**
 * Tests for the canonical "useful move" predicate in engine/hints.ts.
 *
 * `classifyMove` is the single production definition of whether a move is worth
 * playing/showing (a multi-ply twin of engine/solver.redundancyOracle), and
 * `filterUsefulHints` derives the shown/played hint list from it. These tests
 * pin the axis-2/3 semantics that used to live in deadGame.isDirectProgress:
 *  - immediate progress (foundation play, waste play, hidden reveal) is productive
 *  - a pure shuffle that unlocks nothing is redundant
 *  - filterUsefulHints keeps productive moves (immediate first) and drops the rest
 */

import { describe, it, expect } from 'vitest'
import type { Card, Hint, Pile } from '../../types/cards'
import { computeHints, filterUsefulHints, classifyMove } from '../hints'

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

type BoardState = {
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
}

function find(board: BoardState, pred: (h: Hint) => boolean): Hint {
  const hints = computeHints(board)
  const h = hints.find(pred)
  if (!h) throw new Error('expected hint not found')
  return h
}

// ─── classifyMove ────────────────────────────────────────────────────────────

describe('classifyMove', () => {
  it('treats a waste → tableau play as productive (drawing down the waste is progress)', () => {
    const tableau = emptyTableau()
    tableau[0] = [card('diamonds', 10)]
    const board: BoardState = { waste: [card('spades', 9)], foundations: emptyFoundations(), tableau }
    const h = find(board, (x) => x.fromType === 'waste')
    expect(classifyMove(board, h)).toBe('productive')
  })

  it('treats a tableau → foundation play as productive', () => {
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 1)] // A♥
    const board: BoardState = { waste: [], foundations: emptyFoundations(), tableau }
    const h = find(board, (x) => x.toType === 'foundation')
    expect(classifyMove(board, h)).toBe('productive')
  })

  it('treats a hidden-card-revealing tableau move as productive', () => {
    const tableau = emptyTableau()
    tableau[0] = [card('hearts', 9, false), card('spades', 8), card('hearts', 7)]
    tableau[1] = [card('diamonds', 9)]
    const board: BoardState = { waste: [], foundations: emptyFoundations(), tableau }
    const h = find(board, (x) => x.fromType === 'tableau' && x.fromIndex === 0 && x.cardIndex === 1)
    expect(classifyMove(board, h)).toBe('productive')
  })

  it('treats a pure shuffle that unlocks nothing as redundant', () => {
    const tableau = emptyTableau()
    tableau[0] = [card('spades', 13), card('hearts', 12), card('spades', 11), card('hearts', 10)]
    tableau[1] = [card('clubs', 11)]
    const board: BoardState = { waste: [], foundations: emptyFoundations(), tableau }
    const h = find(board, (x) => x.fromType === 'tableau' && x.fromIndex === 0)
    expect(classifyMove(board, h)).toBe('redundant')
  })
})

// ─── filterUsefulHints ───────────────────────────────────────────────────────

describe('filterUsefulHints', () => {
  it('returns [] when every legal move is a redundant shuffle', () => {
    const tableau = emptyTableau()
    tableau[0] = [card('spades', 13), card('hearts', 12), card('spades', 11), card('hearts', 10)]
    tableau[1] = [card('clubs', 11)]
    const board: BoardState = { waste: [], foundations: emptyFoundations(), tableau }
    const hints = computeHints(board)
    expect(hints.length).toBeGreaterThan(0) // the board is alive
    expect(filterUsefulHints(hints, tableau, board.foundations, board.waste)).toHaveLength(0)
  })

  it('keeps a productive move and drops a redundant shuffle on the same board', () => {
    const tableau = emptyTableau()
    // col0: hidden 9♥ under face-up 8♠ 7♥ → moving 8♠7♥ onto 9♦ reveals the 9♥.
    tableau[0] = [card('hearts', 9, false), card('spades', 8), card('hearts', 7)]
    tableau[1] = [card('diamonds', 9)]
    // col2/col3: a pure 10♥ → J♣ shuffle that unlocks nothing.
    tableau[2] = [card('spades', 13), card('hearts', 12), card('spades', 11), card('hearts', 10)]
    tableau[3] = [card('clubs', 11)]
    const board: BoardState = { waste: [], foundations: emptyFoundations(), tableau }

    const hints = computeHints(board)
    const useful = filterUsefulHints(hints, tableau, board.foundations, board.waste)

    // Only the reveal move survives; the shuffle is dropped.
    expect(useful).toHaveLength(1)
    expect(useful[0].fromType).toBe('tableau')
    expect(useful[0].fromIndex).toBe(0)
    expect(useful[0].cardIndex).toBe(1)
  })
})
