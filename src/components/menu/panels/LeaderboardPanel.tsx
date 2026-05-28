/**
 * @module LeaderboardPanel
 * Displays lifetime win statistics and a top-10 leaderboard table.
 */

import { useStatsStore } from '../../../store/useStatsStore'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LeaderboardPanel() {
  const stats = useStatsStore()
  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0

  return (
    <div className="flex flex-col gap-4">

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Played',  value: stats.gamesPlayed },
          { label: 'Won',     value: stats.gamesWon },
          { label: 'Win %',   value: `${winRate}%` },
        ].map((item) => (
          <div key={item.label} className="bg-white/6 rounded-xl p-2.5 text-center">
            <div className="text-white/90 text-[20px] font-bold leading-none mb-1">
              {item.value}
            </div>
            <div className="text-white/35 text-[10px] uppercase tracking-wider">
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Streak + bests */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/6 rounded-xl p-2.5 text-center">
          <div className="text-[#6ee08a] text-[18px] font-bold leading-none mb-1">
            {stats.currentStreak}
          </div>
          <div className="text-white/35 text-[10px] uppercase tracking-wider">
            Streak
          </div>
          <div className="text-white/20 text-[9px] mt-0.5">
            Best: {stats.bestStreak}
          </div>
        </div>

        {stats.bestTimeSeconds !== null ? (
          <div className="bg-white/6 rounded-xl p-2.5 text-center">
            <div className="text-[#6ee08a] text-[18px] font-bold leading-none mb-1">
              {formatTime(stats.bestTimeSeconds)}
            </div>
            <div className="text-white/35 text-[10px] uppercase tracking-wider">
              Best Time
            </div>
          </div>
        ) : (
          <div className="bg-white/6 rounded-xl p-2.5 text-center flex items-center justify-center">
            <span className="text-white/20 text-[11px]">No wins yet</span>
          </div>
        )}
      </div>

      {/* Leaderboard table */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
            This Week
          </h3>
          <span className="text-white/20 text-[9px]">resets weekly · top 10</span>
        </div>

        {stats.leaderboard.length === 0 ? (
          <p className="text-white/25 text-[12px] text-center py-5">
            Win a game this week to see it here!
          </p>
        ) : (
          <div className="flex flex-col gap-px">
            {/* Header */}
            <div className="grid grid-cols-4 text-white/30 text-[10px] font-semibold uppercase tracking-wider px-2 pb-1.5 border-b border-white/8">
              <span>#</span>
              <span className="text-right">Score</span>
              <span className="text-right">Time</span>
              <span className="text-right">Moves</span>
            </div>

            {/* Rows — top 10 */}
            {stats.leaderboard.slice(0, 10).map((entry, i) => (
              <div
                key={entry.id}
                className="grid grid-cols-4 text-[12px] px-2 py-[7px] rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className="text-white/30">{i + 1}</span>
                <span className="text-right text-[#6ee08a] font-semibold">
                  {entry.scoringMode === 'vegas' ? `$${entry.score}` : entry.score}
                </span>
                <span className="text-right text-white/65">
                  {formatTime(entry.timeSeconds)}
                </span>
                <span className="text-right text-white/45">
                  {entry.moves}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
