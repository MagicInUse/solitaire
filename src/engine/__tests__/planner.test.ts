/**
 * Tests for the production endgame solver in engine/planner.ts.
 *
 * `findWinningPlan` performs a bounded DFS over the full game (moves + draws +
 * recycles) and returns a concrete winning line, or null when none is found in
 * budget. These tests pin:
 *  - an already-won board needs an empty plan
 *  - a one-move-from-won board is solved with the final foundation play
 *  - a small all-face-up tableau is driven to a full clear, and every action in
 *    the returned plan is legal and leads to 52 cards home
 *  - an unwinnable position returns null
 */

import { describe, it, expect } from 'vitest'
import type { Card, Pile } from '../../types/cards'
import type { Board } from '../gameActions'
import { applyMove, applyFlip, applyDraw, applyRecycle } from '../gameActions'
import { findWinningPlan, type PlanAction } from '../planner'

function card(suit: Card['suit'], rank: Card['rank'], faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp }
}

function emptyTableau(): Board['tableau'] {
  return [[], [], [], [], [], [], []]
}

/** Full foundation pile for a suit, ranks 1..max. */
function foundationUpTo(suit: Card['suit'], max: number): Pile {
  const out: Pile = []
  for (let r = 1; r <= max; r++) out.push(card(suit, r as Card['rank']))
  return out
}

function isWon(b: Board): boolean {
  return b.foundations.reduce((n, f) => n + f.length, 0) === 52
}

/** Replays a plan against a board, applying intrinsic flips, returning the result. */
function runPlan(start: Board, plan: PlanAction[], drawMode: 1 | 3): Board {
  let b = start
  for (const step of plan) {
    if (step.kind === 'draw') {
      b = applyDraw(b, drawMode)
    } else if (step.kind === 'recycle') {
      b = applyRecycle(b)
    } else {
      b = applyMove(b, step.move)
      if (step.move.fromType === 'tableau') b = applyFlip(b, step.move.fromIndex!)
    }
  }
  return b
}

describe('findWinningPlan', () => {
  it('returns an empty plan for an already-won board', () => {
    const board: Board = {
      stock: [],
      waste: [],
      foundations: [
        foundationUpTo('hearts', 13),
        foundationUpTo('diamonds', 13),
        foundationUpTo('clubs', 13),
        foundationUpTo('spades', 13),
      ],
      tableau: emptyTableau(),
    }
    const plan = findWinningPlan({ board, recyclesRemaining: 0, drawMode: 1 })
    expect(plan).toEqual([])
  })

  it('finds the final foundation play one move from a win', () => {
    // Every suit complete except spades up to Q; the K♠ sits on the tableau.
    const tableau = emptyTableau()
    tableau[0] = [card('spades', 13)]
    const board: Board = {
      stock: [],
      waste: [],
      foundations: [
        foundationUpTo('hearts', 13),
        foundationUpTo('diamonds', 13),
        foundationUpTo('clubs', 13),
        foundationUpTo('spades', 12),
      ],
      tableau,
    }
    const plan = findWinningPlan({ board, recyclesRemaining: 0, drawMode: 1 })
    expect(plan).not.toBeNull()
    expect(isWon(runPlan(board, plan!, 1))).toBe(true)
  })

  it('drives a small all-face-up tableau to a full clear with only legal moves', () => {
    // Hearts & diamonds & clubs done; spades 10,J,Q,K stacked descending need
    // to be unloaded to the foundation (spades up to 9 already home).
    const tableau = emptyTableau()
    tableau[0] = [card('spades', 13), card('spades', 12), card('spades', 11), card('spades', 10)]
    const board: Board = {
      stock: [],
      waste: [],
      foundations: [
        foundationUpTo('hearts', 13),
        foundationUpTo('diamonds', 13),
        foundationUpTo('clubs', 13),
        foundationUpTo('spades', 9),
      ],
      tableau,
    }
    const plan = findWinningPlan({ board, recyclesRemaining: 0, drawMode: 1 })
    expect(plan).not.toBeNull()
    const final = runPlan(board, plan!, 1)
    expect(isWon(final)).toBe(true)
  })

  it('returns null for an unwinnable position', () => {
    // A♠ is buried face-down under K♠ in a column with no empty column to move
    // the king to and no stock — the ace can never reach the foundation.
    const tableau = emptyTableau()
    tableau[0] = [card('spades', 1, false), card('spades', 13)]
    tableau[1] = [card('hearts', 13)]
    tableau[2] = [card('diamonds', 13)]
    tableau[3] = [card('clubs', 13)]
    const board: Board = {
      stock: [],
      waste: [],
      foundations: [
        foundationUpTo('hearts', 12),
        foundationUpTo('diamonds', 12),
        foundationUpTo('clubs', 12),
        [],
      ],
      tableau,
    }
    const plan = findWinningPlan({ board, recyclesRemaining: 0, drawMode: 1 })
    expect(plan).toBeNull()
  })
})
