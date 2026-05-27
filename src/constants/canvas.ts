/**
 * @module canvas
 * Fixed design-canvas dimensions and layout constants.
 *
 * All values are logical pixels relative to a fixed 844 × 390 canvas.
 * A CSS `transform: scale()` fits the canvas to any screen size at runtime.
 * Landscape orientation (844 × 390) matches a standard phone held sideways.
 */

// ─── Design canvas ────────────────────────────────────────────────────────────
// All layout values are logical pixels relative to this fixed canvas.
// A CSS scale() transform fits the canvas to whatever screen is displaying it.
// Landscape orientation: 844 × 390 matches a standard phone held sideways.

/** Logical canvas width in pixels. */
export const CANVAS_W = 844
/** Logical canvas height in pixels. */
export const CANVAS_H = 390

// ─── Card dimensions (standard playing card ratio 1 : 1.396) ─────────────────

/** Card width in logical pixels. */
export const CARD_W = 48
/** Card height in logical pixels (ratio 1 : 1.396). */
export const CARD_H = 67

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Math: PADDING*2 + 7*CARD_W + 6*GAP = CANVAS_W
//       9*2 + 336 + 36 = 390 ✓

/** Outer padding on all edges of the canvas. */
export const PADDING = 9
/** Gap between adjacent tableau columns. */
export const GAP     = 6

// ─── Tableau card overlap ─────────────────────────────────────────────────────

/** Pixel offset between face-down cards — tight, only the back pattern shows. */
export const FACEDOWN_OFFSET     = 18
/** Pixel offset between face-up cards — wide enough to read rank + suit corner. */
export const FACEUP_OFFSET       = 34
/** Absolute minimum face-down offset for extreme stacks. */
export const MIN_FACEDOWN_OFFSET =  8
/** Absolute minimum face-up offset; 9 px corner font remains readable. */
export const MIN_FACEUP_OFFSET   = 12

// ─── Tableau area geometry ────────────────────────────────────────────────────
// Used by the compression utility to know how much vertical space is available.

/** Y coordinate where the tableau columns start (top of first card). */
export const TABLEAU_TOP         = PADDING + CARD_H + GAP         // 82 px
/** Vertical space available for tableau columns below the top row. */
export const TABLEAU_AVAILABLE_H = CANVAS_H - TABLEAU_TOP - PADDING  // 299 px
