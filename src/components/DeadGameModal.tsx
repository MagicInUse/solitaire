/**
 * @module DeadGameModal
 * Shown when the game reaches an unwinnable state — no moves remain and
 * recycling the waste pile cannot change the board.
 *
 * Reuses the generic {@link Modal} base component so it inherits the
 * standard backdrop, portal, and entrance/exit animations.
 */

import { Modal }           from './ui/Modal'
import { Button }          from './ui/Button'
import { BrokenCardIcon }  from './icons/BrokenCardIcon'

interface DeadGameModalProps {
  open: boolean
  onClose: () => void
  onNewGame: () => void
  onOpenSettings?: () => void
}

export function DeadGameModal({ open, onClose, onNewGame, onOpenSettings }: DeadGameModalProps) {
  function handleNewGame() {
    onNewGame()
    onClose()
  }

  function handleSettings() {
    onClose()
    onOpenSettings?.()
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="px-6 py-7 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="leading-none mb-2 flex justify-center"><BrokenCardIcon size={36} /></div>
          <h2 className="text-white/90 text-[18px] font-bold tracking-wide">
            No Winning Moves Left
          </h2>
          <p className="text-white/45 text-[12px] mt-1.5 leading-relaxed">
            This game can&apos;t be completed. Better luck next time!
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <Button variant="primary" className="w-full" onClick={handleNewGame}>
            New Game
          </Button>
          {onOpenSettings && (
            <Button variant="ghost" size="sm" className="w-full" onClick={handleSettings}>
              Settings
            </Button>
          )}
        </div>

      </div>
    </Modal>
  )
}
