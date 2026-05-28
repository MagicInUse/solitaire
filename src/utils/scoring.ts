/**
 * @module scoring
 * Calculates the final score for a completed Klondike game.
 *
 * Formula:
 *   base        = 100
 *   timeBonus   = 0–50  (full at 0 s, 0 at 10 min)
 *   undoPenalty = undosUsed × 15
 *   multiplier  = 1.5× for Draw-3, 1.0× for Draw-1
 *   score       = max(0, round((base + timeBonus − undoPenalty) × multiplier))
 */

export interface ScoreParams {
  drawMode: 1 | 3
  timeSeconds: number
  moves: number
  undosUsed: number
}

/** Calculates an integer score for a completed game. */
export function calculateScore({ drawMode, timeSeconds, undosUsed }: ScoreParams): number {
  const base = 100
  // 50 points at 0 s, linearly 0 at 600 s (10 minutes)
  const timeBonus = Math.max(0, Math.round(50 * Math.max(0, 1 - timeSeconds / 600)))
  const undoPenalty = undosUsed * 15
  const multiplier = drawMode === 3 ? 1.5 : 1.0
  return Math.max(0, Math.round((base + timeBonus - undoPenalty) * multiplier))
}

/** Formats elapsed seconds as M:SS or MM:SS. */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
