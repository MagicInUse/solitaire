/**
 * @module canvas
 * Fixed design-canvas dimensions and layout constants.
 *
 * All values are logical pixels relative to a fixed canvas.
 * A CSS `transform: scale()` fits the canvas to any screen size at runtime.
 * Landscape orientation is a wide 462 × 390 canvas: the 7 tableau columns
 * spread edge-to-edge (justify-between) with comfortable ~18 px gaps, so the
 * board reclaims horizontal felt on wide screens while staying cohesive. The
 * height (390) still bounds the scale, so card size matches portrait.
 * Portrait orientation (390 × 750) matches a standard phone held upright.
 */

// ─── Design canvas ────────────────────────────────────────────────────────────
// All layout values are logical pixels relative to this fixed canvas.
// A CSS scale() transform fits the canvas to whatever screen is displaying it.
//
// Both orientations share the same width (390 px = 7 columns + 6 gaps + 2 padding).
// The scale factor = min(viewportW, viewportH) / 390 so the canvas always fills
// as much of the screen as possible while the surrounding felt remains visible.
// Landscape canvas is square (390 × 390); portrait is taller (390 × 750).

/** Logical canvas width in pixels (landscape — same as portrait width). */
export const CANVAS_W = 390
/**
 * Logical canvas width in pixels for LANDSCAPE orientation.
 *
 * Wider than the 390 column-pack width so the 7 columns spread out with
 * comfortable ~18 px gaps (via `justify-between`) instead of leaving the
 * extra felt empty. Math: PADDING*2 + 7*CARD_W + 6*gap = 462 → gap = 18.
 */
export const CANVAS_W_LANDSCAPE = 462
/** Logical canvas height in pixels (landscape). */
export const CANVAS_H = 390

// Portrait orientation: same width, taller canvas to use the extra vertical space.

/** Logical canvas width in pixels (portrait). */
export const CANVAS_W_PORTRAIT = 390
/** Logical canvas height in pixels (portrait). */
export const CANVAS_H_PORTRAIT = 750

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
/** Horizontal pixel offset between fanned waste cards (draw-3 fan). */
export const FAN_OFFSET = 14

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

/** Height of the HUD row (timer · score · moves · undo/hint buttons). */
export const HUD_H = 26

/** Y coordinate where the tableau columns start (top of first card).
 *  Accounts for: padding + top-row (card) + gap + HUD row + gap. */
export const TABLEAU_TOP         = PADDING + CARD_H + GAP + HUD_H + GAP   // 114 px
/** Vertical space available for tableau columns (landscape). */
export const TABLEAU_AVAILABLE_H = CANVAS_H - TABLEAU_TOP - PADDING        // 267 px
/** Vertical space available for tableau columns (portrait). */
export const TABLEAU_AVAILABLE_H_PORTRAIT = CANVAS_H_PORTRAIT - TABLEAU_TOP - PADDING  // 627 px
