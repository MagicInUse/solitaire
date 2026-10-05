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
  const { deckLocation, setDeckLocation, interactionMode, setInteractionMode,
    selectAndPlaceEnabled, setSelectAndPlaceEnabled } = useOptionsStore()
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
                    ? 'bg-white/10 border-white/30'
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
                <div className={`text-[13px] font-semibold ${isActive ? 'text-white/85' : 'text-white/50'}`}>
                  {loc === 'left' ? 'Left (default)' : 'Right'}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Controls */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Controls
        </h3>
        <Switch checked={selectAndPlaceEnabled} onChange={setSelectAndPlaceEnabled} label="Select and Place" />
        <p className="text-white/70 text-[12px] leading-relaxed">
          Off by default. When on, tap a card or stack, then tap its destination.
          You choose every move. Tap the source again or empty felt to cancel. Dragging always works.
        </p>
        <p className="text-white/30 text-[11px] leading-relaxed -mt-1">
          With Select and Place off, choose your shortcut for sending top cards to foundations.
        </p>
        <div className="flex flex-col gap-2">
          {([
            { mode: 'single-tap', title: 'Single Tap (default)', desc: 'One tap sends an eligible top card to a foundation.' },
            { mode: 'double-tap', title: 'Double Tap',           desc: 'Double-tap or double-click sends an eligible top card to a foundation.' },
          ] as const).map(({ mode, title, desc }) => {
            const isActive = interactionMode === mode
            return (
              <button
                key={mode}
                aria-pressed={isActive}
                onClick={() => setInteractionMode(mode)}
                className={[
                  'w-full p-3.5 rounded-xl border text-left',
                  'transition-colors cursor-pointer',
                  isActive
                    ? 'bg-white/10 border-white/30'
                    : 'bg-white/4 border-white/10 hover:border-white/22',
                ].join(' ')}
              >
                <div className={`text-[13px] font-semibold ${isActive ? 'text-white/85' : 'text-white/50'}`}>
                  {title}
                </div>
                <div className="text-white/30 text-[11px] leading-relaxed mt-1">{desc}</div>
              </button>
            )
          })}
        </div>
        <p className="text-white/70 text-[12px] leading-relaxed">
          All card and stack interaction stays on the board. Keyboard board play is not supported.
        </p>
      </section>

      {/* Data management */}
      <section className="flex flex-col gap-3 pt-3 border-t border-white/8">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Stats &amp; Leaderboard
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
                Confirm Reset
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
            Reset Stats &amp; Leaderboard
          </Button>
        )}
      </section>
    </div>
  )
}
