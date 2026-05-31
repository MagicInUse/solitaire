/**
 * @module engine/rng
 * Deterministic, seedable pseudo-random number generator.
 *
 * Why this exists: the production shuffle previously called `Math.random()`
 * directly, so a deal could never be reproduced.  A bad dead-game / hint / AI
 * decision was therefore impossible to replay or freeze as a regression
 * fixture.  Seeding the shuffle makes every deal reproducible from a short
 * string, which is the keystone of the diagnostic harness.
 *
 * Implementation: `xmur3` hashes an arbitrary string into a 32-bit seed, and
 * `mulberry32` turns that seed into a fast, well-distributed PRNG.  Both are
 * tiny, dependency-free, and produce identical sequences across platforms.
 */

/** A deterministic random source. Returns a float in the half-open range [0, 1). */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number
  /** The string seed this generator was created from. */
  readonly seed: string
}

/**
 * Hashes a string into a 32-bit unsigned integer seed (xmur3).
 * Two equal strings always produce the same seed; small changes diffuse well.
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/**
 * mulberry32 — a fast 32-bit PRNG with a full 2^32 period.
 * Given the same numeric seed it always yields the same sequence.
 */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Creates a deterministic {@link Rng} from a string seed.
 *
 * @param seed - Any string. The same seed always produces the same sequence.
 * @returns An {@link Rng} exposing `next()` and the original `seed`.
 */
export function makeRng(seed: string): Rng {
  const seedFn = xmur3(seed)
  const next = mulberry32(seedFn())
  return { next, seed }
}

/**
 * Generates a fresh, hard-to-collide random seed string for a new game.
 * Uses `crypto.getRandomValues` when available, falling back to `Math.random`.
 */
export function randomSeed(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(2)
    cryptoObj.getRandomValues(buf)
    return `${buf[0].toString(36)}${buf[1].toString(36)}`
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}
