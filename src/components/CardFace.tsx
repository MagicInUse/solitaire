import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Heart, Diamond, Club, Spade, type LucideIcon } from 'lucide-react'
import type { Card } from '../types/cards'
import vqLogo from '../assets/veriquery-logo.png'
import { useOptionsStore } from '../store/useOptionsStore'
import { useAnimations } from '../hooks/useAnimations'
import { getCardBack } from '../utils/cardBacks'

const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
const SUIT_ICONS: Record<string, LucideIcon> = {
  hearts: Heart, diamonds: Diamond, clubs: Club, spades: Spade,
}

/** Props for {@link CardFace}. */
interface CardFaceProps {
  /** The card data to render. */
  card: Card
}

/**
 * Pure visual representation of a single playing card — no drag-and-drop
 * hooks or interaction logic.
 *
 * - **Face-down**: renders the card back with the branded logo.
 * - **Face-up**: renders rank + suit corners and a centre suit symbol,
 *   coloured red (hearts/diamonds) or black (clubs/spades).
 *
 * Used by {@link CardView} (interactive, draggable wrapper) and
 * {@link DragStack} (drag overlay clone).
 */
export function CardFace({ card }: CardFaceProps) {
  const cardBackId = useOptionsStore((s) => s.cardBackId)
  const animationsEnabled = useAnimations()
  const back = getCardBack(cardBackId)

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  const rankLabel = RANK_LABELS[card.rank]
  const SuitIcon = SUIT_ICONS[card.suit]

  return (
    <AnimatePresence initial={false} mode="wait">
      {!card.faceUp ? (
        <motion.div
          key="down"
          className={`relative w-full h-full rounded-[5px] border border-black/25 shadow-[1px_2px_4px_rgba(0,0,0,0.35)] shrink-0 overflow-hidden flex items-center justify-center card-back-${back.id}`}
          exit={animationsEnabled ? { scaleX: 0 } : undefined}
          transition={{ duration: 0.075, ease: 'easeIn' }}
        >
          {/* Inner inset frame background */}
          <div
            className={`absolute inset-1 rounded-xs z-0 pointer-events-none card-back-${back.id}-inner`}
          />
          {/* Inner inset frame border */}
          <div
            className={`absolute inset-1 rounded-xs z-2 pointer-events-none border card-back-${back.id}-border`}
          />
          {/* Centre content */}
          {back.showLogo ? (
            <img
              src={vqLogo}
              className="w-5 h-auto opacity-90 relative z-3 pointer-events-none"
              alt=""
              draggable={false}
            />
          ) : back.CenterIcon ? (
            <back.CenterIcon
              size={16}
              fill="currentColor"
              strokeWidth={0}
              className="relative z-3 pointer-events-none opacity-35"
            />
          ) : null}
        </motion.div>
      ) : (
        <motion.div
          key="up"
          className={clsx("relative w-full h-full rounded-[5px] border border-black/25 shadow-[1px_2px_4px_rgba(0,0,0,0.35)] shrink-0 overflow-hidden bg-white flex items-center justify-center", isRed ? "text-[#c0392b]" : "text-[#1a1a1a]")}
          aria-label={`${rankLabel} of ${card.suit}`}
          initial={animationsEnabled ? { scaleX: 0 } : false}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.075, ease: 'easeOut' }}
        >
          <span className="absolute text-[11px] font-bold leading-none top-0.75 left-1 font-georgia flex items-center gap-[1px]">
            {rankLabel}<SuitIcon size={9} fill="currentColor" strokeWidth={0} className="inline-block" />
          </span>
          <SuitIcon size={22} fill="currentColor" strokeWidth={0} />
          <span className="absolute text-[11px] font-bold leading-none bottom-0.75 right-1 rotate-180 font-georgia flex items-center gap-[1px]">
            {rankLabel}<SuitIcon size={9} fill="currentColor" strokeWidth={0} className="inline-block" />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
