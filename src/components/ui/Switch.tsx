/**
 * @module Switch
 * Accessible toggle switch component.
 *
 * When `disabled` is true the track is dimmed, the thumb does not move,
 * and an optional `disabledNote` renders below the label (e.g. "Coming soon!").
 */

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
  /** Short explanatory note shown under the label when disabled. */
  disabledNote?: string
}

export function Switch({ checked, onChange, label, disabled, disabledNote }: SwitchProps) {
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
          'relative shrink-0 w-[42px] h-[24px] rounded-full',
          'outline-none focus-visible:ring-2 focus-visible:ring-white/40',
          'transition-colors duration-200',
          disabled
            ? 'opacity-35 cursor-not-allowed'
            : 'cursor-pointer',
          checked && !disabled ? 'bg-[#3da85e]' : 'bg-white/20',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-[4px] left-[4px] w-[16px] h-[16px] rounded-full bg-white shadow-sm',
            'transition-transform duration-200',
          ].join(' ')}
          style={{ transform: `translateX(${checked ? 18 : 0}px)` }}
        />
      </button>
    </div>
  )
}
