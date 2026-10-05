import { describe, expect, it } from 'vitest'
import type { Card } from '../../types/cards'
import type { Board } from '../gameActions'
import { applyDraw, applyRecycle, applyMove, applyFlip } from '../gameActions'
import { dealKlondike } from '../deck'
import { enumeratePlacements } from '../solver'
import {
  analyze, analysisKey, cardCode, observeBoard, visibleBoard, nextVisibleInput,
  ANALYSIS_LIMITS, type AnalysisInput, type VisibleBoard,
} from '../analysis'

const board = (): VisibleBoard => ({
  stock: [], waste: [], foundations: [0, 0, 0, 0],
  tableau: [[], [], [], [], [], [], []],
})
const input = (b = board(), recyclesRemaining = Infinity, drawMode: 1 | 3 = 1): AnalysisInput =>
  ({ board: b, recyclesRemaining, drawMode })
const deterministic = { ...ANALYSIS_LIMITS, maxMs: Infinity }
const card = (suit: Card['suit'], rank: Card['rank'], faceUp = true): Card =>
  ({ id: `${suit}-${rank}`, suit, rank, faceUp })

describe('visible-card analysis', () => {
  it('does not even read hidden faces or send their IDs', () => {
    const hidden: Card = {
      id: 'secret-tableau', faceUp: false,
      get suit(): Card['suit'] { throw new Error('peeked at suit') },
      get rank(): Card['rank'] { throw new Error('peeked at rank') },
    }
    const stock: Card = { ...card('spades', 13, false), id: 'secret-stock' }
    const b: Board = {
      stock: [stock], waste: [], foundations: [[], [], [], []],
      tableau: [[hidden, card('clubs', 6)], [card('hearts', 7)], [], [], [], [], []],
    }
    const memory = new Map<string, number>()
    observeBoard(b, memory)
    const visible = visibleBoard(b, memory)
    expect(visible.tableau[0][0]).toBe(0)
    expect(visible.stock).toEqual([0])
    expect(JSON.stringify(visible)).not.toContain('secret')
    const result = analyze(input(visible), deterministic)
    expect(result.status).toBe('found')
    if (result.status === 'found') {
      expect(result.goal).toBe('reveal')
      expect(result.plan).toHaveLength(1)
    }
  })

  it('makes identical choices for different unseen deals', () => {
    const visible = (hidden: Card, stock: Card) => visibleBoard({
      stock: [stock], waste: [], foundations: [[], [], [], []],
      tableau: [[hidden, card('clubs', 6)], [card('hearts', 7)], [], [], [], [], []],
    })
    const a = input(visible(card('hearts', 1, false), card('spades', 13, false)))
    const b = input(visible(card('diamonds', 12, false), card('clubs', 1, false)))
    expect(a).toEqual(b)
    expect(analyze(a, deterministic)).toMatchObject({
      ...analyze(b, deterministic), stats: expect.any(Object),
    })
  })

  it('plans a visible foundation back-move and stops exactly at a reveal', () => {
    const b = board()
    b.foundations[0] = cardCode(card('hearts', 3))
    b.tableau[0] = [0, cardCode(card('clubs', 2))]
    b.tableau[1] = [cardCode(card('spades', 4))]
    const result = analyze(input(b), deterministic)
    expect(result.status).toBe('found')
    if (result.status !== 'found') return
    expect(result.goal).toBe('reveal')
    expect(result.plan).toHaveLength(2)
    expect(result.plan[0]).toMatchObject({ kind: 'move', move: { fromType: 'foundation' } })
    const after = nextVisibleInput(input(b), result.plan[0])
    expect(after).not.toBeNull()
    expect(nextVisibleInput(after!, result.plan[1])).toBeNull()
  })

  it('draws unknown cards without evaluating their future moves', () => {
    const b = board()
    b.stock = [0, 0, 0]
    const result = analyze(input(b, 0, 3), deterministic)
    expect(result).toMatchObject({ status: 'found', goal: 'observe', plan: [{ kind: 'draw' }] })
    expect(analyze(input(b), deterministic, 'win')).toMatchObject({ status: 'unknown', reason: 'information' })
  })

  it('remembers only observed stock cards and forgets them with a fresh memory', () => {
    const c = card('hearts', 1)
    const b: Board = {
      stock: [], waste: [c], foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
    }
    const memory = new Map<string, number>()
    observeBoard(b, memory)
    const recycled = applyRecycle(b)
    expect(visibleBoard(recycled, memory).stock).toEqual([1])
    expect(visibleBoard(recycled).stock).toEqual([0])
  })

  it('honors draw-3 and finite/unlimited recycles without an artificial cap', () => {
    const b = board()
    b.stock = [1, cardCode(card('spades', 7)), cardCode(card('diamonds', 9))]
    expect(analyze(input(b, 0, 3), deterministic).status).toBe('no-progress')
    for (const remaining of [1, 12, Infinity]) {
      const result = analyze(input(b, remaining, 3), deterministic)
      expect(result.status).toBe('found')
      if (result.status === 'found') expect(result.plan).toEqual([
        { kind: 'draw' }, { kind: 'recycle' }, { kind: 'draw' },
        { kind: 'move', move: {
          fromType: 'waste', fromIndex: undefined, cardIndex: 2, toType: 'foundation', toIndex: 0,
        } },
      ])
    }
    expect(analyze(input(b, 0, 1), deterministic).status).toBe('found')
  })

  it('exhausts reversible King shuffles rather than looping', () => {
    const b = board()
    b.tableau[0] = [13]
    b.tableau[1] = [39]
    const result = analyze(input(b), deterministic)
    expect(result.status).toBe('no-progress')
    expect(result.stats.expanded).toBe(1)
  })

  it('returns explicit unknown for every resource cutoff', () => {
    const b = board()
    b.foundations[0] = 3
    b.tableau[0] = [0, 28]
    b.tableau[1] = [43]
    expect(analyze(input(b), { ...deterministic, maxNodes: 0 }))
      .toMatchObject({ status: 'unknown', reason: 'nodes' })
    expect(analyze(input(b), { ...deterministic, maxStates: 1 }))
      .toMatchObject({ status: 'unknown', reason: 'memory' })
    let clock = 0
    const result = analyze(input(b), { ...deterministic, maxMs: 1 }, 'progress', () => clock++)
    expect(result).toMatchObject({ status: 'unknown', reason: 'time' })
    expect(result.stats.expanded).toBe(0)
  })

  it('solves a visible endgame and distinguishes already won', () => {
    const b = board()
    b.foundations = [13, 26, 39, 51]
    b.tableau[0] = [52]
    const result = analyze(input(b), deterministic, 'win')
    expect(result.status).toBe('won')
    if (result.status === 'won') expect(result.plan).toHaveLength(1)
    b.foundations[3] = 52
    b.tableau[0] = []
    expect(analyze(input(b), deterministic)).toMatchObject({ status: 'won', plan: [] })
  })

  it('keys every visible board detail and rule, not only pile lengths', () => {
    const b = board()
    b.tableau[0] = [5]
    const a = analysisKey(input(b))
    expect(analysisKey(input({ ...b, tableau: [[6], [], [], [], [], [], []] }))).not.toBe(a)
    expect(analysisKey(input(b, 2))).not.toBe(a)
    expect(analysisKey(input(b, Infinity, 3))).not.toBe(a)
  })

  it('agrees with an independent exhaustive small-board progress search', () => {
    const cards = [card('hearts', 1), card('clubs', 2), card('diamonds', 3), card('spades', 4)]
    for (let mask = 0; mask < 16; mask++) {
      const b: Board = {
        stock: [], waste: [], foundations: [[], [], [], []],
        tableau: [[], [], [], [], [], [], []],
      }
      cards.forEach((c, i) => {
        if (mask & (1 << i)) b.tableau[i] = [c]
      })
      const queue: Board[] = [b]
      const seen = new Set<string>()
      let found = false
      for (let head = 0; head < queue.length && !found; head++) {
        const parent = queue[head]
        for (const move of enumeratePlacements(parent, true)) {
          if (move.toType === 'foundation') { found = true; break }
          const child = applyMove(parent, move)
          const key = child.tableau.map(p => p.map(c => c.id).join(',')).join('|')
          if (!seen.has(key)) { seen.add(key); queue.push(child) }
        }
      }
      const result = analyze(input(visibleBoard(b), 0), deterministic)
      expect(result.status, `small-board mask ${mask}`).toBe(found ? 'found' : 'no-progress')
    }
  })

  it.each([1, 3] as const)('executes legal, finite human-information games in draw-%i', drawMode => {
    for (const recyclesRemaining of [1, Infinity]) {
      for (let seed = 0; seed < 6; seed++) {
        let b: Board = dealKlondike({ seed: `visible-${seed}` })
        let remaining = recyclesRemaining
        const memory = new Map<string, number>()
        const seen = new Set<string>()
        let steps = 0
        while (steps < 1500) {
          observeBoard(b, memory)
          const state = { board: visibleBoard(b, memory), drawMode, recyclesRemaining: remaining }
          const key = analysisKey(state)
          expect(seen.has(key), `decision loop on visible-${seed}`).toBe(false)
          seen.add(key)
          const result = analyze(state, { ...deterministic, maxNodes: 3000, maxStates: 6000 })
          if (result.status !== 'found' && result.status !== 'won') break
          if (!result.plan.length) break
          for (let i = 0; i < result.plan.length; i++) {
            const action = result.plan[i]
            if (action.kind === 'draw') {
              expect(b.stock.length).toBeGreaterThan(0)
              b = applyDraw(b, drawMode)
            } else if (action.kind === 'recycle') {
              expect(b.stock.length).toBe(0)
              expect(remaining).toBeGreaterThan(0)
              remaining--
              b = applyRecycle(b)
            } else {
              expect(enumeratePlacements(b, true)).toContainEqual(action.move)
              const reveal = action.move.fromType === 'tableau' && action.move.cardIndex > 0 &&
                !b.tableau[action.move.fromIndex!][action.move.cardIndex - 1].faceUp
              if (reveal) expect(i).toBe(result.plan.length - 1)
              b = applyMove(b, action.move)
              if (action.move.fromType === 'tableau') b = applyFlip(b, action.move.fromIndex!)
            }
            steps++
          }
        }
        expect(steps).toBeLessThan(1500)
      }
    }
  })
})
