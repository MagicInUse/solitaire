/**
 * @module useStatsStore
 * Persisted Zustand store for lifetime player statistics and leaderboard data.
 *
 * Stored in `localStorage` under `"solitaire-stats"` (v1).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameStats, LeaderboardEntry } from '../types/stats'
import { INITIAL_STATS } from '../types/stats'

const MAX_LEADERBOARD_ENTRIES = 10
const LEADERBOARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/** Drop entries older than the rolling window and cap at the top N by score. */
function pruneLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const cutoff = Date.now() - LEADERBOARD_WINDOW_MS
  return entries
    .filter(e => new Date(e.date).getTime() >= cutoff)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES)
}

interface StatsStore extends GameStats {
  /** Call at the start of every new game (increments gamesPlayed). */
  recordGameStarted: () => void
  /**
   * Call when the player wins. Saves the entry, updates aggregate stats,
   * and keeps the leaderboard sorted by score (desc) within the cap.
   * Pass `skipLeaderboard: true` for casual mode wins (streak/bests still updated).
   */
  recordWin: (entry: Omit<LeaderboardEntry, 'id' | 'date'> & { skipLeaderboard?: boolean }) => void
  /** Call when a new game starts mid-game (resets the win streak). */
  recordLoss: () => void
  /** Wipes all stats and leaderboard entries. */
  clearStats: () => void
}

export const useStatsStore = create<StatsStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATS,

      recordGameStarted() {
        set((s) => ({ gamesPlayed: s.gamesPlayed + 1 }))
      },

      recordWin(entry) {
        set((s) => {
          const { skipLeaderboard, ...entryData } = entry
          const newStreak = s.currentStreak + 1

          const leaderboard = skipLeaderboard
            ? s.leaderboard
            : (() => {
                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
                const date = new Date().toISOString()
                const newEntry: LeaderboardEntry = { ...entryData, id, date }
                return pruneLeaderboard([...s.leaderboard, newEntry])
              })()

          return {
            gamesWon: s.gamesWon + 1,
            currentStreak: newStreak,
            bestStreak: Math.max(s.bestStreak, newStreak),
            bestTimeSeconds:
              s.bestTimeSeconds === null
                ? entry.timeSeconds
                : Math.min(s.bestTimeSeconds, entry.timeSeconds),
            bestScore:
              s.bestScore === null
                ? entry.score
                : Math.max(s.bestScore, entry.score),
            leaderboard,
          }
        })
      },

      recordLoss() {
        set({ currentStreak: 0 })
      },

      clearStats() {
        set(INITIAL_STATS)
      },
    }),
    {
      name: 'solitaire-stats',
      version: 1,
      // Prune stale entries whenever the store is loaded from localStorage.
      onRehydrateStorage: () => (state) => {
        if (state) state.leaderboard = pruneLeaderboard(state.leaderboard)
      },
    }
  )
)
