/**
 * @module options
 * Player-configurable game settings, persisted across sessions.
 */

/** Number of cards drawn from the stock per click. */
export type DrawMode = 1 | 3

/** Which side of the board the stock + waste piles appear on. */
export type DeckLocation = 'left' | 'right'

/** All configurable game settings. */
export interface GameOptions {
  drawMode: DrawMode
  deckLocation: DeckLocation
  /** ID of the active card back from {@link CARD_BACKS}. */
  cardBackId: string
  animationsEnabled: boolean
  /** SFX toggle — always false until sound assets are implemented. */
  sfxEnabled: boolean
  /** Max times the waste pile can be recycled back to stock per game. */
  stockRecycles: number | 'unlimited'
  /** Max times the player can undo per game. 0 = disabled, 'unlimited' = no cap. */
  undoLimit: number | 'unlimited'
  /** Whether the Hint button is available during play. */
  hintsEnabled: boolean
}

export const DEFAULT_OPTIONS: GameOptions = {
  drawMode: 1,
  deckLocation: 'left',
  cardBackId: 'classic',
  animationsEnabled: true,
  sfxEnabled: false,
  stockRecycles: 'unlimited',
  undoLimit: 'unlimited',
  hintsEnabled: true,
}
