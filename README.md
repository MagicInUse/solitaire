# Solitaire

A polished, mobile-first Klondike Solitaire PWA. Plays beautifully in landscape or portrait on any device — drag cards, tap to auto-move, track your stats, and pick up right where you left off.

**▶ [Play now at solitaire.magicapps.dev](https://solitaire.magicapps.dev)**

---

## Features

### Gameplay
- **Klondike rules** — full move validation; draw-1 or draw-3 from stock
- **Drag & drop** — pointer and touch via dnd-kit; drag entire face-up stacks
- **Single-tap to auto-move** — a plain tap (or click) sends a card to the correct foundation; this is the default. Prefer the classic feel? Switch to **double-tap** under **Settings → Options → Controls**
- **Drop previews** — translucent ghost shows exactly where a stack will land
- **Undo** — stepped undo restores board + move count precisely; configurable limit (unlimited / 3 / 1 / off)
- **Hints** — 💡 button highlights the best available move; cycles through all valid moves on repeated taps. A bounded multi-ply look-ahead (`filterUsefulHints`) suppresses purely redundant card-shuffling and only surfaces moves that make immediate progress or provably *unlock* progress within a few plies — including foundation back-moves that unbury hidden tableau cards. Highlights both the source and destination of each hint
- **AI4ME auto-player** — an optional one-tap solver that plays the game for you. A greedy engine takes every strictly-progressive move, and a bounded breadth-first **planner** (`engine/planner.ts`) takes over in tangled mid-game and all-face-up endgame positions to drive the shortest line straight to a full clear. Toggle the button and tune its speed (Slow / Normal / Fast) in **Settings → Assist**; Slow and Normal flash each card before moving so you can follow along
- **Dead-game detection** — shows a modal the moment the game is no longer winnable. Detection is two-stage: a strict-liveness check confirms whether *any* legal move exists, and a planner-backed `isStuckGame` check then asks whether any **progress** or **win** is still reachable. Once only reversible King/stack shuffles remain — moves that push cards around without ever advancing — the game is declared over ("No Winning Moves Left") even though the board is technically still movable
- **Auto-complete** — cascades remaining cards to foundations when the game is won
- **Win screen** — celebration overlay with **New Game** and **Settings** shortcuts rendered above the card cascade
- **Persisted game state** — game survives page reloads and app restarts via `localStorage`

### Scoring Modes
| Mode | HUD | Leaderboard |
|------|-----|-------------|
| **Standard** | ⏱ timer + ★ formula score | ✅ recorded |
| **Vegas** | 💵 profit/loss ($5/card − $52 entry) | ✅ recorded with $ prefix |
| **Casual** | moves only | ❌ win streaks still tracked |

### Rules & Difficulty
- **Draw mode** — draw 1 or draw 3
- **Stock recycles** — unlimited, 3, 2, or 1
- **Undo limit** — unlimited, 3, 1, or disabled
- **Controls** — single-tap (default) or double-tap to auto-move a card to its foundation

### Stats & Leaderboard
- Lifetime stats: games played, won, win %, current streak, best streak, fastest win, best score
- Leaderboard: rolling **7-day top 10** wins sorted by score; resets weekly so the board stays competitive; Vegas scores displayed with a `$` prefix

### Visuals & Options
- **Theme selector** — choose between Standard (green felt), Dark (moody), or unlock the secret Cosmic theme with stars and a moon ✨ (tap the Dark button 5 times in 2 seconds)
- **6 card backs** to choose from
- **Animations toggle** — disable deal / flip / win cascade for low-power preference
- **Reduced motion** — every animation also honours the OS `prefers-reduced-motion` setting, so the game stills itself automatically when the system requests it
- **Deck position** — stock + waste on the left or right
- **Hints toggle** — show or hide the hint button
- **AI4ME toggle + speed** — show or hide the auto-player button and set its pace (Slow / Normal / Fast)
- **Controls** — single-tap (default) or double-tap to auto-move a card to its foundation

### Animations
- **FLIP card transitions** — every card move (play, drag-drop, undo) uses Framer Motion `layoutId` FLIP so cards glide smoothly between piles; `layoutRoot` on the scaled canvas corrects FLIP math at any zoom level
- **Draw from stock** — new waste card slides in horizontally from the stock direction (left-to-right or right-to-left depending on deck position setting)
- **Unified entrance** — every drawn card enters with the same horizontal slide from the stock pile, whether the fan was empty or already populated, so the deal always reads consistently
- **Waste fan fold** — when a new draw arrives, the previous fan of cards collapses back toward the stock before the new card enters, giving a satisfying accordion effect
- **Staggered fan reveal** — fanned waste cards enter with a 70 ms stagger (bottom card first) so the spread feels natural rather than all-at-once
- **Recycle animation** — waste cards fly back to the stock pile in a pure CSS arc (no Framer Motion overhead); top card leads, each subsequent card follows with a 60 ms stagger; overlay fades out after the last card lands, then state resets
- **Undo spring** — undone cards snap back with a spring (`stiffness: 380, damping: 28`) for a tactile "rubber-band" feel
- **Foundation pop-in** — a card landing on a foundation springs up from a slightly smaller scale, giving immediate "snap home" feedback the instant it arrives
- **Hint pulse** — hinted cards glow with a looping platinum-coloured pulse so the suggestion is impossible to miss
- **Consistent cinematography** — shared duration / easing constants (`constants/animations.ts`) keep every motion on the same timing language, and a single `useAnimations()` hook gates all motion on both the in-app toggle and the OS reduced-motion preference

### Layout
- **Adaptive canvas** — fixed 462 × 390 (landscape) or 390 × 750 (portrait) logical canvas, CSS-scaled to fit any viewport; scale capped at 2.5× on large screens. The wider landscape canvas reclaims side felt and spreads the columns to an even gap while keeping edge room for future ambient decorations
- **Portrait & landscape** — layout mode detected reliably on iOS (uses `document.documentElement` dimensions to avoid stale `window.innerWidth` on rotation)
- **Safe-area aware** — respects notch, Dynamic Island, and home indicator insets
- **PWA** — installable on iOS and Android; works fully offline; service-worker update banner

---

## How to Play

1. Tap the **stock pile** to flip cards onto the waste pile.
2. **Drag** cards or stacks between tableau columns — alternating colours, descending rank.
3. **Tap** any card to auto-send it to the correct foundation (or **double-tap** if you switched Controls).
4. Build all four foundation piles from Ace → King to win.
5. Tap **💡 Hint** if you're stuck, or open the menu for **Undo**.

---

## Tech Stack

| | |
|---|---|
| Framework | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build | [Vite 8](https://vitejs.dev) |
| Tests | [Vitest 4](https://vitest.dev) — engine unit tests + seeded AI simulation harness |
| State | [Zustand 5](https://zustand-demo.pmnd.rs) with `persist` middleware |
| Drag & Drop | [dnd-kit 6](https://dndkit.com) |
| Animations | [Framer Motion 12](https://www.framer.com/motion/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) (CSS-first config) |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) + Workbox |

---

## Development

```bash
# Install dependencies
pnpm install

# Start dev server with HMR
pnpm dev

# Type-check + production build
pnpm build

# Run the engine tests + AI simulation harness
pnpm test

# Watch tests during development
pnpm test:watch

# Preview the production build locally
pnpm preview

# Regenerate PWA icons and splash screens
pnpm generate-pwa-assets
```

---

## Project Structure

```
src/
  types/        # Core domain types (Card, Pile, GameState, GameOptions, GameStats)
  constants/    # Canvas dimensions (landscape + portrait)
  engine/       # Pure game logic: rules, deck, gameActions, hints, deadGame,
                #   and the BFS planner (planner.ts) that powers AI4ME + stuck
                #   detection. solver.ts + __tests__ are a test-only oracle and
                #   seeded AI simulation harness that cross-examine production
  utils/        # scoring, hints (re-exports), layout compression, card backs,
                #   drag tracking, aiPlayer (greedy + planner move selection)
  store/        # Zustand stores: game state, player options, lifetime stats
  controllers/  # useGameController, useDeadGameDetector, useAutoComplete, useHintController
  hooks/        # useAIPlayer, useGameScale (viewport → scale + mode), useTimer,
                #   useAnimations (motion gate: in-app toggle + OS reduced-motion)
  components/
    CardFace/   # SVG card face rendering
    CardView/   # Animated card wrapper (flip, layoutId)
    DragStack/  # Multi-card drag overlay
    Foundation/ # Foundation pile drop target
    TableauColumn/  # Tableau column with compressed offset layout
    GameBoard/  # Top-level game controller and HUD (incl. AI4ME button)
    GameCanvas/ # Full-screen felt world + CSS scale boundary
    WinCascade/     # Win animation — cards cascade to foundations
    DeadGameModal/ # Modal shown when no winning moves remain
    menu/          # MenuButton + MenuModal with tabbed panels
      panels/      # NewGame, Rules, Visuals, Options, Assist, Leaderboard
    ui/            # Modal, Button, Switch primitives
```

---

## Attribution

The VeriQuery logo is © VeriQuery.com and is used with permission. While this project is MIT-licensed, the VeriQuery logo may only be used to identify this project and VeriQuery.com.

## License

MIT
