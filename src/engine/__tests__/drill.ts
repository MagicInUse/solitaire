/**
 * @file drill.ts  (test-only helper — not a *.test.ts, so it never auto-runs)
 * Phase-3 drill-down instrumentation: explains WHY production disagrees with
 * the oracle on a specific seed, without modifying any production code.
 *
 * The simulation harness (sim.test.ts) finds WHICH seeds misbehave; this
 * module explains the decisive step on a single seed by interrogating the
 * production predicates (computeHints / filterUsefulHints / classifyMove /
 * isDeadGame) and the independent oracle side by side,
 * then naming the exact legal moves involved.
 *
 * Design note (deviation from the original plan): rather than thread optional
 * trace callbacks through the four production functions — added surface area
 * and behavioural risk for zero production benefit, under a reveal-only
 * mandate — this drill module wraps those functions from the outside.  It is
 * imported only from drill.test.ts and the sim harness, so it stays out of the
 * production bundle.
 */

import type { Card, Hint } from '../../types/cards'
import { dealKlondike } from '../deck'
import { applyDraw, applyRecycle, applyMove, applyFlip, type Board } from '../gameActions'
import { computeHints, filterUsefulHints, classifyMove } from '../hints'
import { isDeadGame } from '../deadGame'
import { getAIMove } from '../../utils/aiPlayer'
import type { PlanAction } from '../../engine/planner'
import {
  enumeratePlacements,
  livenessOracle,
  redundancyOracle,
  type Placement,
  type Liveness,
} from '../solver'

const DRAW_MODE: 1 | 3 = 1
const STOCK_RECYCLES: number | 'unlimited' = 'unlimited'
const ORACLE_RECYCLE_CAP = 2
const MAX_STEPS = 2000
const LOOP_THRESHOLD = 3

// ─── Card / move naming ────────────────────────────────────────────────────────

const RANK_LABEL: Record<number, string> = {
  1: 'A', 11: 'J', 12: 'Q', 13: 'K',
}
const SUIT_SYMBOL: Record<Card['suit'], string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
}

function nameCard(c: Card): string {
  return `${RANK_LABEL[c.rank] ?? c.rank}${SUIT_SYMBOL[c.suit]}`
}

/** Resolves the card a placement moves, for human-readable trace lines. */
function movedCard(board: Board, p: Placement): Card | undefined {
  if (p.fromType === 'waste') return board.waste[p.cardIndex]
  if (p.fromType === 'tableau') return board.tableau[p.fromIndex!]?.[p.cardIndex]
  return board.foundations[p.fromIndex!]?.[p.cardIndex]
}

function nameMove(board: Board, p: Placement): string {
  const c = movedCard(board, p)
  const src = p.fromType === 'waste' ? 'waste' : `${p.fromType}${p.fromIndex}`
  const dst = p.toType === 'tableau' ? `tableau col ${p.toIndex}` : `foundation ${p.toIndex}`
  const tag = p.fromType === 'foundation' ? ' [back-move]' : ''
  return `${c ? nameCard(c) : '??'} : ${src} → ${dst}${tag}`
}

// ─── Board summary ─────────────────────────────────────────────────────────────

function summarise(b: Board): string {
  let foundation = 0
  for (const f of b.foundations) foundation += f.length
  let hidden = 0
  let empty = 0
  for (const col of b.tableau) {
    for (const c of col) if (!c.faceUp) hidden++
    if (col.length === 0) empty++
  }
  return `F=${foundation} hidden=${hidden} emptyCols=${empty} stock=${b.stock.length} waste=${b.waste.length}`
}

function boardKey(b: Board): string {
  const pile = (p: Card[]) => p.map((c) => `${c.suit[0]}${c.rank}${c.faceUp ? 'u' : 'd'}`).join(',')
  return [
    b.stock.map((c) => `${c.suit[0]}${c.rank}`).join(','),
    pile(b.waste),
    b.foundations.map(pile).join('#'),
    b.tableau.map(pile).join('|'),
  ].join('/')
}

function boardFromSeed(seed: string): Board {
  const { stock, waste, foundations, tableau } = dealKlondike({ seed })
  return { stock, waste, foundations, tableau }
}

function isWon(b: Board): boolean {
  return b.foundations.every((f) => f.length === 13)
}

// ─── The drill ─────────────────────────────────────────────────────────────────

export type DecisiveKind =
  | 'FALSE-DEAD-MODAL'
  | 'AI-MISSED-PROGRESS'
  | 'STUCK-CLEAN'
  | 'AI-LOOP'
  | 'WON'
  | 'STOPPED'

export interface DrillResult {
  seed: string
  kind: DecisiveKind
  step: number
  /** Fully formatted, multi-line human explanation of the decisive step. */
  report: string
}

/**
 * Replays the production AI on `seed` (faithful to useAIPlayer) until the first
 * decisive event, then builds a detailed explanation of that step by lining up
 * every production predicate against the oracle and naming the moves involved.
 */
export function drillSeed(seed: string): DrillResult {
  let board = boardFromSeed(seed)
  let recycleCount = 0
  let won = false
  let steps = 0
  let plan: PlanAction[] = []
  const stateCounts = new Map<string, number>()

  const recyclesProd = () =>
    STOCK_RECYCLES === 'unlimited' ? Infinity : Math.max(0, STOCK_RECYCLES - recycleCount)
  const recyclesOracle = () =>
    STOCK_RECYCLES === 'unlimited' ? ORACLE_RECYCLE_CAP : Math.max(0, STOCK_RECYCLES - recycleCount)

  const deadProd = (b: Board): boolean =>
    isDeadGame({
      stock: b.stock, waste: b.waste, foundations: b.foundations, tableau: b.tableau,
      recyclesRemaining: recyclesProd(), drawMode: DRAW_MODE,
    })

  while (steps < MAX_STEPS) {
    // ── Decisive check A: production declares dead while a move still exists ──
    if (board.stock.length === 0) {
      const verdict = livenessOracle(board, recyclesOracle(), DRAW_MODE)
      if (verdict === 'alive' && deadProd(board)) {
        return { seed, kind: 'FALSE-DEAD-MODAL', step: steps, report: explainFalseDead(seed, steps, board) }
      }
    }

    // ── Loop detection ──────────────────────────────────────────────────────
    const stateKey = `${boardKey(board)}~${recycleCount}`
    const seen = (stateCounts.get(stateKey) ?? 0) + 1
    stateCounts.set(stateKey, seen)
    if (seen > LOOP_THRESHOLD) {
      return { seed, kind: 'AI-LOOP', step: steps, report: explainLoop(seed, steps, board) }
    }

    const decision = getAIMove({
      stock: board.stock, waste: board.waste, foundations: board.foundations, tableau: board.tableau,
      recycleCount, stockRecycles: STOCK_RECYCLES, won, drawMode: DRAW_MODE,
      plan,
    })
    const action = decision.action
    plan = decision.plan

    if (action.type === 'idle') {
      // The AI chose to stop.  Classify that decision against the 3-axis model:
      //   • won            → WON (correct terminal)
      //   • liveness-dead  → STOPPED (correct: no legal move of any kind remains)
      //   • alive + some oracle-PRODUCTIVE move existed → AI-MISSED-PROGRESS (bug)
      //   • alive + no productive move                  → STUCK-CLEAN (correct idle)
      if (isWon(board)) return { seed, kind: 'WON', step: steps, report: `seed ${seed}: won at step ${steps}` }
      if (deadProd(board)) return { seed, kind: 'STOPPED', step: steps, report: `seed ${seed}: stopped (agrees dead) at step ${steps}` }
      const productive = enumeratePlacements(board, true).find(p => redundancyOracle(board, p) === 'productive')
      if (productive) {
        return { seed, kind: 'AI-MISSED-PROGRESS', step: steps, report: explainMissedProgress(seed, steps, board) }
      }
      return { seed, kind: 'STUCK-CLEAN', step: steps, report: explainStuckClean(seed, steps, board) }
    }

    if (action.type === 'move') {
      const h = action.hint
      board = applyMove(board, h as Placement)
      if (h.fromType === 'tableau' && h.fromIndex !== undefined) board = applyFlip(board, h.fromIndex)
      won = isWon(board)
      if (won) return { seed, kind: 'WON', step: steps, report: `seed ${seed}: won at step ${steps}` }
    } else if (action.type === 'draw') {
      board = applyDraw(board, DRAW_MODE)
    } else if (action.type === 'recycle') {
      board = applyRecycle(board)
      recycleCount += 1
    }

    steps += 1
  }

  // Ran to the step ceiling without terminating — that is itself the AI-LOOP
  // symptom (a livelock the production loop guard never breaks out of).
  return { seed, kind: 'AI-LOOP', step: steps, report: explainLoop(seed, steps, board) }
}

// ─── Explanations ──────────────────────────────────────────────────────────────

/**
 * Classifies how production sees each legal move the oracle found, exposing
 * the exact reason the modal fired while moves remained.
 */
function explainFalseDead(seed: string, step: number, board: Board): string {
  const lines: string[] = []
  lines.push(`SEED ${seed} — FALSE-DEAD-MODAL at step ${step}`)
  lines.push(`  board: ${summarise(board)}`)
  lines.push(`  production isDeadGame() => DEAD`)
  lines.push(`  oracle livenessOracle()  => ALIVE`)

  const legal = enumeratePlacements(board, true)
  lines.push(`  legal moves the oracle found (the modal ignored): ${legal.length}`)
  for (const p of legal) {
    const prodView = `production classifyMove=${classifyMove(board, p as unknown as Hint)}`
    lines.push(`    • ${nameMove(board, p)}  —  ${prodView}`)
  }

  const raw = computeHints(board)
  const useful = filterUsefulHints(raw, board.tableau, board.foundations, board.waste)
  lines.push(`  computeHints()=${raw.length} raw, filterUsefulHints()=${useful.length} useful`)
  lines.push(`  diagnosis: every legal move is a back-move or shuffle that classifyMove`)
  lines.push(`             rejects on the progress axis — but the ratified liveness rule`)
  lines.push(`             counts ANY legal move as ALIVE, so the modal must not fire.`)
  return lines.join('\n')
}

/**
 * AI idled while the oracle proves a genuinely PRODUCTIVE move was available —
 * a real bug: the production hint filter suppressed advancement the AI should
 * have taken.  Lists the productive moves the oracle found and how production
 * scored each, exposing the surviving progress-axis drift.
 */
function explainMissedProgress(seed: string, step: number, board: Board): string {
  const lines: string[] = []
  lines.push(`SEED ${seed} — AI-MISSED-PROGRESS at step ${step}`)
  lines.push(`  board: ${summarise(board)}`)
  lines.push(`  production getAIMove() => idle, but the oracle found a productive move`)

  const raw = computeHints(board)
  const useful = filterUsefulHints(raw, board.tableau, board.foundations, board.waste)
  lines.push(`  computeHints()=${raw.length} raw, filterUsefulHints()=${useful.length} useful`)

  const legal = enumeratePlacements(board, true)
  const productive = legal.filter(p => redundancyOracle(board, p) === 'productive')
  lines.push(`  oracle-productive moves the AI skipped: ${productive.length}`)
  for (const p of productive.slice(0, 12)) {
    const prodView = `production classifyMove=${classifyMove(board, p as unknown as Hint)}`
    lines.push(`    • ${nameMove(board, p)}  —  ${prodView}`)
  }
  lines.push(`  diagnosis: filterUsefulHints rejected an advancement the redundancy oracle`)
  lines.push(`             proves is productive — the surviving progress-axis drift between`)
  lines.push(`             the hint filter and the oracle.`)
  return lines.join('\n')
}

/**
 * AI idled, the board is alive (legal shuffles remain) but NO move advances the
 * game per the oracle — the AI stopped correctly.  This is NOT a bug; it is the
 * expected terminal for a board that is technically alive yet stuck for
 * progress.  Recorded only for completeness.
 */
function explainStuckClean(seed: string, step: number, board: Board): string {
  const lines: string[] = []
  lines.push(`SEED ${seed} — STUCK-CLEAN at step ${step}`)
  lines.push(`  board: ${summarise(board)}`)
  lines.push(`  production getAIMove() => idle; board is alive but no move is productive`)

  const raw = computeHints(board)
  const useful = filterUsefulHints(raw, board.tableau, board.foundations, board.waste)
  lines.push(`  computeHints()=${raw.length} raw, filterUsefulHints()=${useful.length} useful`)
  const legal = enumeratePlacements(board, true)
  lines.push(`  oracle legal moves (all redundant/unknown, none productive): ${legal.length}`)
  for (const p of legal.slice(0, 12)) {
    lines.push(`    • ${nameMove(board, p)}  —  redundancy=${redundancyOracle(board, p)}`)
  }
  lines.push(`  diagnosis: correct idle — the game is alive but the oracle confirms no`)
  lines.push(`             reachable move makes progress, so stopping is the right call.`)
  return lines.join('\n')
}

function explainLoop(seed: string, step: number, board: Board): string {
  const lines: string[] = []
  lines.push(`SEED ${seed} — AI-LOOP at step ${step}`)
  lines.push(`  board: ${summarise(board)}`)
  const raw = computeHints(board)
  const useful = filterUsefulHints(raw, board.tableau, board.foundations, board.waste)
  lines.push(`  filterUsefulHints()=${useful.length} useful move(s):`)
  for (const h of useful) {
    const p = h as Placement
    const verdict: Redundancy = redundancyOracle(board, p)
    lines.push(`    • ${nameMove(board, p)}  —  oracle redundancy=${verdict}`)
  }
  lines.push(`  diagnosis: the AI keeps replaying moves that return to a prior state; each may`)
  lines.push(`             pass the single-step redundancy check yet the sequence forms a cycle.`)
  return lines.join('\n')
}

// re-export a type alias used above for clarity
type Redundancy = ReturnType<typeof redundancyOracle>
export type { Liveness }
