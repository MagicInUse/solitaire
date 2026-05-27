import { useRegisterSW } from 'virtual:pwa-register/react'
import { GameBoard } from './components/GameBoard'

/**
 * Shown when a new service worker is waiting to activate.
 * Styled to match the existing New Game button so it feels native to the game.
 * Only appears when the user is idle — never interrupts an active game session.
 */
function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.72)',
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      Update available
      <button
        style={{
          padding: '4px 12px',
          border: 0,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.9)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => updateServiceWorker(true)}
      >
        Reload
      </button>
    </div>
  )
}

export default function App() {
  return (
    <>
      <GameBoard />
      <UpdateBanner />
    </>
  )
}
