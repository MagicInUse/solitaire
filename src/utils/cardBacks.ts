/**
 * @module cardBacks
 * Built-in card back designs. Each definition drives both the in-game
 * face-down card rendering (CardFace) and the preview thumbnails in the
 * Card Back settings panel.
 *
 * Design convention: each back has an outer container background, a light
 * inner frame (mimicking real card stock), a thin accent border on the
 * inner frame, and an optional centre icon.
 */

import type { CSSProperties } from 'react'

export interface CardBackDefinition {
  id: string
  label: string
  /** CSS applied to the outermost face-down card container. */
  outerStyle: CSSProperties
  /** Background colour of the inner inset frame. */
  innerBg: string
  /** Border colour of the inner inset frame. */
  innerBorder: string
  /** Render the VQ branded logo in the centre (classic back only). */
  showLogo: boolean
  /** Decorative text/symbol rendered in the centre when showLogo is false. */
  centerIcon?: string
}

export const CARD_BACKS: CardBackDefinition[] = [
  {
    id: 'classic',
    label: 'Classic',
    outerStyle: { background: '#1d1e2c' },
    innerBg: '#e9e9e9',
    innerBorder: 'rgba(156, 82, 139, 0.75)',
    showLogo: true,
  },
  {
    id: 'forest',
    label: 'Forest',
    outerStyle: {
      background: 'repeating-linear-gradient(135deg, #0a2e14 0px, #0a2e14 6px, #0c3518 6px, #0c3518 12px)',
    },
    innerBg: '#c8e6c9',
    innerBorder: 'rgba(76, 175, 80, 0.65)',
    showLogo: false,
    centerIcon: '♣',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    outerStyle: {
      background: 'repeating-linear-gradient(-135deg, #091e36 0px, #091e36 6px, #0e2d4d 6px, #0e2d4d 12px)',
    },
    innerBg: '#b3d4f5',
    innerBorder: 'rgba(33, 150, 243, 0.65)',
    showLogo: false,
    centerIcon: '♦',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    outerStyle: {
      background: 'repeating-linear-gradient(135deg, #2e0a0a 0px, #2e0a0a 6px, #3d1010 6px, #3d1010 12px)',
    },
    innerBg: '#f5c6c6',
    innerBorder: 'rgba(239, 83, 80, 0.65)',
    showLogo: false,
    centerIcon: '♥',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    outerStyle: {
      background: 'radial-gradient(ellipse at 35% 35%, #1a1a3e 0%, #050508 100%)',
    },
    innerBg: '#1a1a3a',
    innerBorder: 'rgba(120, 120, 220, 0.45)',
    showLogo: false,
    centerIcon: '✦',
  },
  {
    id: 'slate',
    label: 'Slate',
    outerStyle: {
      background: 'repeating-linear-gradient(60deg, #1e1e1e 0px, #1e1e1e 4px, #2a2a2a 4px, #2a2a2a 10px)',
    },
    innerBg: '#ddd',
    innerBorder: 'rgba(255, 255, 255, 0.25)',
    showLogo: false,
    centerIcon: '♠',
  },
]

/** Returns the matching definition, or the first (Classic) if not found. */
export function getCardBack(id: string): CardBackDefinition {
  return CARD_BACKS.find((b) => b.id === id) ?? CARD_BACKS[0]
}
