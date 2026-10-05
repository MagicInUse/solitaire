import type { Card, Pile, Suit } from '../types/cards'
import type { Board, MoveParams } from './gameActions'
import type { PlanAction } from './planner'
import { canPlaceOnFoundation, canPlaceOnTableau } from './rules'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const CARDS: Card[] = SUITS.flatMap(suit =>
  Array.from({ length: 13 }, (_, i): Card => ({
    id: `${suit}-${i + 1}`, suit, rank: (i + 1) as Card['rank'], faceUp: true,
  })),
)

/** Zero is an opaque card: neither its identity nor rank crosses the worker boundary. */
export interface VisibleBoard {
  stock: number[]
  waste: number[]
  foundations: number[]
  tableau: number[][]
}

export interface AnalysisInput {
  board: VisibleBoard
  drawMode: 1 | 3
  recyclesRemaining: number
}

export interface AnalysisLimits {
  maxNodes: number
  maxStates: number
  maxMs: number
}

export const ANALYSIS_LIMITS: AnalysisLimits = {
  maxNodes: 30_000, maxStates: 60_000, maxMs: 250,
}

interface SearchStats {
  expanded: number
  discovered: number
  elapsedMs: number
}

export type AnalysisResult =
  | { status: 'found'; plan: PlanAction[]; goal: 'reveal' | 'observe' | 'foundation'; stats: SearchStats }
  | { status: 'won'; plan: PlanAction[]; stats: SearchStats }
  | { status: 'no-progress'; stats: SearchStats }
  | { status: 'unknown'; reason: 'time' | 'nodes' | 'memory' | 'information'; stats: SearchStats }

export function cardCode(card: Pick<Card, 'suit' | 'rank'>): number {
  return SUITS.indexOf(card.suit) * 13 + card.rank
}

/** Remember only cards actually turned over, never inspect a face-down card's face. */
export function observeBoard(board: Board, memory: Map<string, number>): void {
  for (const pile of [board.waste, ...board.foundations, ...board.tableau]) {
    for (const card of pile) if (card.faceUp) memory.set(card.id, cardCode(card))
  }
}

export function visibleBoard(board: Board, memory: ReadonlyMap<string, number> = new Map()): VisibleBoard {
  const visible = (pile: Pile) => pile.map(c => c.faceUp ? cardCode(c) : 0)
  return {
    stock: board.stock.map(c => memory.get(c.id) ?? 0),
    waste: visible(board.waste),
    foundations: board.foundations.map(p => p.length ? cardCode(p[p.length - 1]) : 0),
    tableau: board.tableau.map(visible),
  }
}

export function analysisKey(input: AnalysisInput): string {
  const b = input.board
  return `${input.drawMode}:${input.recyclesRemaining}/${b.stock.join(',')}/${b.waste.join(',')}/` +
    `${b.foundations.join(',')}/${b.tableau.map(p => p.join(',')).join('|')}`
}

// Placement tables are compiled from the rulebook, not a second set of rules.
const TABLEAU = CARDS.map(c => [
  canPlaceOnTableau(c, []),
  ...CARDS.map(top => canPlaceOnTableau(c, [top])),
])
const FOUNDATION = CARDS.map(c => [
  canPlaceOnFoundation(c, []),
  ...CARDS.map(top => canPlaceOnFoundation(c, [top])),
])
const rank = (code: number) => code === 0 ? 0 : (code - 1) % 13 + 1
const foundationCount = (b: VisibleBoard) => b.foundations.reduce((n, c) => n + rank(c), 0)

function placements(b: VisibleBoard): MoveParams[] {
  const reveals: MoveParams[] = []
  const safe: MoveParams[] = []
  const other: MoveParams[] = []
  const backs: MoveParams[] = []
  const empty = b.tableau.findIndex(p => !p.length)
  const safeFoundation = (c: number) => {
    if (rank(c) <= 2) return true
    const red = c <= 26
    return b.foundations.filter(top => top && (top <= 26) !== red)
      .filter(top => rank(top) >= rank(c) - 1).length === 2
  }
  const add = (c: number, fromType: MoveParams['fromType'], fromIndex: number | undefined,
    cardIndex: number, single: boolean, revealsCard: boolean, wholeColumn: boolean) => {
    if (!c) return
    if (single && fromType !== 'foundation') {
      const firstEmptyFoundation = b.foundations.indexOf(0)
      b.foundations.forEach((top, f) => {
        if (!top && f !== firstEmptyFoundation) return
        if (FOUNDATION[c - 1][top]) {
          const move: MoveParams = { fromType, fromIndex, cardIndex, toType: 'foundation', toIndex: f }
          ;(revealsCard ? reveals : safeFoundation(c) ? safe : other).push(move)
        }
      })
    }
    b.tableau.forEach((dest, t) => {
      if (fromType === 'tableau' && fromIndex === t) return
      if (!dest.length && (t !== empty || wholeColumn)) return
      const top = dest.at(-1) ?? 0
      if (dest.length && !top) return
      if (TABLEAU[c - 1][top]) {
        const move: MoveParams = { fromType, fromIndex, cardIndex, toType: 'tableau', toIndex: t }
        ;(revealsCard ? reveals : fromType === 'foundation' ? backs : other).push(move)
      }
    })
  }
  const w = b.waste.length - 1
  if (w >= 0) add(b.waste[w], 'waste', undefined, w, true, false, false)
  b.tableau.forEach((pile, t) => {
    let valid = true
    for (let i = pile.length - 1; i >= 0 && pile[i]; i--) {
      if (i < pile.length - 1 && !TABLEAU[pile[i + 1] - 1][pile[i]]) valid = false
      if (valid) add(pile[i], 'tableau', t, i, i === pile.length - 1,
        i > 0 && pile[i - 1] === 0, i === 0)
    }
  })
  b.foundations.forEach((c, f) => {
    if (c) add(c, 'foundation', f, rank(c) - 1, true, false, false)
  })
  return [...reveals, ...safe, ...other, ...backs]
}

function advance(b: VisibleBoard, action: PlanAction, drawMode: 1 | 3): VisibleBoard {
  if (action.kind === 'draw') {
    const count = Math.min(drawMode, b.stock.length)
    return { ...b, stock: b.stock.slice(0, -count), waste: [...b.waste, ...b.stock.slice(-count)] }
  }
  if (action.kind === 'recycle') {
    return { ...b, stock: [...b.waste].reverse(), waste: [] }
  }
  const m = action.move
  const tableau = [...b.tableau]
  const foundations = [...b.foundations]
  let waste = b.waste
  let moving: number[]
  if (m.fromType === 'foundation') {
    const top = foundations[m.fromIndex!]
    moving = [top]
    foundations[m.fromIndex!] = rank(top) === 1 ? 0 : top - 1
  } else {
    const source = m.fromType === 'waste' ? waste : tableau[m.fromIndex!]
    moving = source.slice(m.cardIndex)
    if (m.fromType === 'waste') waste = source.slice(0, m.cardIndex)
    else tableau[m.fromIndex!] = source.slice(0, m.cardIndex)
  }
  if (m.toType === 'foundation') foundations[m.toIndex] = moving[0]
  else tableau[m.toIndex] = [...tableau[m.toIndex], ...moving]
  return { ...b, waste, tableau, foundations }
}

/** Columns are interchangeable; recycle resources are handled by dominance, not the key. */
function positionKey(b: VisibleBoard): string {
  return `${b.stock.join(',')}/${b.waste.join(',')}/${b.foundations.join(',')}/` +
    b.tableau.map(p => p.join(',')).sort().join('|')
}

interface Node {
  board: VisibleBoard
  recycles: number
  parent: number
  action?: PlanAction
  depth: number
  priority: number
  key: string
}

class Frontier {
  private heap: { id: number; priority: number }[] = []
  get length() { return this.heap.length }
  push(id: number, priority: number) {
    const entry = { id, priority }
    let i = this.heap.length
    this.heap.push(entry)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.before(this.heap[p], entry)) break
      this.heap[i] = this.heap[p]
      i = p
    }
    this.heap[i] = entry
  }
  pop(): number {
    const first = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length) {
      let i = 0
      while (i * 2 + 1 < this.heap.length) {
        let c = i * 2 + 1
        if (c + 1 < this.heap.length && this.before(this.heap[c + 1], this.heap[c])) c++
        if (this.before(last, this.heap[c])) break
        this.heap[i] = this.heap[c]
        i = c
      }
      this.heap[i] = last
    }
    return first.id
  }
  private before(a: { id: number; priority: number }, b: { id: number; priority: number }) {
    return a.priority < b.priority || (a.priority === b.priority && a.id <= b.id)
  }
}

function estimate(b: VisibleBoard): number {
  let blocked = 0
  for (const pile of b.tableau) {
    const hidden = pile.lastIndexOf(0)
    if (hidden >= 0) blocked += pile.length - hidden - 1
  }
  return blocked + b.stock.length / 3 - foundationCount(b) * 2
}

/**
 * Best-first graph search over visible information. A reveal or unknown draw is
 * an endpoint, never a simulated peek. Exhaustion proves only the stated goal;
 * any resource/information cutoff is explicitly unknown.
 */
export function analyze(
  input: AnalysisInput,
  limits: AnalysisLimits = ANALYSIS_LIMITS,
  goal: 'progress' | 'win' = 'progress',
  now: () => number = () => performance.now(),
): AnalysisResult {
  const started = now()
  const root: Node = {
    board: input.board, recycles: input.recyclesRemaining,
    parent: -1, depth: 0, priority: 0, key: positionKey(input.board),
  }
  const nodes: Node[] = [root]
  const visited = new Map<string, number>([[root.key, root.recycles]])
  const frontier = new Frontier()
  frontier.push(0, 0)
  let expanded = 0
  let informationCutoff = false
  const stats = (): SearchStats => ({ expanded, discovered: nodes.length, elapsedMs: now() - started })
  const unknown = (reason: Extract<AnalysisResult, { status: 'unknown' }>['reason']): AnalysisResult =>
    ({ status: 'unknown', reason, stats: stats() })
  const reconstruct = (id: number, last: PlanAction): PlanAction[] => {
    const path = [last]
    while (nodes[id].parent !== -1) {
      path.push(nodes[id].action!)
      id = nodes[id].parent
    }
    return path.reverse()
  }
  const startFoundation = foundationCount(root.board)
  if (startFoundation === 52) return { status: 'won', plan: [], stats: stats() }
  while (frontier.length) {
    if (expanded >= limits.maxNodes) return unknown('nodes')
    if (now() - started >= limits.maxMs) return unknown('time')
    const id = frontier.pop()
    const node = nodes[id]
    if ((visited.get(node.key) ?? -1) > node.recycles) continue
    expanded++
    const actions: PlanAction[] = placements(node.board).map(move => ({ kind: 'move', move }))
    if (node.board.stock.length) actions.push({ kind: 'draw' })
    else if (node.board.waste.length && node.recycles > 0) actions.push({ kind: 'recycle' })
    for (const action of actions) {
      const reveals = action.kind === 'move' && action.move.fromType === 'tableau' &&
        action.move.cardIndex > 0 && node.board.tableau[action.move.fromIndex!][action.move.cardIndex - 1] === 0
      const observes = action.kind === 'draw' &&
        node.board.stock.slice(-input.drawMode).includes(0)
      if (reveals || observes) {
        if (goal === 'progress') return {
          status: 'found', plan: reconstruct(id, action),
          goal: reveals ? 'reveal' : 'observe', stats: stats(),
        }
        informationCutoff = true
        continue
      }
      const board = advance(node.board, action, input.drawMode)
      const count = foundationCount(board)
      if (count === 52) return { status: 'won', plan: reconstruct(id, action), stats: stats() }
      if (goal === 'progress' && count > startFoundation) {
        return { status: 'found', plan: reconstruct(id, action), goal: 'foundation', stats: stats() }
      }
      const recycles = action.kind === 'recycle' ? node.recycles - 1 : node.recycles
      const key = positionKey(board)
      const previous = visited.get(key)
      if (previous !== undefined && previous >= recycles) continue
      if (nodes.length >= limits.maxStates) return unknown('memory')
      visited.set(key, recycles)
      const depth = node.depth + 1
      const priority = depth + estimate(board)
      nodes.push({ board, recycles, parent: id, action, depth, priority, key })
      frontier.push(nodes.length - 1, priority)
    }
  }
  return informationCutoff ? unknown('information') : { status: 'no-progress', stats: stats() }
}

/** Validate an action against the current board before delayed execution. */
export function isLegalPlanAction(input: AnalysisInput, action: PlanAction): boolean {
  if (action.kind === 'draw') return input.board.stock.length > 0
  if (action.kind === 'recycle') return !input.board.stock.length &&
    input.board.waste.length > 0 && input.recyclesRemaining > 0
  return placements(input.board).some(m =>
    m.fromType === action.move.fromType && m.fromIndex === action.move.fromIndex &&
    m.cardIndex === action.move.cardIndex && m.toType === action.move.toType &&
    m.toIndex === action.move.toIndex,
  )
}

/** Predict the visible state, but never predict the face of a newly observed card. */
export function nextVisibleInput(input: AnalysisInput, action: PlanAction): AnalysisInput | null {
  if (action.kind === 'draw' && input.board.stock.slice(-input.drawMode).includes(0)) return null
  if (action.kind === 'move' && action.move.fromType === 'tableau' && action.move.cardIndex > 0 &&
    input.board.tableau[action.move.fromIndex!][action.move.cardIndex - 1] === 0) return null
  return {
    ...input, board: advance(input.board, action, input.drawMode),
    recyclesRemaining: action.kind === 'recycle' ? input.recyclesRemaining - 1 : input.recyclesRemaining,
  }
}
