/**
 * @module options
 * Player-configurable game settings, persisted across sessions.
 */

/** Number of cards drawn from the stock per click. */
export type DrawMode = 1 | 3

/** Which side of the board the stock + waste piles appear on. */
export type DeckLocation = 'left' | 'right'

/**
 * Scoring/tracking mode for the current game.
 * - `standard` — formula-based score, timer shown, recorded to leaderboard
 * - `vegas`     — $-52 entry + $5 per foundation card; leaderboard shows profit
 * - `casual`    — no timer, no score, win/loss streaks still tracked but no leaderboard entry
 */
export type ScoringMode = 'standard' | 'vegas' | 'casual'

/** How fast the AI4ME auto-player executes moves. */
export type AISpeed = 'slow' | 'normal' | 'fast'

/**
 * How a tap/click on a card moves it.
 * - `single-tap` — one tap auto-moves the card (foundation-first). Default.
 * - `double-tap` — legacy behaviour: a double-tap/double-click auto-moves.
 */
export type InteractionMode = 'single-tap' | 'double-tap'

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
  /** Scoring/leaderboard mode. */
  scoringMode: ScoringMode
  /** Speed of the AI4ME auto-player. */
  aiSpeed: AISpeed
  /** Whether the AI4ME button is visible during play. */
  showAI4ME: boolean
  /** How a tap/click on a card moves it (single-tap auto-move vs legacy double-tap). */
  interactionMode: InteractionMode
}

export const DEFAULT_OPTIONS: GameOptions = {
  drawMode: 1,
  deckLocation: 'left',
  cardBackId: 'veriquery',
  animationsEnabled: true,
  sfxEnabled: false,
  stockRecycles: 'unlimited',
  undoLimit: 'unlimited',
  hintsEnabled: true,
  scoringMode: 'standard',
  aiSpeed: 'normal',
  showAI4ME: false,
  interactionMode: 'single-tap',
}
