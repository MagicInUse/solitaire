import { useDroppable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
import { CardView } from './CardView'
import { CardFace } from './CardFace'
import { CARD_H } from '../constants/canvas'
import { DURATION } from '../constants/animations'
import { computeColumnOffsets, getTableauAvailableHeight } from '../utils/layout'
import { useAnimations } from '../hooks/useAnimations'
import type { GameLayoutMode } from '../hooks/useGameScale'
import type { Card, Pile } from '../types/cards'

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
  /** Current layout mode — drives which tableau height budget to use. */
  layout: GameLayoutMode
  isPhone?: boolean
  /** Called when the user double-clicks a face-up top card. */
  onDoubleClick?: (card: Card, cardIndex: number, sourceType: "waste" | "tableau" | "foundation", sourceIndex?: number) => void
  /**
   * Cards to render as a semi-transparent preview stack appended below the
   * real pile when a valid drag is hovered over this column.
   */
  previewCards?: Card[]
  /**
   * Index of the card that is the bottom of the hinted source stack.
   * Cards at this index and above receive the golden glow hint ring.
   */
  hintSourceCardIndex?: number
  /**
   * When true, renders a golden glow on the column to indicate it is the
   * drop target of the active hint.
   */
  hintTargetHighlight?: boolean
  selectedCardIndex?: number
  legalTarget?: boolean
  onDestination?: () => void
  isGestureSuppressed?: () => boolean
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
export function TableauColumn({ colIndex, pile, dragSourceInfo, scale, layout, isPhone = false, onDoubleClick, previewCards, hintSourceCardIndex, hintTargetHighlight,
  selectedCardIndex, legalTarget = false, onDestination, isGestureSuppressed }: TableauColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `tableau-${colIndex}`,
    data: { toType: 'tableau', toIndex: colIndex },
  })

  const animationsEnabled = useAnimations()

  // Per-column offsets — compressed automatically when tall stacks would overflow
  const tableauAvailableH = getTableauAvailableHeight(layout, isPhone)
  const { fuOffset, fdOffset } = computeColumnOffsets(pile, tableauAvailableH)

  // Dynamic height based on actual face-up/down card counts
  const colHeight =
    pile.length === 0
      ? CARD_H
      : pile.slice(0, -1).reduce(
          (sum, c) => sum + (c.faceUp ? fuOffset : fdOffset),
          0
        ) + CARD_H

  const previewOffsets = computeColumnOffsets([...pile, ...(previewCards ?? [])], tableauAvailableH)
  const previewBaseTop = pile.reduce((sum, c) => sum + (c.faceUp ? previewOffsets.fuOffset : previewOffsets.fdOffset), 0)

  return (
    <div
      ref={setNodeRef}
      data-pile={`tableau-${colIndex}`}
      onClick={onDestination}
      className={clsx("relative w-12 shrink-0 rounded-[5px]", legalTarget && 'legal-drop-target', hintTargetHighlight && "hint-glow-col")}
      style={{ height: colHeight }}
    >
      {pile.length === 0 ? (
        <div className="w-12 h-16.75 rounded-[5px] border-2 border-dashed border-white/30" />
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
            <div key={card.id} className="absolute left-0" style={{ top, zIndex: i }}>
              {isGhosted && (
                <div className="absolute inset-0 w-12 h-16.75 rounded-[5px] border-2 border-dashed border-white/70 bg-white/6 pointer-events-none" />
              )}
              <CardView
                  card={card}
                  cardIndex={i}
                  sourceType="tableau"
                  sourceIndex={colIndex}
                  draggable={card.faceUp}
                  scale={scale}
                  onDoubleClick={onDoubleClick}
                  dealDelay={(colIndex + i) * 0.03}
                  hinted={hintSourceCardIndex !== undefined && i >= hintSourceCardIndex && card.faceUp}
                  selected={selectedCardIndex !== undefined && i >= selectedCardIndex}
                  ghosted={isGhosted}
                  stackSize={pile.length - i}
                  offsets={pile.slice(i).map((_, j) => j * fuOffset)}
                  isGestureSuppressed={isGestureSuppressed}
              />
            </div>
          )
        })
      )}
      <AnimatePresence>
        {previewCards?.map((card, j) => (
          <motion.div
            key={`preview-${card.id}`}
            className="w-12 h-16.75 absolute left-0 pointer-events-none rounded-[5px] overflow-hidden"
            style={{ top: previewBaseTop + j * previewOffsets.fuOffset, zIndex: pile.length + j }}
            initial={animationsEnabled ? { opacity: 0 } : false}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animationsEnabled ? DURATION.instant : 0 }}
          >
            <CardFace card={card} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
