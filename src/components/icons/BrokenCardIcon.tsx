interface BrokenCardIconProps {
  size?: number
  className?: string
}

/**
 * Inline SVG of a playing card outline with a lightning-bolt crack through
 * the centre — used in the "No Moves Left" dead-game modal.
 */
export function BrokenCardIcon({ size = 36, className }: BrokenCardIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Card outline */}
      <rect
        x="4"
        y="2"
        width="28"
        height="32"
        rx="3"
        ry="3"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.75"
      />
      {/* Lightning-bolt crack */}
      <polyline
        points="18,4 14,16 19,16 15,32"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
