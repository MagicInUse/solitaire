/**
 * @module DeckLocationPanel
 * Visual toggle for choosing which side of the board the stock + waste
 * piles appear on. Changes take effect immediately in real time.
 */

import { useOptionsStore } from '../../../store/useOptionsStore'

export function DeckLocationPanel() {
  const { deckLocation, setDeckLocation } = useOptionsStore()

  return (
    <div className="flex flex-col gap-4">
      <p className="text-white/40 text-[12px] leading-relaxed">
        Choose which side the stock and waste piles appear on. Foundations
        move to the opposite side.
      </p>

      <div className="flex flex-col gap-2">
        {(['left', 'right'] as const).map((loc) => {
          const isActive = deckLocation === loc

          // Schematic: stock (bright) + waste (dim). Right mode mirrors via flex-row-reverse.
          const deck = (
            <div className={`flex gap-[3px]${loc === 'right' ? ' flex-row-reverse' : ''}`}>
              <div className="w-[18px] h-[26px] rounded-[3px] bg-white/30" />
              <div className="w-[18px] h-[26px] rounded-[3px] bg-white/18" />
            </div>
          )
          const foundations = (
            <div className="flex gap-[3px]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-[18px] h-[26px] rounded-[3px] border border-white/20" />
              ))}
            </div>
          )

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
              {/* Visual schematic */}
              <div className="flex items-center justify-between mb-2.5">
                {loc === 'left' ? (
                  <>
                    {deck}
                    <div className="flex-1" />
                    {foundations}
                  </>
                ) : (
                  <>
                    {foundations}
                    <div className="flex-1" />
                    {deck}
                  </>
                )}
              </div>

              <div
                className={`text-[13px] font-semibold ${
                  isActive ? 'text-[#6ee08a]' : 'text-white/50'
                }`}
              >
                {loc === 'left' ? 'Left (default)' : 'Right'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
