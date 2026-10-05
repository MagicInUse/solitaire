/**
 * @module deviceMatrix.test
 * Device-matrix diagnostics for the responsive canvas.
 *
 * These tests pin down how {@link computeLayout} and {@link computeColumnOffsets}
 * behave across a representative spread of real device viewports. The landscape
 * canvas is the wide 462 × 390 board: it stays height-bound on every real device
 * (so cards match portrait size) while the extra width reclaims the side felt
 * that the old square 390 × 390 canvas left empty. The tableau still only gets
 * ~267 logical px of vertical room, so long columns remain peek-compressed.
 */

import { describe, it, expect } from 'vitest'
import { computeLayout, computePlayableLayout, MAX_SCALE, PHONE_ACTIONS_H } from '../useGameScale'
import { computeColumnOffsets, getTableauAvailableHeight } from '../../utils/layout'
import {
  CARD_W, CARD_H, CANVAS_W_LANDSCAPE, CANVAS_H,
  TABLEAU_AVAILABLE_H, TABLEAU_AVAILABLE_H_PORTRAIT, HUD_H, GAP, FACEUP_OFFSET, FACEDOWN_OFFSET,
} from '../../constants/canvas'
import type { Card, Pile } from '../../types/cards'

/** A representative spread of device viewports (CSS px, landscape unless noted). */
const DEVICES: { name: string; w: number; h: number }[] = [
  { name: 'iPhone SE landscape',        w: 667,  h: 375 },
  { name: 'iPhone 14 Pro landscape',    w: 852,  h: 393 },
  { name: 'iPhone 14 Pro Max landscape',w: 932,  h: 430 },
  { name: 'iPad Mini landscape',        w: 1024, h: 768 },
  { name: 'iPad Air landscape',         w: 1180, h: 820 },
  { name: 'iPad Pro 12.9 landscape',    w: 1366, h: 1024 },
  { name: 'Laptop 1440 × 900',          w: 1440, h: 900 },
  { name: 'Desktop 1920 × 1080',        w: 1920, h: 1080 },
];

/** Worst-case real Klondike column: 6 face-down + a long face-up run. */
function buildLongColumn(faceDown: number, faceUp: number): Pile {
  const pile: Card[] = []
  for (let i = 0; i < faceDown; i++) {
    pile.push({ id: `fd-${i}`, suit: 'spades', rank: 2, faceUp: false } as Card)
  }
  for (let i = 0; i < faceUp; i++) {
    pile.push({ id: `fu-${i}`, suit: 'hearts', rank: 13 - i as Card['rank'], faceUp: true } as Card)
  }
  return pile
}

describe('device matrix — landscape is height-bound', () => {
  it('logs scale / card size / tableau room across devices', () => {
    const rows = DEVICES.map(({ name, w, h }) => {
      const { scale, layout } = computeLayout(w, h)
      const cardWpx = +(CARD_W * scale).toFixed(0)
      const tableauPx = +(TABLEAU_AVAILABLE_H * scale).toFixed(0)
      // Unused horizontal felt: viewport width minus the scaled canvas width.
      const usedW = CANVAS_W_LANDSCAPE * scale
      const unusedWpct = +(((w - usedW) / w) * 100).toFixed(0)
      return { name, layout, scale: +scale.toFixed(2), cardWpx, tableauPx, unusedWpct }
    })

    // eslint-disable-next-line no-console
    console.table(rows)
    expect(rows.length).toBe(DEVICES.length)
  })

  it('landscape scale is always bound by HEIGHT (min(w,h)=h)', () => {
    for (const { w, h } of DEVICES) {
      if (h >= w) continue // skip any portrait entries
      const { scale, layout } = computeLayout(w, h)
      expect(layout).toBe('landscape')
      const heightBound = Math.min(h / CANVAS_H, MAX_SCALE)
      expect(scale).toBeCloseTo(heightBound, 5)
    }
  })

  it('the wide 462 canvas reclaims side felt on tablets', () => {
    // iPad Air: the old square 390 canvas left ~31% of the width empty; the
    // wider 462 canvas brings that under a quarter while staying height-bound.
    const { scale } = computeLayout(1180, 820)
    const usedW = CANVAS_W_LANDSCAPE * scale
    const unusedFraction = (1180 - usedW) / 1180
    expect(unusedFraction).toBeLessThan(0.25)
  })

  it('long columns get peek-compressed below the natural offset in landscape', () => {
    // A 6-down + 7-up column (a realistic deep build) overflows 267px and
    // must compress the face-up peek below FACEUP_OFFSET to fit.
    const pile = buildLongColumn(6, 7)
    const naturalH =
      6 * FACEDOWN_OFFSET + 6 * FACEUP_OFFSET + CARD_H // contributing offsets + last full card
    const { fuOffset } = computeColumnOffsets(pile, TABLEAU_AVAILABLE_H)
    expect(naturalH).toBeGreaterThan(TABLEAU_AVAILABLE_H)
    expect(fuOffset).toBeLessThan(FACEUP_OFFSET)
  })
})

describe('phone action bar and fully visible long columns', () => {
  it.each([[320, 568], [390, 844], [667, 375]])('reserves unscaled actions at %i x %i', (w, h) => {
    const { isPhone, scale, layout } = computePlayableLayout(w, h)
    expect(isPhone).toBe(true)
    const canvasH = layout === 'portrait' ? 750 : 390
    expect(scale * canvasH + PHONE_ACTIONS_H).toBeLessThanOrEqual(h + 0.001)
  })
  it('preserves desktop scaling and orientation near the toolbar threshold', () => {
    expect(computePlayableLayout(1529, 907).scale).toBe(computeLayout(1529, 907).scale)
    expect(computePlayableLayout(390, 400).layout).toBe('portrait')
  })
  it('fits the longest legal run beneath six hidden cards including the status row', () => {
    const pile = buildLongColumn(6, 13)
    const { fuOffset, fdOffset } = computeColumnOffsets(pile, TABLEAU_AVAILABLE_H)
    const height = 6 * fdOffset + 12 * fuOffset + CARD_H
    expect(height).toBeLessThanOrEqual(TABLEAU_AVAILABLE_H + 0.001)
    expect(fuOffset).toBeGreaterThanOrEqual(12)
    expect(fdOffset).toBeGreaterThanOrEqual(0)
  })
  it.each(['portrait', 'landscape'] as const)('reclaims the HUD row on %s phones without changing desktop', (layout) => {
    const desktop = layout === 'portrait' ? TABLEAU_AVAILABLE_H_PORTRAIT : TABLEAU_AVAILABLE_H
    const mobile = getTableauAvailableHeight(layout, true)
    expect(getTableauAvailableHeight(layout)).toBe(desktop)
    expect(mobile).toBe(desktop + HUD_H + GAP)
    const { fuOffset, fdOffset } = computeColumnOffsets(buildLongColumn(6, 13), mobile)
    expect(6 * fdOffset + 12 * fuOffset + CARD_H).toBeLessThanOrEqual(mobile + 0.001)
  })
})
