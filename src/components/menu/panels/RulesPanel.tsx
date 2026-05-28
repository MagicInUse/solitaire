/**
 * @module RulesPanel
 * All game-rule settings in one place: scoring mode, draw mode, stock recycles, undo limit.
 */

import { useOptionsStore } from '../../../store/useOptionsStore'
import type { ScoringMode } from '../../../types/options'

const RECYCLE_OPTIONS: (number | 'unlimited')[] = ['unlimited', 3, 2, 1]
const UNDO_LIMIT_OPTIONS: (number | 'unlimited')[] = ['unlimited', 3, 1, 0]

const SCORING_MODES: { id: ScoringMode; label: string; desc: string }[] = [
  { id: 'standard', label: 'Standard', desc: 'Formula score + timer. Recorded to leaderboard.' },
  { id: 'vegas',    label: 'Vegas',    desc: '$5 per foundation card − $52 entry. Leaderboard shows profit.' },
  { id: 'casual',   label: 'Casual',   desc: 'No score or timer. Wins counted but not ranked.' },
]

export function RulesPanel() {
  const {
    drawMode, setDrawMode,
    stockRecycles, setStockRecycles,
    undoLimit, setUndoLimit,
    scoringMode, setScoringMode,
  } = useOptionsStore()

  return (
    <div className="flex flex-col gap-6">

      {/* Scoring mode */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Scoring Mode
        </h3>
        <div className="flex flex-col gap-2">
          {SCORING_MODES.map((m) => {
            const isActive = scoringMode === m.id
            return (
              <button
                key={m.id}
                onClick={() => setScoringMode(m.id)}
                className={[
                  'w-full px-3.5 py-2.5 rounded-xl border text-left',
                  'transition-colors cursor-pointer',
                  isActive
                    ? 'bg-[#3da85e]/12 border-[#3da85e]/45'
                    : 'bg-white/4 border-white/10 hover:border-white/22',
                ].join(' ')}
              >
                <div className={`text-[13px] font-semibold mb-0.5 ${isActive ? 'text-[#6ee08a]' : 'text-white/65'}`}>
                  {m.label}
                </div>
                <div className="text-white/30 text-[11px] leading-snug">{m.desc}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Draw mode */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Draw Mode
        </h3>
        <div className="flex gap-2">
          {([1, 3] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDrawMode(mode)}
              className={[
                'flex-1 py-2.5 rounded-xl text-[13px] font-semibold',
                'border transition-colors cursor-pointer',
                drawMode === mode
                  ? 'bg-[#3da85e]/15 border-[#3da85e]/55 text-[#6ee08a]'
                  : 'bg-white/5 border-white/12 text-white/45 hover:border-white/28 hover:text-white/65',
              ].join(' ')}
            >
              Draw {mode}
            </button>
          ))}
        </div>
        <p className="text-white/30 text-[11px] leading-relaxed -mt-1">
          {drawMode === 1
            ? 'Turn one card at a time from the stock.'
            : 'Turn three cards at a time — only the top is playable.'}
        </p>
      </section>

      {/* Stock recycles */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Stock Recycles
        </h3>
        <p className="text-white/30 text-[11px] leading-relaxed -mt-1">
          How many times the waste pile can be cycled back into the stock. ∞ = no limit.
        </p>
        <div className="flex gap-2">
          {RECYCLE_OPTIONS.map((v) => (
            <button
              key={String(v)}
              onClick={() => setStockRecycles(v)}
              className={[
                'flex-1 py-2 rounded-xl text-[13px] font-semibold',
                'border transition-colors cursor-pointer',
                stockRecycles === v
                  ? 'bg-[#3da85e]/15 border-[#3da85e]/55 text-[#6ee08a]'
                  : 'bg-white/5 border-white/12 text-white/45 hover:border-white/28 hover:text-white/65',
              ].join(' ')}
            >
              {v === 'unlimited' ? '∞' : v}
            </button>
          ))}
        </div>
      </section>

      {/* Undo limit */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Undo Limit
        </h3>
        <p className="text-white/30 text-[11px] leading-relaxed -mt-1">
          Maximum undos allowed per game. ∞ = no limit. Off = undo disabled.
        </p>
        <div className="flex gap-2">
          {UNDO_LIMIT_OPTIONS.map((v) => (
            <button
              key={String(v)}
              onClick={() => setUndoLimit(v)}
              className={[
                'flex-1 py-2 rounded-xl text-[13px] font-semibold',
                'border transition-colors cursor-pointer',
                undoLimit === v
                  ? 'bg-[#3da85e]/15 border-[#3da85e]/55 text-[#6ee08a]'
                  : 'bg-white/5 border-white/12 text-white/45 hover:border-white/28 hover:text-white/65',
              ].join(' ')}
            >
              {v === 'unlimited' ? '∞' : v === 0 ? 'Off' : v}
            </button>
          ))}
        </div>
      </section>

    </div>
  )
}
