/**
 * Synchronous adapter for seeded engine simulations. The UI uses a worker.
 * Simulations should retain observedCards per deal to model a player's memory.
 */
import type { Pile, Hint } from '../types/cards'
import type { PlanAction } from '../engine/planner'
import { analyze, observeBoard, visibleBoard, isLegalPlanAction, ANALYSIS_LIMITS } from '../engine/analysis'

export type AIAction =
  | { type: 'move'; hint: Hint }
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'idle' }

export interface AIDecision {
  action: AIAction
  plan: PlanAction[]
  status: 'found' | 'won' | 'no-progress' | 'unknown'
}

export interface AIState {
  stock: Pile
  waste: Pile
  foundations: [Pile, Pile, Pile, Pile]
  tableau: [Pile, Pile, Pile, Pile, Pile, Pile, Pile]
  recycleCount: number
  stockRecycles: number | 'unlimited'
  won: boolean
  drawMode: 1 | 3
  plan?: PlanAction[]
  observedCards?: Map<string, number>
}

function execute(plan: PlanAction[]): AIDecision {
  const [step, ...rest] = plan
  const action: AIAction = step.kind === 'move'
    ? { type: 'move', hint: step.move } : { type: step.kind }
  return { action, plan: rest, status: 'found' }
}

export function getAIMove(state: AIState): AIDecision {
  if (state.won) return { action: { type: 'idle' }, plan: [], status: 'won' }
  const memory = state.observedCards ?? new Map<string, number>()
  observeBoard(state, memory)
  const input = {
    board: visibleBoard(state, memory),
    drawMode: state.drawMode,
    recyclesRemaining: state.stockRecycles === 'unlimited'
      ? Infinity : Math.max(0, state.stockRecycles - state.recycleCount),
  }
  if (state.plan?.length && isLegalPlanAction(input, state.plan[0])) return execute(state.plan)
  const result = analyze(input, { ...ANALYSIS_LIMITS, maxMs: Infinity })
  if ((result.status === 'found' || result.status === 'won') && result.plan.length) return execute(result.plan)
  return { action: { type: 'idle' }, plan: [], status: result.status }
}
