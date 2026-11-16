import { describe, expect, it, vi, afterEach } from 'vitest'
import { AnalysisClient, type AnalysisWorker } from '../analysisClient'
import { analyze, nextVisibleInput, type AnalysisInput } from '../../engine/analysis'
import type { AnalysisRequest, AnalysisResponse } from '../../engine/analysis.worker'

class FakeWorker implements AnalysisWorker {
  onmessage: ((event: MessageEvent<AnalysisResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  request?: AnalysisRequest
  terminate = vi.fn()
  postMessage(message: AnalysisRequest) { this.request = message }
  progress(id = this.request!.id) {
    this.onmessage?.({ data: { id, pending: true } } as MessageEvent<AnalysisResponse>)
  }
  reply(id = this.request!.id) {
    this.onmessage?.({ data: { id, result: analyze(this.request!.input) } } as MessageEvent<AnalysisResponse>)
  }
}

const state = (): AnalysisInput => ({
  board: {
    stock: [], waste: [], foundations: [3, 0, 0, 0],
    tableau: [[0, 28], [43], [], [], [], [], []],
  },
  drawMode: 1, recyclesRemaining: Infinity,
})
afterEach(() => vi.useRealTimers())

describe('shared analysis client', () => {
  it('caches a result and its plan suffix without spawning another worker', async () => {
    const worker = new FakeWorker()
    const factory = vi.fn(() => worker)
    const client = new AnalysisClient(factory)
    const input = state()
    const pending = client.request(input, new AbortController().signal)
    worker.reply()
    const result = await pending
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(await client.request(input, new AbortController().signal)).toEqual(result)
    if (result.status !== 'found') throw new Error('fixture did not find a plan')
    const next = nextVisibleInput(input, result.plan[0])!
    expect(await client.request(next, new AbortController().signal))
      .toMatchObject({ status: 'found', plan: result.plan.slice(1) })
    expect(factory).toHaveBeenCalledOnce()
    client.dispose()
  })

  it('terminates cancelled CPU work and ignores late or wrong-ID responses', async () => {
    const workers: FakeWorker[] = []
    const client = new AnalysisClient(() => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker
    })
    const abort = new AbortController()
    const first = client.request(state(), abort.signal)
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    workers[0].progress()
    abort.abort()
    await rejected
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    const second = client.request(state(), new AbortController().signal)
    workers[0].reply()
    workers[1].reply(-1)
    workers[1].reply()
    await expect(second).resolves.toMatchObject({ status: 'found' })
    client.dispose()
  })

  it('cancels superseded requests and clears cached results on a new deal', async () => {
    const workers: FakeWorker[] = []
    const client = new AnalysisClient(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    })
    const first = client.request(state(), new AbortController().signal)
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    const second = client.request(state(), new AbortController().signal)
    await rejected
    workers[1].reply()
    await second
    client.clear()
    const third = client.request(state(), new AbortController().signal)
    expect(workers).toHaveLength(3)
    workers[2].reply()
    await third
    client.dispose()
  })

  it('surfaces worker errors, unreadable messages, startup failures, and timeouts', async () => {
    for (const kind of ['error', 'message', 'timeout'] as const) {
      vi.useFakeTimers()
      const w = new FakeWorker()
      const client = new AnalysisClient(() => w)
      const pending = client.request(state(), new AbortController().signal)
      const rejected = expect(pending).rejects.toBeInstanceOf(Error)
      if (kind === 'error') w.onerror?.({ message: 'worker broke' } as ErrorEvent)
      else if (kind === 'message') w.onmessageerror?.({} as MessageEvent)
      else vi.advanceTimersByTime(5000)
      await rejected
      expect(w.terminate).toHaveBeenCalledOnce()
      client.dispose()
      vi.useRealTimers()
    }
    const client = new AnalysisClient(() => { throw new Error('startup failed') })
    await expect(client.request(state(), new AbortController().signal)).rejects.toThrow('startup failed')
  })

  it('keeps ongoing searches pending beyond the watchdog and caches only the final plan', async () => {
    vi.useFakeTimers()
    const w = new FakeWorker()
    const factory = vi.fn(() => w)
    const client = new AnalysisClient(factory)
    let resolved = false
    const pending = client.request(state(), new AbortController().signal)
    void pending.then(() => { resolved = true })
    for (let slice = 0; slice < 3; slice++) {
      await vi.advanceTimersByTimeAsync(4000)
      w.progress()
    }
    expect(resolved).toBe(false)
    expect(w.terminate).not.toHaveBeenCalled()
    w.reply()
    const result = await pending
    expect(result).toMatchObject({ status: 'found' })
    expect(await client.request(state(), new AbortController().signal)).toEqual(result)
    expect(factory).toHaveBeenCalledOnce()
    client.dispose()
    await vi.advanceTimersByTimeAsync(5000)
  })

  it('still times out if a continuing worker stops reporting progress', async () => {
    vi.useFakeTimers()
    const w = new FakeWorker()
    const client = new AnalysisClient(() => w)
    const pending = client.request(state(), new AbortController().signal)
    const rejected = expect(pending).rejects.toThrow('timed out')
    vi.advanceTimersByTime(4000)
    w.progress()
    vi.advanceTimersByTime(4000)
    w.progress(-1)
    vi.advanceTimersByTime(1000)
    await rejected
    expect(w.terminate).toHaveBeenCalledOnce()
    w.progress()
    client.dispose()
  })

  it('does not run a worker for an already-aborted request', async () => {
    const factory = vi.fn(() => new FakeWorker())
    const client = new AnalysisClient(factory)
    const abort = new AbortController()
    abort.abort()
    await expect(client.request(state(), abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(factory).not.toHaveBeenCalled()
  })

  it('bounds the cache and treats rule changes as new requests', async () => {
    const factory = vi.fn(() => {
      const w = new FakeWorker()
      const post = w.postMessage.bind(w)
      w.postMessage = message => { post(message); queueMicrotask(() => w.reply()) }
      return w
    })
    const client = new AnalysisClient(factory)
    const b = state()
    b.board = { stock: [0], waste: [], foundations: [0, 0, 0, 0], tableau: [[], [], [], [], [], [], []] }
    for (let remaining = 0; remaining < 70; remaining++) {
      await client.request({ ...b, recyclesRemaining: remaining }, new AbortController().signal)
    }
    expect(factory).toHaveBeenCalledTimes(70)
    await client.request({ ...b, recyclesRemaining: 0 }, new AbortController().signal)
    expect(factory).toHaveBeenCalledTimes(71)
    await client.request({ ...b, drawMode: 3, recyclesRemaining: 0 }, new AbortController().signal)
    expect(factory).toHaveBeenCalledTimes(72)
    client.dispose()
  })

  it('disposal rejects in-flight work instead of publishing a stale result', async () => {
    const w = new FakeWorker()
    const client = new AnalysisClient(() => w)
    const pending = client.request(state(), new AbortController().signal)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    client.dispose()
    w.reply()
    await rejected
    expect(w.terminate).toHaveBeenCalledOnce()
  })
})
