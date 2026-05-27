import { useDroppable } from "@dnd-kit/core"
import { CardView } from "./CardView"
import type { Pile } from "../types/cards"
import type { DragSourceInfo } from "./TableauColumn"
import styles from "./Foundation.module.css"

const SUIT_SYMBOLS = ["\u2665", "\u2666", "\u2663", "\u2660"]

interface FoundationProps {
  index: number
  pile: Pile
  dragSourceInfo: DragSourceInfo | null
  scale: number
}

export function Foundation({ index, pile, dragSourceInfo, scale }: FoundationProps) {
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
    </div>
  )
}