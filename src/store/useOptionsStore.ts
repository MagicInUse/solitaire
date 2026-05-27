/**
 * @module useOptionsStore
 * Persisted Zustand store for all player-configurable game settings.
 *
 * Stored in `localStorage` under `"solitaire-options"` (v1).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameOptions, DrawMode, DeckLocation } from '../types/options'
import { DEFAULT_OPTIONS } from '../types/options'

interface OptionsStore extends GameOptions {
  setDrawMode: (mode: DrawMode) => void
  setDeckLocation: (loc: DeckLocation) => void
  setCardBackId: (id: string) => void
  setAnimationsEnabled: (v: boolean) => void
  setSfxEnabled: (v: boolean) => void
  setStockRecycles: (v: number | 'unlimited') => void
}

export const useOptionsStore = create<OptionsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_OPTIONS,
      setDrawMode:           (drawMode)           => set({ drawMode }),
      setDeckLocation:       (deckLocation)       => set({ deckLocation }),
      setCardBackId:         (cardBackId)         => set({ cardBackId }),
      setAnimationsEnabled:  (animationsEnabled)  => set({ animationsEnabled }),
      setSfxEnabled:         (sfxEnabled)         => set({ sfxEnabled }),
      setStockRecycles:      (stockRecycles)      => set({ stockRecycles }),
    }),
    {
      name: 'solitaire-options',
      version: 1,
    }
  )
)
