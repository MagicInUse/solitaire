import type { Card, GameState } from '../types/cards'
import type { MoveParams } from '../engine/gameActions'
import { canMoveStack } from '../engine/rules'

export type SourceType = MoveParams['fromType']
export interface CardSource {
  sourceType: SourceType
  sourceIndex?: number
  cardIndex: number
  cards: Card[]
  offsets: number[]
}
export interface Destination {
  toType: MoveParams['toType']
  toIndex: number
}

export function resolveSource(
  board: GameState, sourceType: SourceType, sourceIndex: number | undefined,
  cardIndex: number, offsets: number[] = [],
): CardSource | null {
  const pile = sourceType === 'waste' ? board.waste
    : sourceIndex === undefined ? undefined
    : sourceType === 'tableau' ? board.tableau[sourceIndex] : board.foundations[sourceIndex]
  if (!pile || !Number.isInteger(cardIndex) || cardIndex < 0 || !pile[cardIndex]?.faceUp) return null
  if (sourceType !== 'tableau' && cardIndex !== pile.length - 1) return null
  const cards = pile.slice(cardIndex)
  if (cards.some(card => !card.faceUp)) return null
  return { sourceType, sourceIndex, cardIndex, cards, offsets }
}

export function isLegalDestination(board: GameState, source: CardSource, dest: Destination): boolean {
  if (!Number.isInteger(dest.toIndex) || dest.toIndex < 0) return false
  if (source.sourceType === dest.toType && source.sourceIndex === dest.toIndex) return false
  const fresh = resolveSource(board, source.sourceType, source.sourceIndex, source.cardIndex)
  if (!fresh || fresh.cards.length !== source.cards.length ||
      fresh.cards.some((card, i) => card.id !== source.cards[i].id)) return false
  const pile = dest.toType === 'tableau' ? board.tableau[dest.toIndex] : board.foundations[dest.toIndex]
  return !!pile && canMoveStack(fresh.cards, pile, dest.toType)
}

export function cardName(card: Card): string {
  const names: Partial<Record<Card['rank'], string>> = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' }
  const rank = names[card.rank] ?? String(card.rank)
  return `${rank} of ${card.suit}`
}

export function destinationName(dest: Destination): string {
  return `${dest.toType === 'tableau' ? 'column' : 'foundation'} ${dest.toIndex + 1}`
}

export interface DropBounds {
  id: string
  left: number
  right: number
  top: number
  bottom: number
  legal: boolean
}

export const DROP_TOLERANCE = 10

/** Never forgive a release over an illegal pile, or between competing legal piles. */
export function chooseDropTarget(point: { x: number; y: number }, targets: DropBounds[]): string | null {
  const inside = targets.filter(r => point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom)
  if (inside.length) return inside.length === 1 && inside[0].legal ? inside[0].id : null
  const nearby = targets.filter(r => r.legal && Math.hypot(
    Math.max(r.left - point.x, 0, point.x - r.right),
    Math.max(r.top - point.y, 0, point.y - r.bottom),
  ) <= DROP_TOLERANCE)
  return nearby.length === 1 ? nearby[0].id : null
}

export function readDestination(data: unknown): Destination | null {
  if (!data || typeof data !== 'object' || !('toType' in data) || !('toIndex' in data)) return null
  if ((data.toType !== 'tableau' && data.toType !== 'foundation') || typeof data.toIndex !== 'number') return null
  return { toType: data.toType, toIndex: data.toIndex }
}
