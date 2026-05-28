/**
 * @module OptionsPanel
 * Sound effects toggle (stub), deck position, and data management.
 * Game rules (draw mode, recycles, undo limit) live in the Rules panel.
 */

import { useState } from 'react'
import { useOptionsStore }   from '../../../store/useOptionsStore'
import { useStatsStore }     from '../../../store/useStatsStore'
import { useInstallPrompt }  from '../../../hooks/useInstallPrompt'
import { Switch }  from '../../ui/Switch'
import { Button }  from '../../ui/Button'

export function OptionsPanel() {
  const { deckLocation, setDeckLocation, hintsEnabled, setHintsEnabled } = useOptionsStore()
  const clearStats = useStatsStore((s) => s.clearStats)
  const { canInstall, install } = useInstallPrompt()
  const [confirmClear, setConfirmClear] = useState(false)

  // Deck location schematic blocks
  const deckBlocks = (
    <div className="flex gap-0.75">
      <div className="w-4.5 h-6.5 rounded-[3px] bg-white/30" />
      <div className="w-4.5 h-6.5 rounded-[3px] bg-white/18" />
    </div>
  )
  const foundationBlocks = (
    <div className="flex gap-0.75">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="w-4.5 h-6.5 rounded-[3px] border border-white/20" />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* Install App — Chromium/Android/desktop only; hidden on iOS (no beforeinstallprompt) */}
      {canInstall && (
        <section className="flex flex-col gap-3">
          <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
            Install
          </h3>
          <Button variant="primary" size="sm" onClick={install}>
            Install App
          </Button>
          <p className="text-white/30 text-[11px] leading-relaxed -mt-2">
            Add Solitaire to your home screen for the full app experience — plays offline, no browser chrome.
          </p>
        </section>
      )}

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

      {/* Hints */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Hints
        </h3>
        <Switch
          checked={hintsEnabled}
          onChange={setHintsEnabled}
          label="Allow Hints"
        />
        <p className="text-white/30 text-[11px] leading-relaxed -mt-2">
          Show the Hint button during play. Disable for a more challenging experience.
        </p>
      </section>

      {/* Deck position */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Deck Position
        </h3>
        <p className="text-white/30 text-[11px] leading-relaxed -mt-1">
          Choose which side the stock and waste piles appear on.
        </p>
        <div className="flex flex-col gap-2">
          {(['left', 'right'] as const).map((loc) => {
            const isActive = deckLocation === loc
            return (
              <button
                key={loc}
                onClick={() => setDeckLocation(loc)}
                className={[
                  'w-full p-3.5 rounded-xl border text-left',
                  'transition-colors cursor-pointer',
                  isActive
                    ? 'bg-[#3da85e]/12 border-[#3da85e]/45'
                    : 'bg-white/4 border-white/10 hover:border-white/22',
                ].join(' ')}
              >
                <div className="flex items-center justify-between mb-2.5">
                  {loc === 'left' ? (
                    <>{deckBlocks}<div className="flex-1" />{foundationBlocks}</>
                  ) : (
                    <>{foundationBlocks}<div className="flex-1" />{deckBlocks}</>
                  )}
                </div>
                <div className={`text-[13px] font-semibold ${isActive ? 'text-[#6ee08a]' : 'text-white/50'}`}>
                  {loc === 'left' ? 'Left (default)' : 'Right'}
                </div>
              </button>
            )
          })}
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
