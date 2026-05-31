/**
 * @module DebugOverlay
 * Diagnostic overlay for layout/scale tuning. Render only when the URL has
 * `?debug=1`. Shows the live scale, layout mode, canvas vs viewport size,
 * safe-area insets, and per-column peek-compression so the landscape
 * height-bound behaviour can be observed on real devices.
 *
 * Lives OUTSIDE the scaled canvas (fixed, viewport-relative) so its own text
 * never warps with the playfield.
 */

import {
  CANVAS_W_LANDSCAPE, CANVAS_H, CANVAS_W_PORTRAIT, CANVAS_H_PORTRAIT,
  CARD_W, TABLEAU_AVAILABLE_H, TABLEAU_AVAILABLE_H_PORTRAIT,
  CARD_H, FACEUP_OFFSET, FACEDOWN_OFFSET,
} from '../constants/canvas'
import { useGameScale } from '../hooks/useGameScale'
import { useGameStore } from '../store/useGameStore'
import { computeColumnOffsets } from '../utils/layout'

/** True when the page URL requests the debug overlay (`?debug=1`). */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('debug') === '1'
}

function readInset(name: string): string {
  if (typeof window === 'undefined') return '0'
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;top:0;left:0;height:0;width:0;padding-top:env(${name});`
  document.body.appendChild(probe)
  const v = getComputedStyle(probe).paddingTop
  probe.remove()
  return v
}

export function DebugOverlay() {
  const { scale, layout } = useGameScale()
  const tableau = useGameStore((s) => s.tableau)

  const isPortrait = layout === 'portrait'
  const canvasW = isPortrait ? CANVAS_W_PORTRAIT : CANVAS_W_LANDSCAPE
  const canvasH = isPortrait ? CANVAS_H_PORTRAIT : CANVAS_H
  const availH  = isPortrait ? TABLEAU_AVAILABLE_H_PORTRAIT : TABLEAU_AVAILABLE_H

  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardWpx = Math.round(CARD_W * scale)
  const usedW = canvasW * scale
  const unusedWpct = Math.round(((vw - usedW) / vw) * 100)

  const insets = {
    top:    readInset('safe-area-inset-top'),
    right:  readInset('safe-area-inset-right'),
    bottom: readInset('safe-area-inset-bottom'),
    left:   readInset('safe-area-inset-left'),
  }

  const columns = tableau.map((pile, i) => {
    const contributing = pile.slice(0, -1)
    const fd = contributing.filter(c => !c.faceUp).length
    const fu = contributing.filter(c => c.faceUp).length
    const naturalH = fd * FACEDOWN_OFFSET + fu * FACEUP_OFFSET + CARD_H
    const { fuOffset, fdOffset } = computeColumnOffsets(pile, availH)
    return {
      i,
      n: pile.length,
      naturalH,
      overflow: naturalH > availH,
      fu: +fuOffset.toFixed(1),
      fd: +fdOffset.toFixed(1),
      compressed: fuOffset < FACEUP_OFFSET || fdOffset < FACEDOWN_OFFSET,
    }
  })

  return (
    <div
      className="fixed top-1 left-1 z-200 pointer-events-none font-mono text-[10px] leading-[1.35] text-emerald-200 bg-black/75 rounded px-2 py-1.5 max-w-[58vw]"
    >
      <div className="text-emerald-300 font-bold">DEBUG ?debug=1</div>
      <div>layout: {layout}  scale: {scale.toFixed(3)}</div>
      <div>canvas: {canvasW}×{canvasH}  viewport: {vw}×{vh}</div>
      <div>card: {cardWpx}px  tableauH: {Math.round(availH * scale)}px  unusedW: {unusedWpct}%</div>
      <div>insets T{insets.top} R{insets.right} B{insets.bottom} L{insets.left}</div>
      <div className="mt-1 text-emerald-300">columns (natural / avail {availH}):</div>
      {columns.map((c) => (
        <div key={c.i} className={c.overflow ? 'text-amber-300' : undefined}>
          c{c.i}: n{c.n} h{c.naturalH}{c.overflow ? '⚠' : ' '} fu{c.fu} fd{c.fd}{c.compressed ? ' ⊟' : ''}
        </div>
      ))}
    </div>
  )
}
