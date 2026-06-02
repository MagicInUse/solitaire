import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { GameBoard }   from './components/GameBoard'
import { MenuButton }  from './components/menu/MenuButton'
import { MenuModal }   from './components/menu/MenuModal'
import { useGameStore } from './store/useGameStore'
import { useOptionsStore } from './store/useOptionsStore'

/**
 * Shown when a new service worker is waiting to activate.
 * Styled to match the existing New Game button so it feels native to the game.
 *
 * Guards:
 * - Only surfaces when the player is idle (no game in progress, or game won) —
 *   never interrupts an active session.
 * - Dismissible for the current session so the player is never coerced.
 * - Polls for updates hourly via onRegisteredSW so long-running sessions
 *   eventually see a new version.
 */
function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Check for updates every hour so long-running sessions see new deploys.
      if (r) setInterval(() => r.update(), 60 * 60 * 1000)
    },
  })
  const moveCount = useGameStore(s => s.moveCount)
  const won = useGameStore(s => s.won)
  const [dismissed, setDismissed] = useState(false)

  // Only show when idle: game hasn't started yet, or is already won.
  const idle = moveCount === 0 || won
  if (!needRefresh || !idle || dismissed) return null

  return (
    <div
      className="update-banner-top fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-md bg-black/72 text-white/90 text-[13px] font-semibold tracking-[0.04em] whitespace-nowrap"
    >
      Update available
      <button
        className="py-1 px-3 border-0 rounded bg-white/18 text-white/90 text-[13px] font-semibold cursor-pointer"
        onClick={() => updateServiceWorker(true)}
      >
        Reload
      </button>
      <button
        aria-label="Dismiss update notification"
        className="flex items-center justify-center w-5 h-5 p-0 border-0 rounded bg-transparent text-white/45 text-base leading-none cursor-pointer"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  // Dev/replay affordance: `?seed=<seed>` forces a specific reproducible deal
  // on load, and the active seed is mirrored to `window.__solitaireSeed` so a
  // failing game can be captured and replayed. Runs once per page load.
  useEffect(() => {
    const seed = new URLSearchParams(window.location.search).get('seed')
    if (seed) useGameStore.getState().newGame(seed)
  }, [])

  const seed = useGameStore(s => s.seed)
  useEffect(() => {
    ;(window as unknown as { __solitaireSeed?: string }).__solitaireSeed = seed
  }, [seed])

  // Apply the theme to the document root
  const colorScheme = useOptionsStore(s => s.colorScheme)
  useEffect(() => {
    document.documentElement.dataset.theme = colorScheme
  }, [colorScheme])

  return (
    <>
      <GameBoard onOpenSettings={() => setMenuOpen(true)} />
      <MenuButton onClick={() => setMenuOpen(true)} />
      <MenuModal open={menuOpen} onClose={() => setMenuOpen(false)} />
      <UpdateBanner />
    </>
  )
}
