/**
 * @module controllers/useAutoComplete
 * Drives the auto-complete feature: once all tableau cards are face-up and the
 * stock/waste are empty, the player can trigger a rapid cascade that moves every
 * remaining card to a foundation automatically.
 *
 * Exposes:
 *  - `autoCompleting`     — whether the cascade is currently running
 *  - `setAutoCompleting`  — lets GameBoard start/stop the cascade
 *  - `canAutoComplete`    — whether the "Auto-complete" button should be shown
 */

import { useEffect, useState } from 'react'
import { useGameStore }    from '../store/useGameStore'
import { useSounds }       from '../hooks/useSounds'
import { canMoveStack }    from '../engine/rules'

export interface UseAutoCompleteReturn {
  autoCompleting:    boolean
  setAutoCompleting: React.Dispatch<React.SetStateAction<boolean>>
  canAutoComplete:   boolean
}

export function useAutoComplete(): UseAutoCompleteReturn {
  const stock       = useGameStore((s) => s.stock)
  const waste       = useGameStore((s) => s.waste)
  const tableau     = useGameStore((s) => s.tableau)
  const foundations = useGameStore((s) => s.foundations)
  const won         = useGameStore((s) => s.won)
  const dealId      = useGameStore((s) => s.dealId)
  const moveCards   = useGameStore((s) => s.moveCards)

  const { playSfx } = useSounds()

  const [autoCompleting, setAutoCompleting] = useState(false)

  // Reset on new game
  useEffect(() => { setAutoCompleting(false) }, [dealId])

  const canAutoComplete =
    !won && !autoCompleting &&
    stock.length === 0 && waste.length === 0 &&
    tableau.every(col => col.every(c => c.faceUp))

  useEffect(() => {
    if (!autoCompleting || won) return

    function findMove() {
      for (let col = 0; col < 7; col++) {
        const pile = tableau[col]
        if (pile.length === 0) continue
        const topCard = pile[pile.length - 1]
        if (!topCard.faceUp) continue
        for (let fi = 0; fi < 4; fi++) {
          if (canMoveStack([topCard], foundations[fi], 'foundation')) {
            return { colIndex: col, cardIndex: pile.length - 1, foundationIdx: fi }
          }
        }
      }
      return null
    }

    const move = findMove()
    if (!move) { setAutoCompleting(false); return }

    const id = setTimeout(() => {
      moveCards({
        fromType: 'tableau',
        fromIndex: move.colIndex,
        cardIndex: move.cardIndex,
        toType:    'foundation',
        toIndex:   move.foundationIdx,
      })
      playSfx('CARD_PLACE')
    }, 120)

    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCompleting, won, tableau, foundations])

  return { autoCompleting, setAutoCompleting, canAutoComplete }
}
