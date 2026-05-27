import { useDroppable } from '@dnd-kit/core'
import { CardView } from './CardView'
import { CardFace } from './CardFace'
import { CARD_W, CARD_H } from '../constants/canvas'
import { computeColumnOffsets } from '../utils/layout'
import type { Card, Pile } from '../types/cards'
import styles from './TableauColumn.module.css'

export interface DragSourceInfo {
  sourceType: string
  sourceIndex?: number
  cardIndex: number
}

interface TableauColumnProps {
  colIndex: number
  pile: Pile
  dragSourceInfo: DragSourceInfo | null
  scale: number
  onDoubleClick?: (card: Card, cardIndex: number, sourceType: "waste" | "tableau" | "foundation", sourceIndex?: number) => void
  previewCards?: Card[]
}

export function TableauColumn({ colIndex, pile, dragSourceInfo, scale, onDoubleClick, previewCards }: TableauColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tableau-${colIndex}`,
    data: { toType: 'tableau', toIndex: colIndex },
  })

  // Per-column offsets — compressed automatically when tall stacks would overflow
  const { fuOffset, fdOffset } = computeColumnOffsets(pile)

  // Dynamic height based on actual face-up/down card counts
  const colHeight =
    pile.length === 0
      ? CARD_H
      : pile.slice(0, -1).reduce(
          (sum, c) => sum + (c.faceUp ? fuOffset : fdOffset),
          0
        ) + CARD_H

  // Base top for preview stack — sum of ALL pile card offsets (placed after last real card)
  const previewBaseTop = pile.reduce((sum, c) => sum + (c.faceUp ? fuOffset : fdOffset), 0)
  const totalHeight = previewCards?.length
    ? previewBaseTop + (previewCards.length - 1) * fuOffset + CARD_H
    : colHeight

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${isOver ? styles.over : ''}`}
      style={{ width: CARD_W, height: totalHeight }}
    >
      {pile.length === 0 ? (
        <div className={styles.emptySlot} />
      ) : (
        pile.map((card, i) => {
          // Compute absolute top offset by summing offsets of cards above
          const top = pile
            .slice(0, i)
            .reduce((sum, c) => sum + (c.faceUp ? fuOffset : fdOffset), 0)

          // Cards at or above the drag pick-up point show as ghost outlines
          const isGhosted =
            dragSourceInfo?.sourceType === 'tableau' &&
            dragSourceInfo.sourceIndex === colIndex &&
            i >= dragSourceInfo.cardIndex

          return (
            <div key={card.id} style={{ position: 'absolute', top, left: 0, zIndex: i }}>
              {isGhosted ? (
                <div className={styles.ghost} />
              ) : (
                <CardView
                  card={card}
                  cardIndex={i}
                  sourceType="tableau"
                  sourceIndex={colIndex}
                  draggable={card.faceUp}
                  scale={scale}
                  onDoubleClick={onDoubleClick}
                />
              )}
            </div>
          )
        })
      )}
      {previewCards?.map((card, j) => (
        <div
          key={`preview-${card.id}`}
          className={styles.previewCard}
          style={{ position: 'absolute', top: previewBaseTop + j * fuOffset, left: 0, zIndex: pile.length + j }}
        >
          <CardFace card={card} />
        </div>
      ))}
    </div>
  )
}
