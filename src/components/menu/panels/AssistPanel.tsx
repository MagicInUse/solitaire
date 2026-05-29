/**
 * @module AssistPanel
 * Hints and AI4ME settings — enable/disable each feature and tune AI speed.
 */

import { useOptionsStore } from '../../../store/useOptionsStore'
import { Switch } from '../../ui/Switch'
import type { AISpeed } from '../../../types/options'

export function AssistPanel() {
  const { hintsEnabled, setHintsEnabled, showAI4ME, setShowAI4ME, aiSpeed, setAiSpeed } = useOptionsStore()

  return (
    <div className="flex flex-col gap-6">

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

      {/* AI4ME */}
      <section className="flex flex-col gap-3">
        <h3 className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
          AI4ME
        </h3>
        <Switch
          checked={showAI4ME}
          onChange={setShowAI4ME}
          label="Show AI4ME Button"
        />
        <p className="text-white/30 text-[11px] leading-relaxed -mt-2">
          Show the AI4ME auto-player button during play.
        </p>
        <div className="flex gap-2">
          {(['slow', 'normal', 'fast'] as AISpeed[]).map((speed) => (
            <button
              key={speed}
              onClick={() => setAiSpeed(speed)}
              className={[
                'flex-1 py-2 rounded-lg border text-[12px] font-medium capitalize transition-colors cursor-pointer',
                aiSpeed === speed
                  ? 'bg-[#9C528B]/20 border-[#9C528B]/45 text-[#e8b8de]'
                  : 'bg-white/4 border-white/10 text-white/50 hover:border-white/22',
              ].join(' ')}
            >
              {speed}
            </button>
          ))}
        </div>
        <p className="text-white/30 text-[11px] leading-relaxed -mt-2">
          How fast AI4ME moves. Slow and Normal flash each card before moving so you can follow along.
        </p>
      </section>
      {/* Notes */}
      <section className="flex flex-col gap-3">
        <p className="text-white/30 text-[11px] leading-relaxed -mt-2">
          Note: AI4ME is not actually AI. It simply executes the optimal move sequence calculated by the game engine, which may not always align with human intuition. It was used to help develop the Hints and Dead Game detection features!
        </p>
      </section>

    </div>
  )
}
