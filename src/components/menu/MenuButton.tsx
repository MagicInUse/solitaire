/**
 * @module MenuButton
 * Hamburger icon button — fixed to the bottom-left of the viewport,
 * replacing the old "New Game" button. Opens the main menu modal.
 */

interface MenuButtonProps {
  onClick: () => void
}

export function MenuButton({ onClick }: MenuButtonProps) {
  return (
    <button
      aria-label="Open menu"
      onClick={onClick}
      className="fixed menu-button-safe-pos z-10 w-11 h-11 rounded-md bg-black/38 hover:bg-black/56 active:bg-black/68 text-white/85 transition-colors cursor-pointer border-0 flex items-center justify-center"
    >
      {/* Hamburger icon */}
      <svg
        width="18"
        height="13"
        viewBox="0 0 18 13"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="0" y="0"  width="18" height="2" rx="1" fill="currentColor" />
        <rect x="0" y="5.5" width="18" height="2" rx="1" fill="currentColor" />
        <rect x="0" y="11" width="18" height="2" rx="1" fill="currentColor" />
      </svg>
    </button>
  )
}
