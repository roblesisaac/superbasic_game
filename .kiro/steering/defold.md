---
inclusion: always
---

# Defold Engine Compatibility

Code is structured for future porting to Defold game engine.

## Design Principles

- Use Defold-like patterns: game objects with `update()` and `draw()` methods
- Separate game logic from rendering
- Avoid browser-specific APIs in core game logic where possible
- Keep state management simple and explicit
- Use message-passing patterns between systems when appropriate

## Naming

The `src/defold/` directory follows Defold conventions to ease future migration.
