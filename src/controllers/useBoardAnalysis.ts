import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { useOptionsStore } from '../store/useOptionsStore'
import { observeBoard, visibleBoard, analysisKey, type AnalysisInput, type AnalysisResult } from '../engine/analysis'
import { AnalysisClient } from '../services/analysisClient'
import type { Board } from '../engine/gameActions'

export interface BoardAnalysis {
  status: 'pending' | 'ready' | 'error' | 'paused'
  key?: string
  input?: AnalysisInput
  result?: AnalysisResult
  error?: string
}

interface Snapshot extends BoardAnalysis {
  source: Board
  dealId: number
  drawMode: 1 | 3
  recyclesRemaining: number
}

/** Mounted once by GameBoard; all consumers receive the same versioned result. */
export function useBoardAnalysis(paused: boolean): BoardAnalysis {
  const stock = useGameStore(s => s.stock)
  const waste = useGameStore(s => s.waste)
  const foundations = useGameStore(s => s.foundations)
  const tableau = useGameStore(s => s.tableau)
  const dealId = useGameStore(s => s.dealId)
  const recycleCount = useGameStore(s => s.recycleCount)
  const drawMode = useOptionsStore(s => s.drawMode)
  const stockRecycles = useOptionsStore(s => s.stockRecycles)
  const recyclesRemaining = stockRecycles === 'unlimited'
    ? Infinity : Math.max(0, stockRecycles - recycleCount)
  const clientRef = useRef<AnalysisClient | null>(null)
  const memory = useRef({ dealId: -1, cards: new Map<string, number>() })
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    const client = new AnalysisClient()
    clientRef.current = client
    return () => { client.dispose(); clientRef.current = null }
  }, [])

  useEffect(() => {
    const client = clientRef.current!
    if (memory.current.dealId !== dealId) {
      memory.current = { dealId, cards: new Map() }
      client.clear()
    }
    const source = { stock, waste, foundations, tableau }
    observeBoard(source, memory.current.cards)
    if (paused) return
    const input = { board: visibleBoard(source, memory.current.cards), drawMode, recyclesRemaining }
    const base = { source, dealId, drawMode, recyclesRemaining, input, key: analysisKey(input) }
    const abort = new AbortController()
    setSnapshot({ ...base, status: 'pending' })
    void client.request(input, abort.signal).then(result => {
      if (!abort.signal.aborted) setSnapshot({ ...base, status: 'ready', result })
    }).catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error('Board analysis failed', error)
      setSnapshot({ ...base, status: 'error', error: error instanceof Error ? error.message : String(error) })
    })
    return () => abort.abort()
  }, [stock, waste, foundations, tableau, dealId, drawMode, recyclesRemaining, paused])

  if (paused) return { status: 'paused' }
  if (!snapshot || snapshot.dealId !== dealId || snapshot.drawMode !== drawMode ||
    snapshot.recyclesRemaining !== recyclesRemaining || snapshot.source.stock !== stock ||
    snapshot.source.waste !== waste || snapshot.source.foundations !== foundations ||
    snapshot.source.tableau !== tableau) return { status: 'pending' }
  return snapshot
}
