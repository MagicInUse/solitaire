/**
 * @module OptionsPanel
 * Miscellaneous game options: stock recycles limit and data management.
 * Sound effects toggle is present but disabled (coming soon).
 */

import { useState } from 'react'
import { useOptionsStore } from '../../../store/useOptionsStore'
import { useStatsStore }   from '../../../store/useStatsStore'
import { Switch }  from '../../ui/Switch'
import { Button }  from '../../ui/Button'

const RECYCLE_OPTIONS: (number | 'unlimited')[] = ['unlimited', 3, 2, 1]

export function OptionsPanel() {
  const { stockRecycles, setStockRecycles } = useOptionsStore()

  const clearStats = useStatsStore((s) => s.clearStats)
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <div className="flex flex-col gap-6">

      {/* Sound effects (stub) */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Sound
        </h3>
        <Switch
          checked={false}
          onChange={() => {}}
          label="Sound Effects"
          disabled
          disabledNote="Coming soon!"
        />
      </section>

      {/* Stock recycles */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Stock Recycles
        </h3>
        <p className="text-white/30 text-[11px] leading-relaxed -mt-1">
          Maximum number of times the waste pile can be cycled back to stock
          per game. ∞ = no limit.
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

      {/* Data management */}
      <section className="flex flex-col gap-3 pt-3 border-t border-white/8">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Data
        </h3>

        {confirmClear ? (
          <div className="flex flex-col gap-2">
            <p className="text-red-300/70 text-[12px] leading-relaxed">
              This will permanently delete all stats and leaderboard entries.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => { clearStats(); setConfirmClear(false) }}
              >
                Confirm Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmClear(true)}
          >
            Clear All Stats
          </Button>
        )}
      </section>
    </div>
  )
}
