import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { localStorage: storage })
})

import { useOptionsStore } from '../useOptionsStore'
import { DEFAULT_OPTIONS } from '../../types/options'
import { useGameStore } from '../useGameStore'
import type { Card } from '../../types/cards'
import { isLegalDestination, resolveSource } from '../../controllers/interactions'

describe('control preferences', () => {
  it('defaults animations on while preserving a saved opt-out', async () => {
    expect(DEFAULT_OPTIONS.animationsEnabled).toBe(true)
    const migrate = useOptionsStore.persist.getOptions().migrate!
    expect(await migrate({}, 3)).toMatchObject({ animationsEnabled: true })
    expect(await migrate({ animationsEnabled: false }, 3)).toMatchObject({ animationsEnabled: false })
  })
  it('keeps legacy quick moves and defaults new assistance off', () => {
    expect(DEFAULT_OPTIONS.interactionMode).toBe('single-tap')
    expect(DEFAULT_OPTIONS.selectAndPlaceEnabled).toBe(false)
    expect(DEFAULT_OPTIONS.highlightLegalTargets).toBe(false)
    expect(DEFAULT_OPTIONS.highContrastCards).toBe(false)
  })
  it('migrates saved preferences without enabling new features', async () => {
    const migrate = useOptionsStore.persist.getOptions().migrate!
    const next = await migrate({ interactionMode: 'double-tap', drawMode: 3, hintsEnabled: false, colorScheme: 'dark' }, 3)
    expect(next).toMatchObject({
      interactionMode: 'double-tap', drawMode: 3, hintsEnabled: false, colorScheme: 'dark',
      selectAndPlaceEnabled: false, highlightLegalTargets: false, highContrastCards: false,
    })
  })
  it('persists explicit opt-ins and retains preferences on merge', () => {
    useOptionsStore.getState().setSelectAndPlaceEnabled(true)
    useOptionsStore.getState().setHighlightLegalTargets(true)
    useOptionsStore.getState().setHighContrastCards(true)
    expect(useOptionsStore.getState()).toMatchObject({ selectAndPlaceEnabled: true, highlightLegalTargets: true, highContrastCards: true })
    expect(localStorage.setItem).toHaveBeenCalledWith('solitaire-options', expect.stringContaining('"selectAndPlaceEnabled":true'))
    useOptionsStore.setState(DEFAULT_OPTIONS)
  })
})

describe('manual move store bookkeeping remains unchanged', () => {
  it('records one move with a reveal and restores the entire source through undo', () => {
    const original = useGameStore.getState()
    const hidden: Card = { id: 'spades-6', suit: 'spades', rank: 6, faceUp: false }
    const ace: Card = { id: 'hearts-1', suit: 'hearts', rank: 1, faceUp: true }
    try {
      useGameStore.setState({
        stock: [], waste: [], tableau: [[hidden, ace], [], [], [], [], [], []],
        foundations: [[], [], [], []], history: [], moveLog: [], moveCount: 0, isDealing: false, won: false,
      })
      const state = useGameStore.getState()
      const source = resolveSource(state, 'tableau', 0, 1)!
      expect(isLegalDestination(state, source, { toType: 'foundation', toIndex: 0 })).toBe(true)
      state.moveCards({ fromType: 'tableau', fromIndex: 0, cardIndex: 1, toType: 'foundation', toIndex: 0 })
      state.flipTableauTop(0)
      expect(useGameStore.getState()).toMatchObject({ moveCount: 1, tableau: [[{ ...hidden, faceUp: true }], [], [], [], [], [], []] })
      expect(useGameStore.getState().moveLog.map(x => x.type)).toEqual(['move', 'flip'])
      state.undo()
      expect(useGameStore.getState().tableau[0]).toEqual([hidden, ace])
      expect(useGameStore.getState().foundations[0]).toEqual([])
      expect(useGameStore.getState().moveCount).toBe(0)
    } finally { useGameStore.setState(original, true) }
  })
})
