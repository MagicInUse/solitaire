/**
 * Phase-3 drill-down: emits a detailed, human-readable explanation of the
 * decisive step for representative seeds flagged by the sim harness, naming the
 * exact legal moves the production dead-game / hint logic mishandles.
 *
 * This is an INVESTIGATION aid, not a pass/fail gate — its only hard contracts
 * are that the drill terminates and is deterministic.  The explanations are
 * printed so a developer can read precisely why each seed misbehaves.
 */

import { describe, it, expect } from 'vitest'
import { drillSeed } from './drill'

// Representative seeds, one per category, taken from the sim register output.
const SUBJECTS = [
  'sim-3', // FALSE-DEAD-MODAL
  'sim-2', // AI-IDLE-NOT-DEAD
  'sim-0', // AI-LOOP
]

describe('drill-down explanations for flagged seeds', () => {
  it('produces a deterministic, detailed report per subject seed', () => {
    const lines: string[] = ['']
    for (const seed of SUBJECTS) {
      const a = drillSeed(seed)
      const b = drillSeed(seed)
      // Determinism contract: same seed → same decisive verdict.
      expect(b.kind).toBe(a.kind)
      expect(b.step).toBe(a.step)
      lines.push('───────────────────────────────────────────────────────────────')
      lines.push(a.report)
    }
    lines.push('───────────────────────────────────────────────────────────────')
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))

    expect(SUBJECTS.length).toBeGreaterThan(0)
  })
})
