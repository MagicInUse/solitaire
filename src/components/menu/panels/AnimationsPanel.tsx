/**
 * @module AnimationsPanel
 * Toggle for the global animations setting (card flip, deal, win cascade).
 * Disabling produces instant state transitions — useful on low-end devices.
 */

import { useOptionsStore } from '../../../store/useOptionsStore'
import { Switch } from '../../ui/Switch'

export function AnimationsPanel() {
  const { animationsEnabled, setAnimationsEnabled } = useOptionsStore()

  return (
    <div className="flex flex-col gap-5">
      <p className="text-white/40 text-[12px] leading-relaxed">
        Enable smooth animations for card flips, the deal sequence, and
        the win celebration. Disable for a snappier, instant feel.
      </p>

      <Switch
        checked={animationsEnabled}
        onChange={setAnimationsEnabled}
        label="Enable Animations"
      />
    </div>
  )
}
