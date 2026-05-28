/**
 * @module useSounds
 * Sound effects stub. SFX playback is not yet implemented.
 * The toggle in Options is shown but labelled "Coming soon".
 */

export type SfxEvent = 'CARD_FLIP' | 'CARD_PLACE' | 'CARD_DRAW' | 'DEAL' | 'WIN'

/** Returns a `playSfx` callback. Currently a no-op. */
export function useSounds() {
  return {
    playSfx: (_event: SfxEvent) => {
      // TODO: implement audio playback
    },
  }
}
