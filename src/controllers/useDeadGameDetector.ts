import { useState } from 'react'
import type React from 'react'
import { useGameStore } from '../store/useGameStore'
import type { BoardAnalysis } from './useBoardAnalysis'

/** Only exhaustive visible-state exhaustion may open the modal. */
export function useDeadGameDetector(analysis: BoardAnalysis): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const dealId = useGameStore(s => s.dealId)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const key = `${dealId}:${analysis.key}`
  const dead = analysis.status === 'ready' && analysis.result?.status === 'no-progress' && dismissed !== key
  const setDead: React.Dispatch<React.SetStateAction<boolean>> = value => {
    const next = typeof value === 'function' ? value(dead) : value
    setDismissed(next ? null : key)
  }
  return [dead, setDead]
}
