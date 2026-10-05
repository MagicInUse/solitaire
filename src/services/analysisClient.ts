import {
  analysisKey, nextVisibleInput, type AnalysisInput, type AnalysisResult,
} from '../engine/analysis'
import type { AnalysisRequest, AnalysisResponse } from '../engine/analysis.worker'

export interface AnalysisWorker {
  postMessage: (message: AnalysisRequest) => void
  terminate: () => void
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}

const createWorker = (): AnalysisWorker =>
  new Worker(new URL('../engine/analysis.worker.ts', import.meta.url), { type: 'module' })

/** One owner for all assists; cancellation terminates CPU work, not just its callback. */
export class AnalysisClient {
  private cache = new Map<string, AnalysisResult>()
  private nextId = 0
  private cancelActive: (() => void) | null = null

  constructor(private factory: () => AnalysisWorker = createWorker) {}

  clear() {
    this.cancelActive?.()
    this.cache.clear()
  }

  dispose() { this.clear() }

  request(input: AnalysisInput, signal: AbortSignal): Promise<AnalysisResult> {
    this.cancelActive?.()
    if (signal.aborted) return Promise.reject(new DOMException('Analysis cancelled', 'AbortError'))
    const key = analysisKey(input)
    const cached = this.cache.get(key)
    if (cached) {
      this.cache.delete(key)
      this.cache.set(key, cached)
      return Promise.resolve(cached)
    }
    return new Promise((resolve, reject) => {
      const worker = this.factory()
      const id = ++this.nextId
      let settled = false
      const finish = (result?: AnalysisResult, error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        signal.removeEventListener('abort', cancel)
        worker.terminate()
        this.cancelActive = null
        if (error) reject(error)
        else if (result) {
          this.remember(input, result)
          resolve(result)
        }
      }
      const cancel = () => finish(undefined, new DOMException('Analysis cancelled', 'AbortError'))
      const timeout = setTimeout(() => finish(undefined, new Error('Board analysis worker timed out.')), 5000)
      this.cancelActive = cancel
      signal.addEventListener('abort', cancel, { once: true })
      worker.onmessage = ({ data }) => {
        if (data.id !== id) return
        if ('error' in data) finish(undefined, new Error(data.error))
        else finish(data.result)
      }
      worker.onerror = event => finish(undefined, new Error(event.message || 'Board analysis worker failed.'))
      worker.onmessageerror = () => finish(undefined, new Error('Board analysis response could not be read.'))
      try {
        worker.postMessage({ id, input })
      } catch (error) {
        finish(undefined, error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  private put(key: string, result: AnalysisResult) {
    this.cache.delete(key)
    this.cache.set(key, result)
    if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value!)
  }

  private remember(input: AnalysisInput, result: AnalysisResult) {
    this.put(analysisKey(input), result)
    if (result.status !== 'found' && result.status !== 'won') return
    let state = input
    for (let i = 0; i < result.plan.length - 1; i++) {
      const next = nextVisibleInput(state, result.plan[i])
      if (!next) break
      state = next
      this.put(analysisKey(state), { ...result, plan: result.plan.slice(i + 1) })
    }
  }
}
