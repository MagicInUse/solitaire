import { useState, useEffect } from 'react'
import type React from 'react'
import { useGameStore } from '../store/useGameStore'
import { useOptionsStore } from '../store/useOptionsStore'
import { isLegalPlanAction } from '../engine/analysis'
import type { BoardAnalysis } from '../controllers/useBoardAnalysis'

const SPEED_CONFIG = {
  slow: { execDelay: 900, showHint: true },
  normal: { execDelay: 500, showHint: true },
  fast: { execDelay: 200, showHint: false },
}

/** Decisions are supplied by the shared worker; this hook only schedules legal actions. */
export function useAIPlayer(analysis: BoardAnalysis) {
  const dealId = useGameStore(s => s.dealId)
  const [playing, setPlaying] = useState<{ dealId: number; enabled: boolean } | null>(null)
  const isAIPlaying = playing?.dealId === dealId && playing.enabled
  const setIsAIPlaying: React.Dispatch<React.SetStateAction<boolean>> = value => {
    setPlaying(current => {
      const active = current?.dealId === dealId && current.enabled
      return { dealId, enabled: typeof value === 'function' ? value(active) : value }
    })
  }
  const won = useGameStore(s => s.won)
  const isDealing = useGameStore(s => s.isDealing)
  const aiSpeed = useOptionsStore(s => s.aiSpeed)
  const showAI4ME = useOptionsStore(s => s.showAI4ME)

  useEffect(() => {
    if (!isAIPlaying) return
    const stop = () => {
      const timer = setTimeout(() => setPlaying({ dealId, enabled: false }), 0)
      return () => clearTimeout(timer)
    }
    if (won || isDealing || !showAI4ME || analysis.status === 'paused' || analysis.status === 'error') {
      return stop()
    }
    if (analysis.status !== 'ready' || !analysis.input || !analysis.result) return
    const { input, result } = analysis
    if (result.status !== 'found' && result.status !== 'won') {
      return stop()
    }
    const action = result.plan[0]
    if (!action) return stop()
    if (!isLegalPlanAction(input, action)) {
      console.error('Analysis returned an illegal action', action)
      return stop()
    }
    const source = useGameStore.getState()
    const cfg = SPEED_CONFIG[aiSpeed]
    const highlight = cfg.showHint && action.kind === 'move'
      ? setTimeout(() => source.setActiveHint(action.move), 0) : undefined
    const timer = setTimeout(() => {
      const live = useGameStore.getState()
      const options = useOptionsStore.getState()
      const remaining = options.stockRecycles === 'unlimited'
        ? Infinity : Math.max(0, options.stockRecycles - live.recycleCount)
      if (live.dealId !== dealId || live.stock !== source.stock || live.waste !== source.waste ||
        live.tableau !== source.tableau || live.foundations !== source.foundations ||
        options.drawMode !== input.drawMode || remaining !== input.recyclesRemaining) return
      if (action.kind === 'move') {
        live.moveCards(action.move)
        if (action.move.fromType === 'tableau') live.flipTableauTop(action.move.fromIndex!)
      } else if (action.kind === 'draw') live.drawFromStock(input.drawMode)
      else live.resetStock()
    }, cfg.execDelay)
    return () => {
      clearTimeout(timer)
      if (highlight !== undefined) clearTimeout(highlight)
    }
  }, [isAIPlaying, dealId, won, isDealing, showAI4ME, aiSpeed, analysis])

  return { isAIPlaying, setIsAIPlaying }
}
