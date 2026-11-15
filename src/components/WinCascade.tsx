import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy } from 'lucide-react'
import type { Card, Pile } from '../types/cards'
import { CardFace } from './CardFace'
import { CARD_W, CARD_H, CANVAS_H, CANVAS_H_PORTRAIT, CANVAS_W_PORTRAIT, CANVAS_W_LANDSCAPE } from '../constants/canvas'
import { useAnimations } from '../hooks/useAnimations'
import { useGameScale } from '../hooks/useGameScale'
import { useGameStore } from '../store/useGameStore'
import { makeRng } from '../engine/rng'

interface WinCascadeProps {
  active: boolean
  /** Foundation piles — used to know winning is real (52 cards placed). */
  foundations: [Pile, Pile, Pile, Pile]
  onNewGame?: () => void
  onOpenSettings?: () => void
}

interface FallingCard {
  id: string
  card: Card
  x: number
  delay: number
  duration: number
  rotation: number
}

/**
 * Full-screen win celebration overlay.
 *
 * When `active` is true, deals all 52 cards from the top of the viewport
 * in a staggered cascade. Cards fall with slight rotation and bounce at
 * the bottom. Click anywhere to dismiss.
 */
export function WinCascade({ active, foundations, onNewGame, onOpenSettings }: WinCascadeProps) {
  const animationsEnabled = useAnimations()
  const { layout } = useGameScale()
  const canvasH = layout === 'portrait' ? CANVAS_H_PORTRAIT : CANVAS_H
  const canvasW = layout === 'portrait' ? CANVAS_W_PORTRAIT : CANVAS_W_LANDSCAPE
  const seed = useGameStore((s) => s.seed)
  const [dismissed, setDismissed] = useState(false)
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    setDismissed(false)
  }
  const visible = active && !dismissed

  // Seeded by the deal so the cascade differs per game but render stays pure
  const cards = useMemo<FallingCard[]>(() => {
    if (!active) return []
    const rng = makeRng(`win-${seed}`)
    return foundations.flatMap(pile => pile).map((card, i) => ({
      id: `wc-${card.id}`,
      card: { ...card, id: `wc-${card.id}`, faceUp: true },
      x: 8 + rng.next() * (canvasW - CARD_W - 16),
      delay: i * 0.04,
      duration: 0.55 + rng.next() * 0.25,
      rotation: (rng.next() - 0.5) * 40,
    }))
  }, [active, foundations, canvasW, seed])

  if (!animationsEnabled || !visible) return null

  return (
    <>
      {/* Darken cover + trophy + buttons: portaled to the viewport so they
          cover the WHOLE screen (including the felt border around the scaled
          canvas) and render at natural size, centered in the viewport — not
          warped or clipped by the canvas CSS scale transform. */}
      {createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              className="fixed inset-0 z-100 flex items-center justify-center bg-black/45 backdrop-blur-[2px] pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                className="text-white text-center select-none flex flex-col items-center"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ delay: 0.15, duration: 0.35, type: 'spring', bounce: 0.5 }}
              >
                <Trophy size={64} strokeWidth={1.25} className="text-yellow-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
                <div className="text-[32px] font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] font-serif mt-1">You Win!</div>
                <div className="flex gap-3 mt-5 justify-center">
                  <button
                    className="px-5 py-2 rounded-lg bg-white text-green-800 text-sm font-semibold border-0 cursor-pointer transition-colors hover:bg-white/90 shadow-md"
                    onClick={(e) => { e.stopPropagation(); setDismissed(true); onNewGame?.() }}
                  >
                    New Game
                  </button>
                  <button
                    className="px-5 py-2 rounded-lg bg-white/25 hover:bg-white/35 text-white text-sm font-semibold border border-white/40 cursor-pointer transition-colors shadow-md backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setDismissed(true); onOpenSettings?.() }}
                  >
                    Settings
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Falling cards: stay INSIDE the scaled canvas so they cascade over the
          board at the correct logical coordinates. z-90 keeps them above the
          board but below the portaled darken cover (z-100). */}
      <AnimatePresence>
        {visible && (
          <motion.div
            className="absolute inset-0 z-90 overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {cards.map((fc) => (
              <motion.div
                key={fc.id}
                style={{
                  position: 'absolute',
                  width: CARD_W,
                  height: CARD_H,
                  left: fc.x,
                  top: 0,
                  pointerEvents: 'none',
                }}
                initial={{ y: -CARD_H - 20, rotate: fc.rotation * 0.5, opacity: 1 }}
                animate={{
                  y: [-(CARD_H + 20), canvasH * 0.65, canvasH * 0.60, canvasH * 0.65],
                  rotate: fc.rotation,
                  opacity: 1,
                }}
                transition={{
                  delay: fc.delay,
                  duration: fc.duration,
                  ease: 'easeIn',
                  times: [0, 0.7, 0.85, 1],
                  y: {
                    delay: fc.delay,
                    duration: fc.duration,
                    ease: [0.17, 0.67, 0.83, 0.67],
                  },
                }}
              >
                <CardFace card={fc.card} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
