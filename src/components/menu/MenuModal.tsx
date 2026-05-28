/**
 * @module MenuModal
 * Main game menu — a left-nav tabbed modal housing all settings panels.
 *
 * Panels:
 *   New Game | Rules | Visuals | Options | Leaderboard
 *
 * The active panel is tracked in local state so navigating the menu never
 * triggers a game-state re-render. The modal resets to "New Game" on open.
 */

import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { NewGamePanel }     from './panels/NewGamePanel'
import { RulesPanel }       from './panels/RulesPanel'
import { VisualsPanel }     from './panels/VisualsPanel'
import { OptionsPanel }     from './panels/OptionsPanel'
import { LeaderboardPanel } from './panels/LeaderboardPanel'

type PanelId = 'new-game' | 'rules' | 'visuals' | 'options' | 'leaderboard'

const NAV_ITEMS: { id: PanelId; label: string; icon: string }[] = [
  { id: 'new-game',     label: 'New Game',     icon: '♠' },
  { id: 'rules',        label: 'Rules',        icon: '♟' },
  { id: 'visuals',      label: 'Visuals',      icon: '✦' },
  { id: 'options',      label: 'Options',      icon: '⚙' },
  { id: 'leaderboard',  label: 'Leaderboard',  icon: '★' },
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
      <div className="flex min-h-[440px]">
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
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="w-full text-left px-3 py-[9px] text-[12px] font-medium leading-snug flex items-center gap-2 cursor-pointer border-0 border-t border-white/8 mt-1 pt-[10px] bg-transparent text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors duration-150"
          >
            <span className="text-[13px] w-[16px] text-center shrink-0">✕</span>
            Close
          </button>
        </nav>

        {/* ── Panel content ────────────────────────────────────────────── */}
        <div className="flex-1 p-5 overflow-y-auto max-h-[520px]">
          {activePanel === 'new-game'    && <NewGamePanel    onClose={onClose} />}
          {activePanel === 'rules'       && <RulesPanel      />}
          {activePanel === 'visuals'     && <VisualsPanel    />}
          {activePanel === 'options'     && <OptionsPanel    />}
          {activePanel === 'leaderboard' && <LeaderboardPanel />}
        </div>
      </div>
    </Modal>
  )
}
