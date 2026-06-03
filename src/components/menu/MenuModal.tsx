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

import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { Spade, BookOpen, Palette, Settings, Trophy, Lightbulb, X, type LucideIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { NewGamePanel }     from './panels/NewGamePanel'
import { RulesPanel }       from './panels/RulesPanel'
import { VisualsPanel }     from './panels/VisualsPanel'
import { OptionsPanel }     from './panels/OptionsPanel'
import { AssistPanel }      from './panels/AssistPanel'
import { LeaderboardPanel } from './panels/LeaderboardPanel'

type PanelId = 'new-game' | 'rules' | 'visuals' | 'options' | 'assist' | 'leaderboard'

const NAV_ITEMS: { id: PanelId; label: string; Icon: LucideIcon }[] = [
  { id: 'new-game',     label: 'New Game',     Icon: Spade },
  { id: 'rules',        label: 'Rules',        Icon: BookOpen },
  { id: 'assist',       label: 'Hints',        Icon: Lightbulb },
  { id: 'visuals',      label: 'Visuals',      Icon: Palette },
  { id: 'options',      label: 'Options',      Icon: Settings },
  { id: 'leaderboard',  label: 'Leaderboard',  Icon: Trophy },
]

interface MenuModalProps {
  open: boolean
  onClose: () => void
}

export function MenuModal({ open, onClose }: MenuModalProps) {
  const [activePanel, setActivePanel] = useState<PanelId>('new-game')
  const tabRefs = useRef<Partial<Record<PanelId, HTMLButtonElement | null>>>({})

  // Reset to New Game tab each time the modal opens
  useEffect(() => {
    if (open) setActivePanel('new-game')
  }, [open])

  function focusTab(panelId: PanelId) {
    setActivePanel(panelId)
    tabRefs.current[panelId]?.focus()
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % NAV_ITEMS.length
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + NAV_ITEMS.length) % NAV_ITEMS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = NAV_ITEMS.length - 1
    } else {
      return
    }

    event.preventDefault()
    focusTab(NAV_ITEMS[nextIndex].id)
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Game menu">
      {/* h-[min(540px,...)] = fixed 540 px on large screens; shrinks to fit on landscape phones.
           The fixed height (not min-height) is what eliminates panel-switch jumping. */}
      <div className="flex h-[min(540px,calc(100dvh-24px))]">
        {/* ── Sidebar nav ─────────────────────────────────────────────── */}
        <nav className="w-29 shrink-0 border-r border-white/8 py-2 flex flex-col" aria-label="Settings sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              ref={(element) => { tabRefs.current[item.id] = element }}
              id={`menu-tab-${item.id}`}
              aria-current={activePanel === item.id ? 'page' : undefined}
              aria-controls={`menu-panel-${item.id}`}
              onClick={() => focusTab(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, NAV_ITEMS.findIndex((navItem) => navItem.id === item.id))}
              className={[
                'w-full text-left px-3 py-2.25',
                'text-[12px] font-medium leading-snug',
                'flex items-center gap-2',
                'cursor-pointer border-0 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131f13] rounded-none',
                activePanel === item.id
                  ? 'bg-white/10 text-white/90'
                  : 'bg-transparent text-white/45 hover:text-white/70 hover:bg-white/5',
              ].join(' ')}
            >
              <item.Icon size={14} strokeWidth={1.75} className="shrink-0" />
              {item.label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="w-full text-left px-3 py-2.25 text-[12px] font-medium leading-snug flex items-center gap-2 cursor-pointer border-0 border-t border-white/8 mt-1 pt-2.5 bg-transparent text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white/65 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131f13]"
          >
            <X size={13} strokeWidth={2} className="shrink-0" />
            Close
          </button>
        </nav>

        {/* ── Panel content ────────────────────────────────────────────── */}
        {/* min-h-0 lets this flex child honour the parent's fixed height and scroll internally. */}
        <div
          className="flex-1 min-h-0 p-5 overflow-y-auto"
          role="region"
          id={`menu-panel-${activePanel}`}
          aria-labelledby={`menu-tab-${activePanel}`}
        >
          {activePanel === 'new-game'    && <NewGamePanel    onClose={onClose} />}
          {activePanel === 'rules'       && <RulesPanel      />}
          {activePanel === 'visuals'     && <VisualsPanel    />}
          {activePanel === 'options'     && <OptionsPanel    />}
          {activePanel === 'assist'      && <AssistPanel     />}
          {activePanel === 'leaderboard' && <LeaderboardPanel />}
        </div>
      </div>
    </Modal>
  )
}
