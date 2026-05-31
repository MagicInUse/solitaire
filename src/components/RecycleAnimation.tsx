/**
 * @module RecycleAnimation
 * Overlay that animates visible waste cards flying back to the stock pile
 * one by one when the player recycles.
 *
 * Intentionally uses plain CSS transitions rather than Framer Motion.
 * The GameCanvas wraps everything in a `layoutRoot` motion.div; any
 * motion.div elements created here would join FM's projection tree and
 * get FLIP-measured on every state change, causing a visible jump when
 * setFading() triggers a re-render right after the slide completes.
 * CSS transitions are invisible to FM's layout system — no jump.
 */
import { useState, useEffect, useRef } from 'react'
import vqLogo from '../assets/veriquery-logo.png'
import { getCardBack } from '../utils/cardBacks'
import { PADDING, CARD_W, CARD_H, GAP, CANVAS_W } from '../constants/canvas'

const FAN_OFFSET = 14

interface RecycleAnimationProps {
  /** Number of visible waste cards (1 for draw-1, up to 3 for draw-3). */
  visibleWasteCount: number
  /** Which side the stock/waste are on. */
  deckLocation: 'left' | 'right'
  /** Active card back design id. */
  cardBackId: string
  /** Logical canvas width for the current orientation (portrait 390 / landscape 462). */
  canvasW?: number
  /** Pixel gap between the stock and waste piles (portrait 6 / landscape 18). */
  gap?: number
  /** Called after the final card's animation completes. */
  onComplete: () => void
}

export function RecycleAnimation({ visibleWasteCount, deckLocation, cardBackId, canvasW = CANVAS_W, gap = GAP, onComplete }: RecycleAnimationProps) {
  const back = getCardBack(cardBackId)
  // `started` drives the translateX transition (false = initial position, true = stock position).
  // Double-rAF ensures the browser paints the initial state before the transition fires.
  const [started, setStarted] = useState(false)
  const [fading, setFading] = useState(false)
  const doneRef = useRef(false)

  // Single-fire guard for the actual completion callback. Both the opacity
  // transitionend AND the safety timeout below can race to call onComplete;
  // resetStock() must run exactly once or the waste recycles twice.
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  function complete() {
    if (completedRef.current) return
    completedRef.current = true
    onCompleteRef.current()
  }

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setStarted(true))
    })
    return () => cancelAnimationFrame(raf1)
  }, [])

  // Safety net so `isRecycling` can never stick true and freeze the deck.
  // - If there are no visible cards to animate, no transitionend ever fires, so
  //   complete immediately.
  // - Otherwise arm a max-duration timeout: slide (0.22s) + max stagger
  //   (visibleWasteCount * 0.06s) + fade (0.12s) + buffer. If any transition is
  //   skipped (browser quirk, reduced motion, interrupted paint) this still
  //   completes the recycle.
  useEffect(() => {
    if (visibleWasteCount <= 0) {
      complete()
      return
    }
    const maxMs = 220 + visibleWasteCount * 60 + 120 + 250
    const timer = setTimeout(complete, maxMs)
    return () => clearTimeout(timer)
    // complete/onComplete are accessed via refs; only re-arm on count change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleWasteCount])

  const wasteContainerW = visibleWasteCount <= 1 ? CARD_W : CARD_W + (visibleWasteCount - 1) * FAN_OFFSET

  // Canvas-local X positions for stock and waste fan start
  const stockX =
    deckLocation === 'left'
      ? PADDING
      : canvasW - PADDING - CARD_W
  const wasteStartX =
    deckLocation === 'left'
      ? PADDING + CARD_W + gap
      : canvasW - PADDING - CARD_W - gap - wasteContainerW

  // top card (highest i) starts first; bottom card (i=0, isLast) starts last
  const cards = Array.from({ length: visibleWasteCount }, (_, i) => {
    const fromX = wasteStartX + i * FAN_OFFSET
    const delay  = (visibleWasteCount - 1 - i) * 0.06
    const isLast = i === 0
    return { fromX, delay, isLast }
  })

  function handleLastCardEnd(prop: string) {
    if (prop !== 'transform') return
    if (doneRef.current) return
    doneRef.current = true
    setFading(true)
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? 'opacity 0.12s ease-in' : 'none',
      }}
      onTransitionEnd={(e) => {
        if (fading && e.target === e.currentTarget && e.propertyName === 'opacity') {
          complete()
        }
      }}
    >
      {cards.map(({ fromX, delay, isLast }, idx) => (
        <div
          key={idx}
          className={`absolute rounded-[5px] border border-black/25 shadow-[1px_2px_4px_rgba(0,0,0,0.35)] overflow-hidden flex items-center justify-center card-back-${back.id}`}
          style={{
            left: fromX,
            top: PADDING,
            width: CARD_W,
            height: CARD_H,
            transform: started ? `translateX(${stockX - fromX}px)` : 'translateX(0)',
            transition: started ? `transform 0.22s ease-in-out ${delay}s` : 'none',
          }}
          onTransitionEnd={isLast ? (e) => handleLastCardEnd(e.propertyName) : undefined}
        >
          <div className={`absolute inset-1 rounded-xs z-0 pointer-events-none card-back-${back.id}-inner`} />
          <div className={`absolute inset-1 rounded-xs z-2 pointer-events-none border card-back-${back.id}-border`} />
          {back.showLogo ? (
            <img src={vqLogo} className="w-5 h-auto opacity-90 relative z-3 pointer-events-none" alt="" draggable={false} />
          ) : back.CenterIcon ? (
            <back.CenterIcon size={16} fill="currentColor" strokeWidth={0} className="relative z-3 pointer-events-none opacity-35" />
          ) : null}
        </div>
      ))}
    </div>
  )
}
