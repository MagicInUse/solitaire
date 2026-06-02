/**
 * @module VisualsPanel
 * All cosmetic settings: card backs, theme, and animations.
 */

import { useRef } from 'react'
import { useOptionsStore } from '../../../store/useOptionsStore'
import { CARD_BACKS } from '../../../utils/cardBacks'
import { Switch } from '../../ui/Switch'
import vqLogo from '../../../assets/veriquery-logo.png'

export function VisualsPanel() {
  const { cardBackId, setCardBackId, colorScheme, setColorScheme, animationsEnabled, setAnimationsEnabled } = useOptionsStore()
  const darkClickTimestamps = useRef<number[]>([])

  const handleDarkClick = () => {
    const now = Date.now()
    darkClickTimestamps.current.push(now)
    // Prune clicks older than 2000ms
    darkClickTimestamps.current = darkClickTimestamps.current.filter(ts => now - ts < 2000)
    
    // If 5+ clicks within 2 seconds, unlock cosmic mode
    if (darkClickTimestamps.current.length >= 5) {
      darkClickTimestamps.current = []
      setColorScheme('cosmic')
    } else {
      setColorScheme('dark')
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Theme */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Theme
        </h3>
        <div className="flex gap-2">
          {([
            { id: 'standard' as const, label: 'Standard' },
            { id: 'dark' as const, label: 'Dark' },
          ] as const).map(({ id, label }) => {
            // For the Dark button, show as active if in dark OR cosmic mode
            const isActive = id === 'dark' 
              ? (colorScheme === 'dark' || colorScheme === 'cosmic')
              : colorScheme === id
            return (
              <button
                key={id}
                onClick={() => id === 'dark' ? handleDarkClick() : setColorScheme(id)}
                className={[
                  'flex-1 py-2.5 px-3 rounded-xl border text-[13px] font-semibold',
                  'transition-colors cursor-pointer',
                  isActive
                    ? 'border-white/30 bg-white/10 text-white/85'
                    : 'border-white/10 bg-white/4 text-white/50 hover:border-white/22',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Card backs */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Card Backs
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          {CARD_BACKS.map((back) => {
            const isActive = cardBackId === back.id
            return (
              <button
                key={back.id}
                onClick={() => setCardBackId(back.id)}
                className={[
                  'flex flex-col items-center gap-1.5 p-2 rounded-xl border',
                  'transition-colors cursor-pointer',
                  isActive
                    ? 'border-white/30 bg-white/10'
                    : 'border-white/10 bg-white/4 hover:border-white/22',
                ].join(' ')}
              >
                <div
                  className={`w-9.5 h-13.25 rounded-sm shadow border border-black/30 relative overflow-hidden flex items-center justify-center card-back-${back.id}`}
                >
                  <div className={`absolute inset-0.75 rounded-xs card-back-${back.id}-inner`} />
                  <div className={`absolute inset-0.75 rounded-xs border pointer-events-none z-2 card-back-${back.id}-border`} />
                  {back.showLogo ? (
                    <img src={vqLogo} className="w-3.5 h-auto opacity-90 relative z-3 pointer-events-none" alt="" draggable={false} />
                  ) : back.CenterIcon ? (
                    <back.CenterIcon size={12} fill="currentColor" strokeWidth={0} className="relative z-3 pointer-events-none opacity-38" />
                  ) : null}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-white/85' : 'text-white/40'}`}>
                  {back.label}
                </span>
              </button>
            )
          })}
          {/* Custom — coming soon */}
          <button disabled className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-white/8 bg-white/3 opacity-40 cursor-not-allowed">
            <div className="w-9.5 h-13.25 rounded-sm border border-dashed border-white/25 flex items-center justify-center">
              <span className="text-white/35 text-[22px] leading-none">+</span>
            </div>
            <span className="text-[10px] font-medium text-white/35">Custom</span>
            <span className="text-[9px] text-white/22 italic -mt-1">Coming soon</span>
          </button>
        </div>
      </section>

      {/* Animations */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          Animations
        </h3>
        <Switch
          checked={animationsEnabled}
          onChange={setAnimationsEnabled}
          label="Enable Animations"
        />
        <p className="text-white/30 text-[11px] leading-relaxed -mt-2">
          Disable for instant, snappier card transitions on slower devices.
        </p>
      </section>

    </div>
  )
}
