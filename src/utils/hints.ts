/**
 * @module utils/hints
 * @deprecated Backward-compatibility shim.
 * All logic has moved to engine/hints.ts and engine/deadGame.ts.
 * Callers should migrate to importing directly from those modules.
 *
 * This file is intentionally kept so that existing imports (GameBoard,
 * aiPlayer, etc.) continue to work without change until Phase 5 of the
 * refactor updates each consumer.
 */

export { computeHints, filterUsefulHints } from '../engine/hints'
export { isDeadGame } from '../engine/deadGame'
