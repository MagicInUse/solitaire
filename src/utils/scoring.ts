/**
 * @module scoring
 * Calculates the score for a Klondike game (live during play or final at win).
 *
 * Formula:
 *   base         = 1000
 *   movePenalty  = moves × 3          (efficient play rewarded)
 *   timePenalty  = floor(seconds / 10) (gentle time pressure)
 *   undoPenalty  = undosUsed × 20
 *   multiplier   = 1.5× for Draw-3, 1.0× for Draw-1
 *   score        = max(0, round((base − movePenalty − timePenalty − undoPenalty) × multiplier))
 *
 * Typical ranges:
 *   Draw-1 fast win  (~80 mv, 2 min, 0 undo) ≈ 724
 *   Draw-1 avg win   (~150 mv, 6 min, 5 undo) ≈ 414
 *   Draw-3 fast win  (~80 mv, 2 min, 0 undo) ≈ 1086
 */

export interface ScoreParams {
  drawMode: 1 | 3
  timeSeconds: number
  moves: number
  undosUsed: number
}

/** Calculates an integer score for a game in progress or at completion. */
export function calculateScore({ drawMode, timeSeconds, moves, undosUsed }: ScoreParams): number {
  const base        = 1000
  const movePenalty = moves * 3
  const timePenalty = Math.floor(timeSeconds / 10)
  const undoPenalty = undosUsed * 20
  const multiplier  = drawMode === 3 ? 1.5 : 1.0
  return Math.max(0, Math.round((base - movePenalty - timePenalty - undoPenalty) * multiplier))
}

/**
 * Calculates the Vegas score: -$52 entry fee, +$5 per card on foundations.
 * Range: -$52 (no cards placed) to +$208 (all 52 cards placed).
 */
export function calculateVegasScore(foundationCardCount: number): number {
  return foundationCardCount * 5 - 52
}

/** Formats a Vegas profit/loss as "+$N" or "-$N". */
export function formatVegasScore(profit: number): string {
  return profit >= 0 ? `+$${profit}` : `-$${Math.abs(profit)}`
}

/** Formats elapsed seconds as M:SS or MM:SS. */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
