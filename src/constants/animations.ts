/**
 * @module animations
 * Centralized animation timing, easing, and spring configuration plus the
 * project's "cinematography" convention — which motion style is used for which
 * game event, so movement stays intentional and consistent across the board.
 *
 * ─── Cinematography convention ────────────────────────────────────────────────
 * Each game event has ONE assigned style. Variation is fine, but the style is
 * tied to meaning, not chosen ad-hoc per component:
 *
 *  • DEAL            fade + slide-up, staggered top-left → bottom-right.
 *  • DRAW → WASTE    slide IN from the STOCK pile position (single origin —
 *                    never "pop" or fade from an arbitrary point).
 *  • PROGRAMMATIC    shared-element FLIP layout transition (double/single-tap
 *    MOVE            auto-move): the card travels from old to new slot.
 *  • DROP (drag)     no entrance anim; dnd-kit owns the in-flight transform.
 *  • RECYCLE         horizontal slide, waste fan → stock (CSS, see RecycleAnimation).
 *  • FOUNDATION LAND scale "bounce" pop in place when a card settles.
 *  • DROP PREVIEW    quick opacity fade of the ghost target.
 *  • UNDO            spring snap-back to the previous position.
 *  • WIN             cascade: cards fall from the top with rotation + bounce.
 *  • MODAL           scale + fade + slight rise from centre.
 *  • HINT            slow box-shadow pulse (CSS) on the source/target.
 *  • TAP / PRESS     brief scale-down for tactile feedback.
 *
 * All of the above are gated by `useAnimations()` (player preference AND OS
 * `prefers-reduced-motion`). Reach for these constants instead of inlining
 * magic numbers so durations/easings stay uniform.
 */

import type { Transition } from 'framer-motion'

/** Durations in SECONDS (Framer Motion units). */
export const DURATION = {
  /** Tactile press / quick previews. */
  instant: 0.10,
  /** Card flip half, snappy UI. */
  fast: 0.12,
  /** Default card move / deal / modal. */
  base: 0.18,
  /** Foundation bounce, recycle slide. */
  slow: 0.24,
  /** Per-card win-cascade fall (before randomized jitter). */
  cascade: 0.55,
} as const

/** Easing curves. Named curves map to Framer Motion string eases. */
export const EASE = {
  out: 'easeOut',
  in: 'easeIn',
  inOut: 'easeInOut',
  /** Snappy modal/pop curve. */
  modal: [0.4, 0, 0.2, 1] as [number, number, number, number],
  /** Win-cascade vertical bounce curve. */
  bounce: [0.17, 0.67, 0.83, 0.67] as [number, number, number, number],
} as const

/** Spring presets. */
export const SPRING = {
  /** Undo snap-back: firm with a touch of overshoot. */
  undo: { type: 'spring', stiffness: 380, damping: 28 } as Transition,
  /** "You Win!" title pop. */
  win: { type: 'spring', bounce: 0.5 } as Transition,
} as const

/** Common ready-made transitions. */
export const TRANSITION = {
  /** Default card layout/move. */
  move: { duration: DURATION.base, ease: EASE.out } as Transition,
  /** Deal per-card (caller adds `delay`). */
  deal: { duration: DURATION.base, ease: EASE.out } as Transition,
  /** Tactile tap/press. */
  press: { duration: DURATION.instant, ease: EASE.out } as Transition,
  /** Drop-target preview fade. */
  preview: { duration: DURATION.instant } as Transition,
} as const
