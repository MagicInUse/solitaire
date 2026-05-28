/**
 * @module Button
 * Consistent button component used throughout the menu and overlays.
 *
 * Variants:
 * - `primary`  — green fill; affirmative actions (Start New Game, Confirm)
 * - `ghost`    — semi-transparent dark; secondary / cancel actions
 * - `danger`   — dark red; destructive actions (Clear Stats, Abandon Game)
 */

import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const SIZES = {
  sm: 'px-[14px] py-[7px] text-[12px]',
  md: 'px-[22px] py-[10px] text-[13px]',
}

const VARIANTS = {
  primary: 'bg-[#3da85e] hover:bg-[#46c06c] active:bg-[#329e54] text-white',
  ghost:   'bg-black/35 hover:bg-black/52 active:bg-black/65 text-white/85',
  danger:  'bg-red-950/60 hover:bg-red-900/70 active:bg-red-900/90 text-red-300',
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'rounded-md font-semibold tracking-[0.04em]',
        'transition-colors duration-150 cursor-pointer border-0',
        'outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        SIZES[size],
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
