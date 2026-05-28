/**
 * @module VisualsPanel
 * All cosmetic settings: deck position, card backs, and animations.
 */

import { useOptionsStore } from '../../../store/useOptionsStore'
import { CARD_BACKS } from '../../../utils/cardBacks'
import { Switch } from '../../ui/Switch'
import vqLogo from '../../../assets/veriquery-logo.png'

export function VisualsPanel() {
  const {
    cardBackId, setCardBackId,
    animationsEnabled, setAnimationsEnabled,
  } = useOptionsStore()

  return (
    <div className="flex flex-col gap-6">

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
                    ? 'border-[#3da85e]/55 bg-[#3da85e]/10'
                    : 'border-white/10 bg-white/4 hover:border-white/22',
                ].join(' ')}
              >
                <div
                  className="w-[38px] h-[53px] rounded-[4px] shadow border border-black/30 relative overflow-hidden flex items-center justify-center"
                  style={back.outerStyle}
                >
                  <div className="absolute inset-[3px] rounded-[2px]" style={{ background: back.innerBg }} />
                  <div className="absolute inset-[3px] rounded-[2px] border pointer-events-none z-[2]" style={{ borderColor: back.innerBorder }} />
                  {back.showLogo ? (
                    <img src={vqLogo} className="w-[14px] h-auto opacity-90 relative z-[3] pointer-events-none" alt="" draggable={false} />
                  ) : back.centerIcon ? (
                    <span className="relative z-[3] text-[12px] select-none pointer-events-none" style={{ opacity: 0.38 }}>{back.centerIcon}</span>
                  ) : null}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-[#6ee08a]' : 'text-white/40'}`}>
                  {back.label}
                </span>
              </button>
            )
          })}
          {/* Custom — coming soon */}
          <button disabled className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-white/8 bg-white/3 opacity-40 cursor-not-allowed">
            <div className="w-[38px] h-[53px] rounded-[4px] border border-dashed border-white/25 flex items-center justify-center">
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
