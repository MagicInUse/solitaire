import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import type { BoardAnalysis } from './useBoardAnalysis'

/** Hints and Auto Play recommend the first step of the same visible-card plan. */
export function useHintController(analysis: BoardAnalysis) {
  const activeHint = useGameStore(s => s.activeHint)
  const [stockHintKey, setStockHintKey] = useState<string | null>(null)
  const [message, setMessage] = useState<{ key?: string; text: string } | null>(null)
  const step = analysis.result && 'plan' in analysis.result ? analysis.result.plan[0] : undefined
  function handleHint() {
    if (analysis.status !== 'ready') return
    if (step?.kind === 'move') {
      useGameStore.getState().setActiveHint(step.move)
      setStockHintKey(null)
      setMessage({ key: analysis.key, text: 'Follow the highlighted move.' })
    } else if (step) {
      useGameStore.getState().setActiveHint(null)
      setStockHintKey(analysis.key ?? null)
      setMessage({ key: analysis.key, text: step.kind === 'draw' ? 'Draw from the stock.' : 'Recycle the waste.' })
    } else {
      useGameStore.getState().setActiveHint(null)
      setStockHintKey(null)
      setMessage({ key: analysis.key, text: analysis.result?.status === 'unknown'
        ? 'No continuation found within the search limit. You can keep playing.'
        : 'No further visible progress found.' })
    }
  }
  return {
    handleHint,
    stockHinted: analysis.status === 'ready' && stockHintKey === analysis.key && !activeHint,
    hintMessage: message && message.key === analysis.key ? message.text : '',
  }
}
