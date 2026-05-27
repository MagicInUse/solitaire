// ─── Design canvas ────────────────────────────────────────────────────────────
// All layout values are logical pixels relative to this fixed canvas.
// A CSS scale() transform fits the canvas to whatever screen is displaying it.
// Landscape orientation: 844 × 390 matches a standard phone held sideways.
export const CANVAS_W = 844
export const CANVAS_H = 390

// ─── Card dimensions (standard playing card ratio 1 : 1.396) ─────────────────
export const CARD_W = 48
export const CARD_H = 67

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Math: PADDING*2 + 7*CARD_W + 6*GAP = CANVAS_W
//       9*2 + 336 + 36 = 390 ✓
export const PADDING = 9
export const GAP     = 6

// ─── Tableau card overlap ─────────────────────────────────────────────────────
export const FACEDOWN_OFFSET     = 18  // tight — only back pattern visible
export const FACEUP_OFFSET       = 34  // wide enough to read rank + suit corner
export const MIN_FACEDOWN_OFFSET =  8  // absolute floor (extreme stacks)
export const MIN_FACEUP_OFFSET   = 12  // floor — 9px corner font still readable

// ─── Tableau area geometry ────────────────────────────────────────────────────
// Used by the compression utility to know how much vertical space is available.
export const TABLEAU_TOP         = PADDING + CARD_H + GAP         // 82 px
export const TABLEAU_AVAILABLE_H = CANVAS_H - TABLEAU_TOP - PADDING  // 299 px
