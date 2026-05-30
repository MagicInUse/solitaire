/**
 * @module useAnimationStore
 * Zustand store for transient, animation-related flags.
 *
 * Replaces the mutable module-level singletons in `utils/dragTracking.ts`,
 * putting animation state in the React data model so it integrates with
 * React 18's automatic batching.
 *
 * Neither field is persisted — both reset to falsy on page load.
 */

import { create } from 'zustand'

interface AnimationStore {
  /**
   * Card IDs for which the `layoutId` should be suppressed for one render after
   * a drag-and-drop, preventing Framer Motion from replaying the drag movement
   * as a second layout animation.
   *
   * Set in `handleDragEnd`; cleared via `requestAnimationFrame`.
   */
  droppedIds: ReadonlySet<string>

  /**
   * True for one render after the player presses Undo.
   * `CardView` uses this to switch to a spring transition so the card
   * snaps back with an elastic feel.
   *
   * Set in the undo button handler; cleared via `requestAnimationFrame`.
   */
  justUndid: boolean

  markDropped:  (cardIds: string[]) => void
  clearDropped: (cardIds: string[]) => void
  setJustUndid: (v: boolean)        => void
}

export const useAnimationStore = create<AnimationStore>()((set) => ({
  droppedIds: new Set<string>(),
  justUndid:  false,

  markDropped: (cardIds) =>
    set((s) => ({ droppedIds: new Set([...s.droppedIds, ...cardIds]) })),

  clearDropped: (cardIds) =>
    set((s) => {
      const next = new Set(s.droppedIds)
      for (const id of cardIds) next.delete(id)
      return { droppedIds: next }
    }),

  setJustUndid: (v) => set({ justUndid: v }),
}))
