import { useDroppable } from '@dnd-kit/core'
import { CardView } from './CardView'
import { CardFace } from './CardFace'
import { CARD_W, CARD_H } from '../constants/canvas'
import { computeColumnOffsets } from '../utils/layout'
import type { Card, Pile } from '../types/cards'
import styles from './TableauColumn.module.css'

/**
 * Identifies the card (or bottom of a stack) currently being dragged.
 * Shared with {@link Foundation} to determine ghost rendering.
 */
export interface DragSourceInfo {
  /** Area the drag originated from. */
  sourceType: string
  /** Column / slot index within the source area (undefined for waste). */
  sourceIndex?: number
  /** Index of the topmost dragged card within its source pile. */
  cardIndex: number
}

/** Props for {@link TableauColumn}. */
interface TableauColumnProps {
  /** Zero-based column index (0–6). */
  colIndex: number
  /** Ordered array of cards in this column, bottom → top. */
  pile: Pile
  /** Active drag source info used to render ghost outlines for moving cards. */
  dragSourceInfo: DragSourceInfo | null
  /** Canvas scale factor from {@link useGameScale}. */
  scale: number
  /** Called when the user double-clicks a face-up top card. */
  onDoubleClick?: (card: Card, cardIndex: number, sourceType: "waste" | "tableau" | "foundation", sourceIndex?: number) => void
  /**
   * Cards to render as a semi-transparent preview stack appended below the
   * real pile when a valid drag is hovered over this column.
   */
  previewCards?: Card[]
}

/**
 * One of the seven tableau columns on the Klondike board.
 *
 * - Registers as a dnd-kit drop target (`tableau-{colIndex}`).
 * - Uses {@link computeColumnOffsets} to compress card peek distances so
 *   tall stacks always fit within the available canvas height.
 * - Cards at or above the drag pick-up point render as ghost outlines.
 * - Appends an optional translucent preview stack while a valid card is
 *   hovered above the column.
 */
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
