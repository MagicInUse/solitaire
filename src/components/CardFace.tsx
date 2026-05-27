import type { Card } from '../types/cards'
import styles from './Card.module.css'
import vqLogo from '../assets/veriquery-logo.png'

const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
}

interface CardFaceProps {
  card: Card
}

/** Pure visual card — no dnd hooks. Used by CardView and DragStack. */
export function CardFace({ card }: CardFaceProps) {
  if (!card.faceUp) {
    return (
      <div className={`${styles.card} ${styles.faceDown}`}>
        <img src={vqLogo} className={styles.backLogo} alt="" draggable={false} />
      </div>
    )
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  const rankLabel = RANK_LABELS[card.rank]
  const suitSymbol = SUIT_SYMBOLS[card.suit]

  return (
    <div
      className={`${styles.card} ${styles.faceUp} ${isRed ? styles.red : styles.black}`}
      aria-label={`${rankLabel} of ${card.suit}`}
    >
      <span className={styles.cornerTop}>{rankLabel}{suitSymbol}</span>
      <span className={styles.center}>{suitSymbol}</span>
      <span className={styles.cornerBottom}>{rankLabel}{suitSymbol}</span>
    </div>
  )
}
