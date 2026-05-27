# Solitaire

A clean, mobile-first Klondike Solitaire game built as a Progressive Web App (PWA). Designed for landscape play on phones and tablets — drag cards, double-tap to auto-move to foundations, and pick up right where you left off.

**▶ [Play now at solitaire.magicapps.dev](https://solitaire.magicapps.dev)**

---

## Features

- **Klondike rules** — standard draw-one with full move validation
- **Drag & drop** — pointer and touch support via dnd-kit, with multi-card stack dragging
- **Double-click / double-tap** — auto-sends a card to the correct foundation
- **Drop previews** — translucent card ghost shows where a stack will land
- **Adaptive layout** — fixed canvas scales uniformly to any screen size; tableau columns compress automatically for tall stacks
- **Persisted state** — game survives page reloads via `localStorage`
- **PWA** — installable on iOS and Android; works fully offline

---

## How to Play

1. Click the **stock pile** (top-left) to flip cards onto the waste pile.
2. **Drag** cards between tableau columns — alternating colours, descending rank.
3. **Drag** or **double-click** a card to send it to a foundation — same suit, ascending from Ace.
4. Click the **↺ reset** icon when the stock is empty to recycle the waste pile.
5. Press **New Game** to start over.

---

## Tech Stack

| | |
|---|---|
| Framework | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) |
| Build | [Vite](https://vitejs.dev) |
| State | [Zustand](https://zustand-demo.pmnd.rs) (with `persist` middleware) |
| Drag & Drop | [dnd-kit](https://dndkit.com) |
| PWA | [vite-plugin-pwa](https://vite-pwa-org.netlify.app) |

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
```

---

## Project Structure

```
src/
  types/        # Core domain types (Card, Pile, GameState)
  constants/    # Design-canvas dimensions and layout constants
  utils/        # Layout utilities (tableau column offset compression)
  store/        # Zustand game store (deck, deal, move actions)
  hooks/        # useGameScale — viewport-to-canvas scale factor
  components/   # React components (CardFace, CardView, GameBoard, …)
```

---

## License

MIT

