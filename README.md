# Solitaire

A polished, mobile-first Klondike Solitaire PWA. Plays beautifully in landscape or portrait on any device — drag cards, tap to auto-move, track your stats, and pick up right where you left off.

**▶ [Play now at solitaire.magicapps.dev](https://solitaire.magicapps.dev)**

---

## Features

### Gameplay
- **Klondike rules** — full move validation; draw-1 or draw-3 from stock
- **Drag & drop** — pointer and touch via dnd-kit; drag entire face-up stacks
- **Double-click / double-tap** — auto-sends a card to the correct foundation
- **Drop previews** — translucent ghost shows exactly where a stack will land
- **Undo** — stepped undo restores board + move count precisely; configurable limit (unlimited / 3 / 1 / off)
- **Hints** — 💡 button highlights the best available move; cycles through all valid moves on repeated taps; suppresses redundant card-shuffling moves and only suggests productive foundation back-moves (e.g. to unbury hidden tableau cards); highlights both the source and destination of each hint
- **Dead-game detection** — shows a modal when no moves remain; correctly handles games with recycles still permitted by performing a one-level lookahead on each buried waste card: a card that can legally land on the tableau is only counted as "alive" if doing so enables at least one subsequent useful move — preventing the modal from being suppressed by dead-end placements that lead nowhere
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

### Stats & Leaderboard
- Lifetime stats: games played, won, win %, current streak, best streak, fastest win, best score
- Leaderboard: rolling **7-day top 10** wins sorted by score; resets weekly so the board stays competitive; Vegas scores displayed with a `$` prefix

### Visuals & Options
- **6 card backs** to choose from
- **Animations toggle** — disable deal / flip / win cascade for low-power preference
- **Deck position** — stock + waste on the left or right
- **Hints toggle** — show or hide the hint button

### Layout
- **Adaptive canvas** — fixed 390 × 390 (landscape) or 390 × 750 (portrait) logical canvas, CSS-scaled to fit any viewport; scale capped at 2.5× on large screens
- **Portrait & landscape** — layout mode detected reliably on iOS (uses `document.documentElement` dimensions to avoid stale `window.innerWidth` on rotation)
- **Safe-area aware** — respects notch, Dynamic Island, and home indicator insets
- **PWA** — installable on iOS and Android; works fully offline; service-worker update banner

---

## How to Play

1. Tap the **stock pile** to flip cards onto the waste pile.
2. **Drag** cards or stacks between tableau columns — alternating colours, descending rank.
3. **Double-tap** any card to auto-send it to the correct foundation.
4. Build all four foundation piles from Ace → King to win.
5. Tap **💡 Hint** if you're stuck, or open the menu for **Undo**.

---

## Tech Stack

| | |
|---|---|
| Framework | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build | [Vite 6](https://vitejs.dev) |
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
  utils/        # scoring, hints, layout compression, card backs, drag tracking
  store/        # Zustand stores: game state, player options, lifetime stats
  hooks/        # useGameScale (viewport → canvas scale + layout mode), useTimer
  components/
    CardFace/   # SVG card face rendering
    CardView/   # Animated card wrapper (flip, layoutId)
    DragStack/  # Multi-card drag overlay
    Foundation/ # Foundation pile drop target
    TableauColumn/  # Tableau column with compressed offset layout
    GameBoard/  # Top-level game controller and HUD
    GameCanvas/ # Full-screen felt world + CSS scale boundary
    WinCascade/     # Win animation — cards cascade to foundations
    DeadGameModal/ # Modal shown when no moves remain
    menu/          # MenuButton + MenuModal with tabbed panels
      panels/      # NewGame, Rules, Visuals, Options, Leaderboard
    ui/            # Modal, Button, Switch primitives
```

---

## License

MIT

