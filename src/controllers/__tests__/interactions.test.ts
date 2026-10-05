import { describe, expect, it } from 'vitest'
import { chooseDropTarget, DROP_TOLERANCE, isLegalDestination, readDestination, resolveSource, cardName } from '../interactions'
import { applyMove, applyFlip, type Board } from '../../engine/gameActions'
import type { Card } from '../../types/cards'

const card = (suit: Card['suit'], rank: Card['rank'], faceUp = true): Card => ({
  id: `${suit}-${rank}`, suit, rank, faceUp,
})
function board(): Board {
  return { stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []] }
}

describe('explicit card placement', () => {
  it('allows a visible run, preserving its geometry and validating its destination', () => {
    const state = board()
    state.tableau[0] = [card('spades', 9, false), card('hearts', 8), card('clubs', 7)]
    state.tableau[1] = [card('spades', 9)]
    const source = resolveSource(state, 'tableau', 0, 1, [0, 12])
    expect(source?.offsets).toEqual([0, 12])
    expect(isLegalDestination(state, source!, { toType: 'tableau', toIndex: 1 })).toBe(true)
    expect(isLegalDestination(state, source!, { toType: 'tableau', toIndex: 0 })).toBe(false)
    expect(isLegalDestination(state, source!, { toType: 'foundation', toIndex: 0 })).toBe(false)
    const next = applyFlip(applyMove(state, { fromType: 'tableau', fromIndex: 0, cardIndex: 1, toType: 'tableau', toIndex: 1 }), 0)
    expect(next.tableau[0][0].faceUp).toBe(true)
    expect(next.tableau[1].map(c => c.rank)).toEqual([9, 8, 7])
    expect(state.tableau[0][0].faceUp).toBe(false)
  })
  it('allows waste and foundation returns, but only from their top card', () => {
    const state = board()
    state.waste = [card('clubs', 2), card('hearts', 1)]
    state.foundations[0] = [card('spades', 1), card('spades', 2)]
    state.tableau[1] = [card('diamonds', 3)]
    expect(resolveSource(state, 'waste', undefined, 0)).toBeNull()
    const ace = resolveSource(state, 'waste', undefined, 1)!
    expect(isLegalDestination(state, ace, { toType: 'foundation', toIndex: 1 })).toBe(true)
    expect(resolveSource(state, 'foundation', 0, 0)).toBeNull()
    const two = resolveSource(state, 'foundation', 0, 1)!
    expect(isLegalDestination(state, two, { toType: 'tableau', toIndex: 1 })).toBe(true)
  })
  it('rejects stale cards, hidden cards, invalid indices, and invalid runs', () => {
    const state = board()
    state.tableau[0] = [card('hearts', 13)]
    const source = resolveSource(state, 'tableau', 0, 0)!
    expect(isLegalDestination(state, source, { toType: 'tableau', toIndex: 1 })).toBe(true)
    expect(isLegalDestination(state, source, { toType: 'tableau', toIndex: 7 })).toBe(false)
    expect(isLegalDestination(state, source, { toType: 'tableau', toIndex: -1 })).toBe(false)
    state.tableau[0] = [card('diamonds', 13)]
    expect(isLegalDestination(state, source, { toType: 'tableau', toIndex: 1 })).toBe(false)
    state.tableau[0] = [card('hearts', 13, false)]
    expect(resolveSource(state, 'tableau', 0, 0)).toBeNull()
    expect(resolveSource(state, 'tableau', 9, 0)).toBeNull()
    expect(resolveSource(state, 'waste', undefined, -1)).toBeNull()
    state.tableau[0] = [card('hearts', 13), card('diamonds', 12)]
    expect(isLegalDestination(state, resolveSource(state, 'tableau', 0, 0)!, { toType: 'tableau', toIndex: 1 })).toBe(false)
  })
  it('reads only typed destinations and uses descriptive card names', () => {
    expect(readDestination({ toType: 'stock', toIndex: 0 })).toBeNull()
    expect(readDestination({ toType: 'tableau', toIndex: '1' })).toBeNull()
    expect(readDestination(null)).toBeNull()
    expect(cardName(card('hearts', 12))).toBe('Queen of hearts')
  })
})

describe('bounded drop forgiveness in rendered CSS pixels', () => {
  const target = { id: 'a', left: 100, right: 150, top: 100, bottom: 200, legal: true }
  it('accepts a direct legal hit and a near miss at the exact boundary', () => {
    expect(chooseDropTarget({ x: 125, y: 150 }, [target])).toBe('a')
    expect(chooseDropTarget({ x: 150 + DROP_TOLERANCE, y: 150 }, [target])).toBe('a')
    expect(chooseDropTarget({ x: 150 + DROP_TOLERANCE + 0.01, y: 150 }, [target])).toBeNull()
    expect(chooseDropTarget({ x: 159, y: 209 }, [target])).toBeNull()
  })
  it('rejects ambiguous, distant, and illegal pile releases without nearest-pile autoplay', () => {
    const other = { ...target, id: 'b', left: 160, right: 210 }
    expect(chooseDropTarget({ x: 155, y: 150 }, [target, other])).toBeNull()
    expect(chooseDropTarget({ x: 500, y: 500 }, [target])).toBeNull()
    expect(chooseDropTarget({ x: 125, y: 150 }, [{ ...target, legal: false }])).toBeNull()
    expect(chooseDropTarget({ x: 160, y: 150 }, [target, { ...other, legal: false }])).toBeNull()
  })
})
