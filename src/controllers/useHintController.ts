/**
 * @module controllers/useHintController
 * Manages hint cycling for the "Hint" button in the game HUD.
 *
 * Tracks which hint in the useful-hints list was last shown so that
 * successive button presses cycle through all available moves before wrapping.
 * Resets automatically when the store clears `activeHint` (which happens on
 * every game action) and on each new game.
 */

import { useEffect, useState } from 'react'
import { useGameStore }           from '../store/useGameStore'
import { computeHints, filterUsefulHints } from '../engine/hints'

export interface UseHintControllerReturn {
  handleHint: () => void
}

export function useHintController(): UseHintControllerReturn {
  const waste       = useGameStore((s) => s.waste)
  const foundations = useGameStore((s) => s.foundations)
  const tableau     = useGameStore((s) => s.tableau)
  const activeHint  = useGameStore((s) => s.activeHint)
  const setActiveHint = useGameStore((s) => s.setActiveHint)
  const dealId      = useGameStore((s) => s.dealId)

  const [hintCycleIdx, setHintCycleIdx] = useState(0)

  // Reset cycle when the store clears activeHint (after any game action)
  useEffect(() => {
    if (!activeHint) setHintCycleIdx(0)
  }, [activeHint])

  // Reset on new game
  useEffect(() => { setHintCycleIdx(0) }, [dealId])

  function handleHint() {
    const useful = filterUsefulHints(
      computeHints({ waste, foundations, tableau }),
      tableau, foundations, waste,
    )
    if (useful.length === 0) { setActiveHint(null); setHintCycleIdx(0); return }
    const idx = hintCycleIdx % useful.length
    setActiveHint(useful[idx])
    setHintCycleIdx(idx + 1)
  }

  return { handleHint }
}
