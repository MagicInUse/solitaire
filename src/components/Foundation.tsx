import { useDroppable } from "@dnd-kit/core"
import { CardView } from "./CardView"
import { CardFace } from "./CardFace"
import type { Card, Pile } from "../types/cards"
import type { DragSourceInfo } from "./TableauColumn"
import styles from "./Foundation.module.css"

const SUIT_SYMBOLS = ["\u2665", "\u2666", "\u2663", "\u2660"]

/** Props for {@link Foundation}. */
interface FoundationProps {
  /** Zero-based foundation slot index (0 = ♥, 1 = ♦, 2 = ♣, 3 = ♠). */
  index: number
  /** Current cards stacked on this foundation, ordered Ace → King. */
  pile: Pile
  /** Active drag source info used to ghost the card being dragged away. */
  dragSourceInfo: DragSourceInfo | null
  /** Canvas scale factor from {@link useGameScale}. */
  scale: number
  /**
   * Card to render as a semi-transparent drop preview when a valid card
   * is being hovered over this foundation.
   */
  previewCard?: Card
}

/**
 * One of the four foundation piles in the top-right of the board.
 *
 * - Registers as a dnd-kit drop target (`foundation-{index}`).
 * - Renders the topmost card via {@link CardView} (draggable back to tableau).
 * - Shows the suit symbol placeholder when empty or ghosted.
 * - Renders an optional {@link CardFace} preview overlay while a valid card
 *   hovers above the slot.
 */
export function Foundation({ index, pile, dragSourceInfo, scale, previewCard }: FoundationProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `foundation-${index}`,
    data: { toType: "foundation", toIndex: index },
  })

  const topCard = pile[pile.length - 1]

  // Show ghost when the top foundation card is being dragged back to tableau
  const isGhosted =
    dragSourceInfo?.sourceType === "foundation" &&
    dragSourceInfo.sourceIndex === index &&
    pile.length > 0

  return (
    <div ref={setNodeRef} className={`${styles.foundation} ${isOver ? styles.over : ""}`}>
      {isGhosted ? (
        <div className={styles.empty}>{SUIT_SYMBOLS[index]}</div>
      ) : topCard ? (
        <CardView
          card={topCard}
          cardIndex={pile.length - 1}
          sourceType="foundation"
          sourceIndex={index}
          scale={scale}
        />
      ) : (
        <div className={styles.empty}>{SUIT_SYMBOLS[index]}</div>
      )}
      {previewCard && (
        <div className={styles.preview}>
          <CardFace card={previewCard} />
        </div>
      )}
    </div>
  )
}