/**
 * Reproducibility primitives: seeded RNG, seeded deals, and replay determinism.
 *
 * These guard the keystone of the diagnostic harness — if deals or replays
 * ever become non-deterministic, every seed-based fixture would be worthless.
 */

import { describe, it, expect } from 'vitest'
import { makeRng } from '../rng'
import { dealKlondike, buildDeck } from '../deck'
import { replay } from '../replay'
import { applyDraw, applyFlip, type Board, type LoggedAction } from '../gameActions'

describe('makeRng', () => {
  it('produces identical sequences for the same seed', () => {
    const a = makeRng('hello')
    const b = makeRng('hello')
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, makeRng('seed-A').next)
    const b = Array.from({ length: 20 }, makeRng('seed-B').next)
    expect(a).not.toEqual(b)
  })

  it('stays within [0, 1)', () => {
    const r = makeRng('range-check')
    for (let i = 0; i < 1000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('dealKlondike (seeded)', () => {
  it('is deterministic for a given seed', () => {
    const a = dealKlondike({ seed: 'deal-1' })
    const b = dealKlondike({ seed: 'deal-1' })
    expect(a.tableau).toEqual(b.tableau)
    expect(a.stock).toEqual(b.stock)
    expect(a.seed).toBe('deal-1')
  })

  it('echoes back a generated seed when none is supplied', () => {
    const d = dealKlondike()
    expect(typeof d.seed).toBe('string')
    expect(d.seed.length).toBeGreaterThan(0)
    // Re-dealing with the echoed seed reproduces the same board.
    const again = dealKlondike({ seed: d.seed })
    expect(again.tableau).toEqual(d.tableau)
  })

  it('deals all 52 cards exactly once', () => {
    const { stock, tableau } = dealKlondike({ seed: 'count' })
    const all = [...stock, ...tableau.flat()]
    expect(all).toHaveLength(52)
    expect(new Set(all.map((c) => c.id)).size).toBe(52)
    expect(buildDeck()).toHaveLength(52)
  })
})

describe('replay', () => {
  function board(seed: string): Board {
    const { stock, waste, foundations, tableau } = dealKlondike({ seed })
    return { stock, waste, foundations, tableau }
  }

  it('reproduces a draw + recycle sequence deterministically', () => {
    const seed = 'replay-1'
    const actions: LoggedAction[] = [
      { type: 'draw', drawMode: 3 },
      { type: 'draw', drawMode: 3 },
    ]
    const a = replay(seed, actions)
    const b = replay(seed, actions)
    expect(a).toEqual(b)

    // Hand-fold the same actions to confirm replay matches the transitions.
    let manual = board(seed)
    manual = applyDraw(manual, 3)
    manual = applyDraw(manual, 3)
    expect(a).toEqual(manual)
  })

  it('models undo by restoring the pre-action board', () => {
    const seed = 'replay-undo'
    const withUndo = replay(seed, [
      { type: 'draw', drawMode: 1 },
      { type: 'undo' },
    ])
    expect(withUndo).toEqual(board(seed))
  })

  it('treats flip as part of the preceding move, not an undo point', () => {
    const seed = 'replay-flip'
    const start = board(seed)
    // draw pushes one history point; flip pushes none; undo pops the draw, so
    // the net result is the original board.
    const replayed = replay(seed, [
      { type: 'draw', drawMode: 1 },
      { type: 'flip', colIndex: 0 },
      { type: 'undo' },
    ])
    expect(replayed).toEqual(start)
    // applyFlip is idempotent when the column's top card is already face-up.
    expect(applyFlip(start, 0)).toBe(start)
  })
})
