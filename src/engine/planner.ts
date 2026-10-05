/**
 * Compatibility API for synchronous engine tests/tools.
 * Live assists use the shared analysis worker, never these blocking wrappers.
 */
import type { Board, MoveParams } from './gameActions'
import { analyze, visibleBoard, ANALYSIS_LIMITS } from './analysis'

export type PlanAction =
  | { kind: 'move'; move: MoveParams }
  | { kind: 'draw' }
  | { kind: 'recycle' }

export interface PlannerLimits {
  maxNodes: number
  /** Kept for source compatibility; actual recycle permissions are never truncated. */
  recycleCap: number
}

export const DEFAULT_PLANNER_LIMITS: PlannerLimits = { maxNodes: ANALYSIS_LIMITS.maxNodes, recycleCap: Infinity }
export const PROGRESS_PLANNER_LIMITS = DEFAULT_PLANNER_LIMITS

export interface PlannerState {
  board: Board
  recyclesRemaining: number
  drawMode: 1 | 3
  observedCards?: ReadonlyMap<string, number>
}

/** Null means inconclusive or exhausted, NOT proof of an unwinnable deal. */
export function findWinningPlan(state: PlannerState, limits = DEFAULT_PLANNER_LIMITS): PlanAction[] | null {
  const result = analyze({
    ...state, board: visibleBoard(state.board, state.observedCards),
  }, { maxNodes: limits.maxNodes, maxStates: limits.maxNodes * 2, maxMs: Infinity }, 'win')
  return result.status === 'won' ? result.plan : null
}

/** Plans stop at the first reveal/unknown draw; hidden identities are never simulated. */
export function findProgressPlan(state: PlannerState, limits = PROGRESS_PLANNER_LIMITS): PlanAction[] | null {
  const result = analyze({
    ...state, board: visibleBoard(state.board, state.observedCards),
  }, { maxNodes: limits.maxNodes, maxStates: limits.maxNodes * 2, maxMs: Infinity })
  return result.status === 'found' || result.status === 'won' ? result.plan : null
}
