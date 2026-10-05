import { analyze, type AnalysisInput, type AnalysisResult } from './analysis'

export interface AnalysisRequest {
  id: number
  input: AnalysisInput
}

export type AnalysisResponse =
  | { id: number; result: AnalysisResult }
  | { id: number; error: string }

const scope = globalThis as typeof globalThis & {
  postMessage: (response: AnalysisResponse) => void
}

scope.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const { id, input } = event.data
  try {
    scope.postMessage({ id, result: analyze(input) })
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
