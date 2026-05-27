/**
 * @module MenuModal
 * Main game menu — a left-nav tabbed modal housing all settings panels.
 *
 * Panels rendered:
 *   New Game | Leaderboard | Deck Side | Animations | Card Backs | Options
 *
 * The active panel is tracked in local state so navigating the menu never
 * triggers a game-state re-render. The modal resets to "New Game" on open.
 */

import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { NewGamePanel }      from './panels/NewGamePanel'
import { LeaderboardPanel }  from './panels/LeaderboardPanel'
import { DeckLocationPanel } from './panels/DeckLocationPanel'
import { AnimationsPanel }   from './panels/AnimationsPanel'
import { CardBackPanel }     from './panels/CardBackPanel'
import { OptionsPanel }      from './panels/OptionsPanel'

type PanelId = 'new-game' | 'leaderboard' | 'deck-location' | 'animations' | 'card-back' | 'options'

const NAV_ITEMS: { id: PanelId; label: string; icon: string }[] = [
  { id: 'new-game',      label: 'New Game',    icon: '♠' },
  { id: 'leaderboard',   label: 'Leaderboard', icon: '★' },
  { id: 'deck-location', label: 'Deck Side',   icon: '⇄' },
  { id: 'animations',    label: 'Animations',  icon: '✦' },
  { id: 'card-back',     label: 'Card Backs',  icon: '🃏' },
  { id: 'options',       label: 'Options',     icon: '⚙' },
]

interface MenuModalProps {
  open: boolean
  onClose: () => void
}

export function MenuModal({ open, onClose }: MenuModalProps) {
  const [activePanel, setActivePanel] = useState<PanelId>('new-game')

  // Reset to New Game tab each time the modal opens
  useEffect(() => {
    if (open) setActivePanel('new-game')
  }, [open])

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex min-h-[320px]">
        {/* ── Sidebar nav ─────────────────────────────────────────────── */}
        <nav className="w-[116px] shrink-0 border-r border-white/8 py-2 flex flex-col">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={[
                'w-full text-left px-3 py-[9px]',
                'text-[12px] font-medium leading-snug',
                'flex items-center gap-2',
                'cursor-pointer border-0 transition-colors duration-150',
                activePanel === item.id
                  ? 'bg-white/10 text-white/90'
                  : 'bg-transparent text-white/45 hover:text-white/70 hover:bg-white/5',
              ].join(' ')}
            >
              <span className="text-[13px] w-[16px] text-center shrink-0">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* ── Panel content ────────────────────────────────────────────── */}
        <div className="flex-1 p-5 overflow-y-auto max-h-[480px] min-h-[390px]">
          {activePanel === 'new-game'      && <NewGamePanel      onClose={onClose} />}
          {activePanel === 'leaderboard'   && <LeaderboardPanel  />}
          {activePanel === 'deck-location' && <DeckLocationPanel />}
          {activePanel === 'animations'    && <AnimationsPanel   />}
          {activePanel === 'card-back'     && <CardBackPanel     />}
          {activePanel === 'options'       && <OptionsPanel      />}
        </div>
      </div>
    </Modal>
  )
}
