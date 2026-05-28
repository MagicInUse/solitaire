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

export interface CardBackDefinition {
  id: string
  label: string
  /** Render the VQ branded logo in the centre (classic back only). */
  showLogo: boolean
  /** Decorative text/symbol rendered in the centre when showLogo is false. */
  centerIcon?: string
}

export const CARD_BACKS: CardBackDefinition[] = [
  { id: 'classic',  label: 'Classic',  showLogo: true },
  { id: 'forest',   label: 'Forest',   showLogo: false, centerIcon: '♣' },
  { id: 'ocean',    label: 'Ocean',    showLogo: false, centerIcon: '♦' },
  { id: 'crimson',  label: 'Crimson',  showLogo: false, centerIcon: '♥' },
  { id: 'midnight', label: 'Midnight', showLogo: false, centerIcon: '✦' },
  { id: 'slate',    label: 'Slate',    showLogo: false, centerIcon: '♠' },
]

/** Returns the matching definition, or the first (Classic) if not found. */
export function getCardBack(id: string): CardBackDefinition {
  return CARD_BACKS.find((b) => b.id === id) ?? CARD_BACKS[0]
}
