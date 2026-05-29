/**
 * Module-level set of card IDs that were just drag-and-dropped.
 *
 * CardView reads this to skip its layoutId for one render after a drop,
 * preventing Framer Motion from re-animating the card from its pre-drag
 * position to its post-drop position (which would double-play the movement).
 *
 * Set by GameBoard.handleDragEnd; cleared via requestAnimationFrame.
 */
export const recentlyDropped = new Set<string>()

/**
 * Module-level flag indicating the player just pressed Undo.
 *
 * CardView reads this during the undo re-render to apply a spring transition
 * instead of the default eased slide, giving the card a satisfying elastic
 * "snap back" feel.
 *
 * Set by the undo handler in GameBoard; cleared via requestAnimationFrame
 * (mirrors the recentlyDropped pattern).
 */
export const justUndid = { current: false }
