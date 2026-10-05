import { Undo2, Lightbulb, Bot, Zap, Menu } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  mobile?: boolean
  mobileScore: ReactNode
  moveCount: number
  canUndo: boolean
  hintsEnabled: boolean
  hintDisabled: boolean
  showAI: boolean
  isAIPlaying: boolean
  aiDisabled: boolean
  showAuto: boolean
  autoCompleting: boolean
  onUndo: () => void
  onHint: () => void
  onAI: () => void
  onAuto: () => void
  onMenu?: () => void
  interactionBusy: boolean
}

export function GameActions(props: Props) {
  const size = props.mobile ? 20 : 11
  const labelClass = props.mobile ? 'sr-only' : undefined
  const className = 'game-action'
  return (
    <div className={props.mobile ? 'phone-actions' : 'flex items-center gap-1'} data-drop-block={props.mobile || undefined}>
      {props.mobile && <div className="phone-stat phone-score">{props.mobileScore}</div>}
      <div className="game-action-buttons">
        <button className={className} onClick={props.onUndo} disabled={!props.canUndo || props.interactionBusy} aria-label="Undo" title="Undo">
          <Undo2 size={size} /><span className={labelClass}>Undo</span>
        </button>
        {props.hintsEnabled && <button className={className} onClick={props.onHint} disabled={props.hintDisabled || props.interactionBusy} aria-label="Hint" title="Hint">
          <Lightbulb size={size} /><span className={labelClass}>Hint</span>
        </button>}
        {props.showAI && <button className={className} onClick={props.onAI} disabled={props.aiDisabled} aria-label={props.isAIPlaying ? 'Stop AI4ME' : 'AI4ME'} aria-pressed={props.isAIPlaying} title="AI4ME">
          <Bot size={size} /><span className={labelClass}>AI4ME</span>
        </button>}
        {props.showAuto && <button className={className} onClick={props.onAuto} disabled={props.isAIPlaying || props.interactionBusy} aria-label="Auto-complete" aria-pressed={props.autoCompleting} title="Auto-complete">
          <Zap size={size} /><span className={labelClass}>Auto</span>
        </button>}
        {props.mobile && <button className={className} onClick={props.onMenu} aria-label="Open menu" title="Open menu">
          <Menu size={size} />
        </button>}
      </div>
      {props.mobile && <div className="phone-stat phone-moves" title="Moves">
        <span className="phone-stat-label">Moves</span>
        <span className="phone-stat-value">{props.moveCount}</span>
      </div>}
    </div>
  )
}
