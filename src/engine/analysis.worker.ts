import { analyzeInSlices, type AnalysisInput, type AnalysisResult } from './analysis'

export interface AnalysisRequest {
  id: number
  input: AnalysisInput
}

export type AnalysisResponse =
  | { id: number; result: AnalysisResult }
  | { id: number; pending: true }
  | { id: number; error: string }

const scope = globalThis as typeof globalThis & {
  postMessage: (response: AnalysisResponse) => void
}

scope.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const { id, input } = event.data
  const search = analyzeInSlices(input)
  const resume = () => {
    try {
      const step = search.next()
      if (step.done) scope.postMessage({ id, result: step.value })
      else {
        scope.postMessage({ id, pending: true })
        setTimeout(resume, 0)
      }
    } catch (error) {
      scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  resume()
}
