import { motion } from "framer-motion"
import vqLogo from '../assets/veriquery-logo.png'
import { useGameStore }    from "../store/useGameStore"
import { useOptionsStore } from "../store/useOptionsStore"
import { getCardBack }     from "../utils/cardBacks"

interface StockPileProps {
  isRecycling: boolean
  canRecycle:  boolean
  onClick:     () => void
}

export function StockPile({ isRecycling, canRecycle, onClick }: StockPileProps) {
  const stockLength       = useGameStore((s) => s.stock.length)
  const { cardBackId, animationsEnabled } = useOptionsStore()
  const back = getCardBack(cardBackId)

  return (
    <motion.div
      className="w-12 h-16.75 shrink-0 cursor-pointer"
      onClick={onClick}
      whileTap={animationsEnabled ? { scale: 0.9 } : undefined}
      transition={{ duration: 0.10, ease: 'easeOut' }}
      title={
        stockLength > 0
          ? 'Draw'
          : canRecycle
          ? 'Reset stock'
          : 'No more recycles'
      }
    >
      {stockLength > 0 || isRecycling ? (
        <div
          className={`relative w-full h-full rounded-[5px] border border-black/25 shadow-[1px_2px_4px_rgba(0,0,0,0.35)] overflow-hidden flex items-center justify-center card-back-${back.id}`}
        >
          <div className={`absolute inset-1 rounded-xs z-0 pointer-events-none card-back-${back.id}-inner`} />
          <div className={`absolute inset-1 rounded-xs z-2 pointer-events-none border card-back-${back.id}-border`} />
          {back.showLogo ? (
            <img src={vqLogo} className="w-5 h-auto opacity-90 relative z-3 pointer-events-none" alt="" draggable={false} />
          ) : back.CenterIcon ? (
            <back.CenterIcon size={16} fill="currentColor" strokeWidth={0} className="relative z-3 pointer-events-none opacity-35" />
          ) : null}
        </div>
      ) : (
        <div
          className={`w-full h-full rounded-[5px] border-2 border-dashed flex items-center justify-center text-[22px] ${
            canRecycle
              ? 'border-white/40 text-white/50'
              : 'border-white/15 text-white/20'
          }`}
        >
          &#x21BA;
        </div>
      )}
    </motion.div>
  )
}
