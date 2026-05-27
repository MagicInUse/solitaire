import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { Card } from '../types/cards'
import vqLogo from '../assets/veriquery-logo.png'
import { useOptionsStore } from '../store/useOptionsStore'
import { getCardBack } from '../utils/cardBacks'

const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
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
  const animationsEnabled = useOptionsStore((s) => s.animationsEnabled)
  const back = getCardBack(cardBackId)

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  const rankLabel = RANK_LABELS[card.rank]
  const suitSymbol = SUIT_SYMBOLS[card.suit]

  return (
    <AnimatePresence initial={false} mode="wait">
      {!card.faceUp ? (
        <motion.div
          key="down"
          className="relative w-full h-full rounded-[5px] border border-black/25 shadow-[1px_2px_4px_rgba(0,0,0,0.35)] shrink-0 overflow-hidden flex items-center justify-center"
          style={back.outerStyle}
          exit={animationsEnabled ? { scaleX: 0 } : undefined}
          transition={{ duration: 0.075, ease: 'easeIn' }}
        >
          {/* Inner inset frame background */}
          <div
            className="absolute inset-[4px] rounded-[2px] z-0 pointer-events-none"
            style={{ background: back.innerBg }}
          />
          {/* Inner inset frame border */}
          <div
            className="absolute inset-[4px] rounded-[2px] z-[2] pointer-events-none"
            style={{ border: `1px solid ${back.innerBorder}` }}
          />
          {/* Centre content */}
          {back.showLogo ? (
            <img
              src={vqLogo}
              className="w-[20px] h-auto opacity-90 relative z-[3] pointer-events-none"
              alt=""
              draggable={false}
            />
          ) : back.centerIcon ? (
            <span
              className="relative z-[3] text-[16px] select-none pointer-events-none"
              style={{ opacity: 0.35 }}
            >
              {back.centerIcon}
            </span>
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
          <span className="absolute text-[11px] font-bold leading-none top-[3px] left-[4px]" style={{ fontFamily: 'Georgia, serif' }}>{rankLabel}{suitSymbol}</span>
          <span className="text-[22px] leading-none">{suitSymbol}</span>
          <span className="absolute text-[11px] font-bold leading-none bottom-[3px] right-[4px] rotate-180" style={{ fontFamily: 'Georgia, serif' }}>{rankLabel}{suitSymbol}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
