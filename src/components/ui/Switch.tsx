/**
 * @module Switch
 * Accessible toggle switch component.
 *
 * When `disabled` is true the track is dimmed, the thumb does not move,
 * and an optional `disabledNote` renders below the label (e.g. "Coming soon!").
 */

import { useAnimations } from '../../hooks/useAnimations'

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
  /** Short explanatory note shown under the label when disabled. */
  disabledNote?: string
}

export function Switch({ checked, onChange, label, disabled, disabledNote }: SwitchProps) {
  const animationsEnabled = useAnimations()
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={`text-[13px] font-medium leading-snug ${
            disabled ? 'text-white/30' : 'text-white/80'
          }`}
        >
          {label}
        </span>
        {disabled && disabledNote && (
          <span className="text-[11px] text-white/25 italic">{disabledNote}</span>
        )}
      </div>

      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          'relative shrink-0 w-10.5 h-6 rounded-full',
          'outline-none focus-visible:ring-2 focus-visible:ring-white/40',
          animationsEnabled ? 'transition-colors duration-200' : 'transition-none',
          disabled
            ? 'opacity-35 cursor-not-allowed'
            : 'cursor-pointer',
          checked && !disabled ? 'bg-[#3da85e]' : 'bg-white/20',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm',
            animationsEnabled ? 'transition-transform duration-200' : 'transition-none',
            checked ? 'translate-x-4.5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
