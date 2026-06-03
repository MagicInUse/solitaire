import { useState } from "react"
import { motion } from "framer-motion"
import vqLogo from '../assets/veriquery-logo.png'
import { useGameStore }    from "../store/useGameStore"
import { useOptionsStore } from "../store/useOptionsStore"
import { useAnimations }   from "../hooks/useAnimations"
import { DURATION, EASE }  from "../constants/animations"
import { getCardBack }     from "../utils/cardBacks"

interface StockPileProps {
  isRecycling: boolean
  canRecycle:  boolean
  onClick:     () => void
}

export function StockPile({ isRecycling, canRecycle, onClick }: StockPileProps) {
  const stockLength       = useGameStore((s) => s.stock.length)
  const cardBackId        = useOptionsStore((s) => s.cardBackId)
  const animationsEnabled = useAnimations()
  const back = getCardBack(cardBackId)
  const [shake, setShake] = useState(false)

  // The stock is interactive when it can be drawn from, or recycled. When the
  // stock is empty AND recycles are exhausted there is nothing to do — match the
  // classic MS Solitaire treatment: a "no redeals" symbol on a non-clickable
  // pile (no toast). A small shake acknowledges an attempted tap.
  const exhausted   = stockLength === 0 && !canRecycle && !isRecycling
  const interactive = !exhausted

  function handleClick() {
    if (exhausted) {
      if (animationsEnabled) setShake(true)
      return
    }
    onClick()
  }

  return (
    <motion.div
      className={`w-12 h-16.75 shrink-0 ${interactive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      onClick={handleClick}
      whileTap={interactive && animationsEnabled ? { scale: 0.9 } : undefined}
      animate={shake ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
      onAnimationComplete={() => { if (shake) setShake(false) }}
      transition={shake ? { duration: 0.32, ease: EASE.inOut } : { duration: DURATION.instant, ease: EASE.out }}
      title={
        stockLength > 0
          ? 'Draw'
          : canRecycle
          ? 'Reset stock'
          : 'No more redeals'
      }
    >
      {stockLength > 0 || isRecycling ? (
        <div
          className={`relative w-full h-full rounded-[5px] border card-outline-themed shadow-[1px_2px_4px_rgba(0,0,0,0.35)] overflow-hidden flex items-center justify-center card-back-${back.id}`}
        >
          <div className={`absolute inset-1 rounded-xs z-0 pointer-events-none card-back-${back.id}-inner`} />
          <div className={`absolute inset-1 rounded-xs z-2 pointer-events-none border card-back-${back.id}-border`} />
          {back.showLogo ? (
            <img src={vqLogo} className="w-5 h-auto opacity-90 relative z-3 pointer-events-none" alt="" draggable={false} />
          ) : back.CenterIcon ? (
            <back.CenterIcon size={16} fill="currentColor" strokeWidth={0} className="relative z-3 pointer-events-none opacity-35" />
          ) : null}
        </div>
      ) : canRecycle ? (
        <div
          className="w-full h-full rounded-[5px] border-2 border-dashed flex items-center justify-center text-[22px] border-white/40 text-white/50"
        >
          &#x21BA;
        </div>
      ) : (
        // Recycles exhausted — "no redeals" circle-with-slash, non-interactive.
        <div
          className="w-full h-full rounded-[5px] border-2 border-dashed flex items-center justify-center text-[24px] border-white/15 text-white/25"
          aria-label="No more redeals"
        >
          &#x2298;
        </div>
      )}
    </motion.div>
  )
}
