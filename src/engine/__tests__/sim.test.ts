/**
 * @file sim.test.ts
 * Simulation harness — the diagnostic engine of the reveal effort.
 *
 * Drives the PRODUCTION AI (utils/aiPlayer.getAIMove) to a terminal state
 * across many seeded deals, faithfully replaying the live store's move loop
 * (useAIPlayer), and at every step cross-examines production against the
 * INDEPENDENT oracle (engine/solver) along the three ratified axes.
 *
 * Philosophy:
 *  - COLLECT, don't fail-fast.  Each seed runs to completion; every axis
 *    disagreement is recorded with its reproducing seed, then aggregated into
 *    a categorised register printed at the end.  This is a *reveal* effort —
 *    the harness must not turn red on the very bugs it exists to surface.
 *  - The ONLY hard assertions are contracts that must hold regardless of the
 *    known bugs: determinism (same seed → same trace) and that the harness
 *    itself terminates.  Everything else is logged.
 *  - The oracle's `unknown` (budget-exhausted) verdicts NEVER produce an
 *    accusation — no false positives from a truncated search.
 *
 * Scale:
 *  - Default: a small batch (fast, runs in CI on every `pnpm test`).
 *  - Sweep:   set `SEED_COUNT=50000` (or any N) to run a large sweep; the
 *    extended timeout below accommodates it.  Set `WRITE_FIXTURES=1` to dump
 *    the failing-seed register to fixtures/sim-register.json for regressions.
 */

import { describe, it, expect } from 'vitest'
import { dealKlondike } from '../deck'
import { applyDraw, applyRecycle, applyMove, applyFlip, type Board } from '../gameActions'
import { getAIMove } from '../../utils/aiPlayer'
import type { PlanAction } from '../../engine/planner'
import { isDeadGame } from '../deadGame'
import {
  enumeratePlacements,
  redundancyOracle,
  livenessOracle,
  type Placement,
  type Liveness,
} from '../solver'

// ─── Tunables ──────────────────────────────────────────────────────────────────

const DEFAULT_SEED_COUNT = 40
const SEED_COUNT = Number(process.env.SEED_COUNT) || DEFAULT_SEED_COUNT
const SWEEP = SEED_COUNT > DEFAULT_SEED_COUNT
/** Production defaults (types/options.DEFAULT_OPTIONS). */
const DRAW_MODE: 1 | 3 = 1
const STOCK_RECYCLES: number | 'unlimited' = 'unlimited'
/**
 * Step ceiling per game; exceeding it is itself a finding (AI-LOOP).  A full
 * draw-1 clear walks through the stock many times and threads reversible
 * endgame shuffles, so a legitimate win can run several thousand micro-steps;
 * the ceiling is pure runaway protection now that the decision-point loop guard
 * catches true cycles.
 */
const MAX_STEPS = 8000
/** Repeats of an identical (board + recycleCount) state that we call a loop. */
const LOOP_THRESHOLD = 3
/** Recycle budget handed to the bounded oracles when recycles are unlimited. */
const ORACLE_RECYCLE_CAP = 2

// ─── Finding model ─────────────────────────────────────────────────────────────

type FindingKind =
  | 'ILLEGAL-MOVE' // AI played a move the rulebook does not permit
  | 'AI-LOOP' // board state revisited beyond threshold / step ceiling hit
  | 'REDUNDANT-HINT' // AI played a move the oracle deems a pure shuffle
  | 'FALSE-DEAD-MODAL' // isDeadGame===true but oracle says the game is alive
  | 'MISSED-DEAD' // isDeadGame===false but oracle says the game is dead
  | 'AI-MISSED-PROGRESS' // AI idled while the oracle proves a productive move remained

interface Finding {
  kind: FindingKind
  seed: string
  step: number
  detail: string
}

interface SeedResult {
  seed: string
  steps: number
  won: boolean
  terminal: 'won' | 'idle' | 'loop' | 'cap'
  /** Compact signature of the playthrough, for the determinism contract. */
  traceSig: string
  findings: Finding[]
}

// ─── Board helpers (independent of production) ─────────────────────────────────

function boardFromSeed(seed: string): Board {
  const { stock, waste, foundations, tableau } = dealKlondike({ seed })
  return { stock, waste, foundations, tableau }
}

function isWon(b: Board): boolean {
  return b.foundations.every((f) => f.length === 13)
}

function boardKey(b: Board): string {
  const pile = (p: Board['waste']) => p.map((c) => `${c.suit[0]}${c.rank}${c.faceUp ? 'u' : 'd'}`).join(',')
  return [
    b.stock.map((c) => `${c.suit[0]}${c.rank}`).join(','),
    pile(b.waste),
    b.foundations.map(pile).join('#'),
    b.tableau.map(pile).join('|'),
  ].join('/')
}

function placementKey(p: Placement): string {
  return `${p.fromType}:${p.fromIndex ?? ''}:${p.cardIndex}:${p.toType}:${p.toIndex}`
}

// ─── The driver ────────────────────────────────────────────────────────────────

/**
 * Plays one seed to terminal with the production AI, cross-examining each step
 * against the oracle.  Mirrors useAIPlayer's loop exactly: the winning plan is
 * threaded through getAIMove the same way, and a tableau-source move is
 * followed by the intrinsic flip.
 */
function driveSeed(seed: string): SeedResult {
  let board = boardFromSeed(seed)
  let recycleCount = 0
  let won = false
  let steps = 0
  let plan: PlanAction[] = []
  let terminal: SeedResult['terminal'] = 'idle'
  const findings: Finding[] = []
  const traceParts: string[] = []

  const recordedKinds = new Set<string>() // dedupe FALSE-DEAD/MISSED-DEAD/IDLE per seed
  const livenessCache = new Map<string, Liveness>()
  const stateCounts = new Map<string, number>()

  const recyclesRemainingProd = () =>
    STOCK_RECYCLES === 'unlimited' ? Infinity : Math.max(0, STOCK_RECYCLES - recycleCount)
  const recyclesForOracle = () =>
    STOCK_RECYCLES === 'unlimited' ? ORACLE_RECYCLE_CAP : Math.max(0, STOCK_RECYCLES - recycleCount)

  // Compares production isDeadGame against the liveness oracle on a stock-empty
  // board. Records FALSE-DEAD-MODAL / MISSED-DEAD once per seed. `unknown`
  // oracle verdicts are skipped (never a false accusation).
  const checkLiveness = (b: Board): void => {
    if (b.stock.length > 0) return // isDeadGame fast-returns false; nothing to compare
    const key = boardKey(b)
    let verdict = livenessCache.get(key)
    if (verdict === undefined) {
      verdict = livenessOracle(b, recyclesForOracle(), DRAW_MODE)
      livenessCache.set(key, verdict)
    }
    if (verdict === 'unknown') return

    const prodDead = isDeadGame({
      stock: b.stock,
      waste: b.waste,
      foundations: b.foundations,
      tableau: b.tableau,
      recyclesRemaining: recyclesRemainingProd(),
      drawMode: DRAW_MODE,
    })

    if (prodDead && verdict === 'alive' && !recordedKinds.has('FALSE-DEAD-MODAL')) {
      recordedKinds.add('FALSE-DEAD-MODAL')
      findings.push({ kind: 'FALSE-DEAD-MODAL', seed, step: steps, detail: 'isDeadGame=true, oracle=alive' })
    }
    if (!prodDead && verdict === 'dead' && !recordedKinds.has('MISSED-DEAD')) {
      recordedKinds.add('MISSED-DEAD')
      findings.push({ kind: 'MISSED-DEAD', seed, step: steps, detail: 'isDeadGame=false, oracle=dead' })
    }
  }

  while (steps < MAX_STEPS) {
    // Cross-examine the dead-game detector on the current board.
    checkLiveness(board)

    // Loop detection on the full (board + recycleCount) state — sampled ONLY at
    // decision points (no plan in flight).  A committed plan reaches its next
    // gain through reversible King/stack shuffles, so board states legitimately
    // recur within a plan; counting those would falsely flag a livelock.
    // Decision-point states strictly improve the monotone metric on every
    // commit, so a genuine repeat there is a real cycle.
    if (plan.length === 0) {
      const stateKey = `${boardKey(board)}~${recycleCount}`
      const seen = (stateCounts.get(stateKey) ?? 0) + 1
      stateCounts.set(stateKey, seen)
      if (seen > LOOP_THRESHOLD) {
        findings.push({ kind: 'AI-LOOP', seed, step: steps, detail: 'state revisited' })
        terminal = 'loop'
        break
      }
    }

    // Record this state for loop avoidance, then let the AI skip any move that
    // would return to a visited position (mirrors useAIPlayer).
    const decision = getAIMove({
      stock: board.stock,
      waste: board.waste,
      foundations: board.foundations,
      tableau: board.tableau,
      recycleCount,
      stockRecycles: STOCK_RECYCLES,
      won,
      drawMode: DRAW_MODE,
      plan,
    })
    const action = decision.action
    plan = decision.plan

    if (action.type === 'idle') {
      terminal = 'idle'
      // AI gave up. Under the ratified 3-axis model this is only a finding when
      // the independent oracle proves a genuinely PRODUCTIVE move still existed
      // (AI-MISSED-PROGRESS). An alive-but-stuck board with no productive move
      // is a clean stop (STUCK-CLEAN) — not an accusation.
      if (!isWon(board)) {
        const productive = enumeratePlacements(board, true).some(
          (p) => redundancyOracle(board, p) === 'productive',
        )
        if (productive) {
          findings.push({
            kind: 'AI-MISSED-PROGRESS',
            seed,
            step: steps,
            detail: 'AI idle but a productive move exists',
          })
        }
      }
      break
    }

    if (action.type === 'move') {
      const h = action.hint
      const placement: Placement = {
        fromType: h.fromType,
        fromIndex: h.fromIndex,
        cardIndex: h.cardIndex,
        toType: h.toType,
        toIndex: h.toIndex,
      }
      traceParts.push(`m${placementKey(placement)}`)

      // AXIS-rulebook: every AI move must be legal.
      const legal = enumeratePlacements(board, true).some((p) => placementKey(p) === placementKey(placement))
      if (!legal) {
        findings.push({ kind: 'ILLEGAL-MOVE', seed, step: steps, detail: placementKey(placement) })
      }

      // AXIS 3: did the AI play a pure shuffle?
      const verdict = redundancyOracle(board, placement)
      if (verdict === 'redundant') {
        findings.push({ kind: 'REDUNDANT-HINT', seed, step: steps, detail: placementKey(placement) })
      }

      board = applyMove(board, placement)
      if (h.fromType === 'tableau' && h.fromIndex !== undefined) {
        board = applyFlip(board, h.fromIndex)
      }
      won = isWon(board)
      if (won) {
        terminal = 'won'
        break
      }
    } else if (action.type === 'draw') {
      traceParts.push('d')
      board = applyDraw(board, DRAW_MODE)
    } else if (action.type === 'recycle') {
      traceParts.push('r')
      board = applyRecycle(board)
      recycleCount += 1
    }

    steps += 1
  }

  if (steps >= MAX_STEPS && terminal !== 'won') {
    findings.push({ kind: 'AI-LOOP', seed, step: steps, detail: 'step ceiling hit' })
    terminal = 'cap'
  }

  return {
    seed,
    steps,
    won,
    terminal,
    traceSig: `${terminal}:${steps}:${traceParts.length}:${boardKey(board)}`,
    findings,
  }
}

// ─── Register aggregation ──────────────────────────────────────────────────────

const SEVERITY: Record<FindingKind, number> = {
  'ILLEGAL-MOVE': 0, // rulebook violation — the worst
  'MISSED-DEAD': 1, // game is dead, production lets the player spin
  'FALSE-DEAD-MODAL': 2, // modal pops while the game is alive
  'AI-MISSED-PROGRESS': 3, // AI idled while a productive move remained (progress-axis drift)
  'REDUNDANT-HINT': 4, // AI plays a pointless shuffle
  'AI-LOOP': 5, // AI cycles
}

function buildRegister(results: SeedResult[]) {
  const byKind = new Map<FindingKind, string[]>()
  for (const r of results) {
    for (const f of r.findings) {
      const list = byKind.get(f.kind) ?? []
      if (!list.includes(f.seed)) list.push(f.seed)
      byKind.set(f.kind, list)
    }
  }
  const entries = [...byKind.entries()].sort((a, b) => SEVERITY[a[0]] - SEVERITY[b[0]])
  return { entries, byKind }
}

// ─── The test ──────────────────────────────────────────────────────────────────

describe('AI simulation harness (issue reveal)', () => {
  it(
    `cross-examines production against the oracle across ${SEED_COUNT} seeds`,
    () => {
      const results: SeedResult[] = []
      for (let i = 0; i < SEED_COUNT; i++) {
        results.push(driveSeed(`sim-${i}`))
      }

      const { entries } = buildRegister(results)

      // ── Categorised issue register (the deliverable of this effort) ──────────
      const lines: string[] = []
      lines.push('')
      lines.push('═══════════════════════════════════════════════════════════════')
      lines.push(`  AI SIM ISSUE REGISTER — ${SEED_COUNT} seeds, draw-${DRAW_MODE}, recycles=${STOCK_RECYCLES}`)
      lines.push('═══════════════════════════════════════════════════════════════')
      const wins = results.filter((r) => r.won).length
      lines.push(`  outcomes: ${wins} won, ${results.length - wins} not won`)
      if (entries.length === 0) {
        lines.push('  ✓ no axis disagreements found')
      } else {
        for (const [kind, seeds] of entries) {
          const sample = seeds.slice(0, 8).join(', ')
          const more = seeds.length > 8 ? ` …(+${seeds.length - 8})` : ''
          lines.push(`  [sev ${SEVERITY[kind]}] ${kind}: ${seeds.length} seed(s) → ${sample}${more}`)
        }
      }
      lines.push('═══════════════════════════════════════════════════════════════')
      // eslint-disable-next-line no-console
      console.log(lines.join('\n'))

      // ── Optional fixture dump for regression seeds (sweep / opt-in only) ─────
      if (process.env.WRITE_FIXTURES) {
        const register = Object.fromEntries(entries.map(([k, s]) => [k, s]))
        void writeFixture({ seedCount: SEED_COUNT, drawMode: DRAW_MODE, register })
      }

      // ── Hard contract #1: determinism (same seed → identical trace) ─────────
      for (let i = 0; i < Math.min(5, SEED_COUNT); i++) {
        const a = driveSeed(`sim-${i}`)
        const b = driveSeed(`sim-${i}`)
        expect(a.traceSig).toBe(b.traceSig)
      }

      // ── Hard contract #2: the harness itself terminated for every seed ──────
      expect(results).toHaveLength(SEED_COUNT)
    },
    // The shortest-path (BFS) planner explores broadly, so the default batch
    // runs a few minutes; the sweep gets the usual generous ceiling.
    SWEEP ? 30 * 60 * 1000 : 5 * 60 * 1000,
  )
})

/** Best-effort fixture writer; never throws into the test. */
async function writeFixture(data: unknown): Promise<void> {
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dir = path.resolve(__dirname, 'fixtures')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'sim-register.json'), JSON.stringify(data, null, 2))
  } catch {
    // ignore — fixture dumping is a developer convenience, not a test contract
  }
}
