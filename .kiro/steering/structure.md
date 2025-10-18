---
inclusion: always
---

# Project Structure & Architecture

## Directory Layout

```
src/
├── config/           # Game constants (SCREAMING_SNAKE_CASE)
├── defold/           # Core game code (Defold engine pattern)
│   ├── game_objects/ # Entity classes with update()/draw() methods
│   ├── gui/          # UI rendering functions
│   ├── modules/      # Game systems (budget, cards, settings)
│   └── runtime/      # Game loop and state
│       ├── controllers/  # Functional logic modules
│       ├── environment/  # World rendering
│       └── state/        # Global mutable state objects
├── styles/           # CSS
├── utils/            # Utility functions
└── workers/          # Service worker
```

## Architecture Rules

### State Management

- **Mutable global state** - no state management library
- Main state: `gameWorld` object in `src/defold/runtime/state/game_state.ts`
- Access state directly, modify in-place

### Game Loop Pattern

- Location: `src/defold/runtime/game_app.ts`
- Fixed timestep with delta capping (max 0.04s)
- Always update-then-render

### Module Patterns

- **Game objects**: Classes with `update(dt: number)` and `draw(ctx: CanvasRenderingContext2D)` methods
- **Controllers**: Functional modules that operate on state
- **GUI modules**: Pure rendering functions
- **All imports**: Use `.js` extension (TypeScript ESM convention)

### Configuration

- **All constants** go in `src/config/constants.ts`
- Never hardcode magic numbers
- Document tunable parameters

## Naming Conventions

- **Files**: `snake_case.ts` (e.g., `game_state.ts`, `heart_pickup.ts`)
- **Classes**: `PascalCase` (e.g., `Sprite`, `HeartPickup`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `GRAVITY`, `JUMP_MAX`)
- **Functions/variables**: `camelCase` (e.g., `updateWorld`, `gameWorld`)

## Key Entry Points

- `src/main.ts` - App initialization
- `src/defold/runtime/game_app.ts` - Game loop
- `src/config/constants.ts` - All tuning parameters
- `index.html` - Canvas and PWA setup
