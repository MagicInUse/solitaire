/**
 * @module stats
 * Lifetime statistics and leaderboard data, persisted across sessions.
 */

/** A single completed-game record stored in the leaderboard. */
export interface LeaderboardEntry {
  /** Unique ID: `${Date.now()}-${random}` */
  id: string
  /** ISO date string of when the game was won. */
  date: string
  drawMode: 1 | 3
  scoringMode: 'standard' | 'vegas'
  timeSeconds: number
  moves: number
  score: number
  undosUsed: number
}

/** Aggregated lifetime statistics for the player. */
export interface GameStats {
  gamesPlayed: number
  gamesWon: number
  currentStreak: number
  bestStreak: number
  /** Fastest win time in seconds; null until first win. */
  bestTimeSeconds: number | null
  /** Highest score ever; null until first win. */
  bestScore: number | null
  /** Sorted by score desc; capped at 100 entries. */
  leaderboard: LeaderboardEntry[]
}

export const INITIAL_STATS: GameStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  bestStreak: 0,
  bestTimeSeconds: null,
  bestScore: null,
  leaderboard: [],
}
