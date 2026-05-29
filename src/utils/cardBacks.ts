/**
 * @module cardBacks
 * Built-in card back designs. Each definition drives both the in-game
 * face-down card rendering (CardFace) and the preview thumbnails in the
 * Card Back settings panel.
 *
 * Design convention: each back has an outer container background, a light
 * inner frame (mimicking real card stock), a thin accent border on the
 * inner frame, and an optional centre icon.
 *
 * Colours/backgrounds are defined as static CSS rules in index.css using the
 * pattern `.card-back-{id}`, `.card-back-{id}-inner`, `.card-back-{id}-border`.
 * Components use `className={`... card-back-${back.id}`}` instead of inline
 * style props so the project lint rule is satisfied.
 */

import type { LucideIcon } from 'lucide-react'
import { Club, Diamond, Heart, Spade, Sparkle } from 'lucide-react'

export interface CardBackDefinition {
  id: string
  label: string
  /** Render the VQ branded logo in the centre (VeriQuery back only). */
  showLogo: boolean
  /** Lucide icon component rendered in the centre when showLogo is false. */
  CenterIcon?: LucideIcon
}

export const CARD_BACKS: CardBackDefinition[] = [
  { id: 'veriquery', label: 'VeriQuery', showLogo: true },
  { id: 'forest',   label: 'Forest',   showLogo: false, CenterIcon: Club },
  { id: 'ocean',    label: 'Ocean',    showLogo: false, CenterIcon: Diamond },
  { id: 'crimson',  label: 'Crimson',  showLogo: false, CenterIcon: Heart },
  { id: 'midnight', label: 'Midnight', showLogo: false, CenterIcon: Sparkle },
  { id: 'slate',    label: 'Slate',    showLogo: false, CenterIcon: Spade },
]

/** Returns the matching definition, or the first (VeriQuery) if not found. */
export function getCardBack(id: string): CardBackDefinition {
  return CARD_BACKS.find((b) => b.id === id) ?? CARD_BACKS[0]
}
