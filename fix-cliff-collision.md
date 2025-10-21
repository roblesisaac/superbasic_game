## Cliff Collision Status – Notes (2025-10-20)

### Current Approach
- Cliffs are generated procedurally in `src/defold/gui/drawCliffs.ts`.
- Rendering still uses the polyomino-based segments (horizontal and diagonal/arc pieces).
- For collision we now export helper functions:
  - `prepareCliffField(canvasWidth, cliffStartWorld, expansionBottomWorld)` ensures segments exist down to the depth we care about.
  - `getCliffCollisionRects(rangeTop, rangeBottom)` returns temporary AABB strips (vertical wall slices + small ledge rectangles) in world coordinates.
- In `src/defold/game_objects/sprite.ts` we:
  1. Call `prepareCliffField()` each update before physics.
  2. Generate a stack of cliff rects for the sprite’s current vertical span.
  3. Push those rects through the existing ride/gate collision pipeline (same logic as surfaces).
- Cliff rects are tagged with `collisionType: 'cliff'` so ride/gate callbacks are skipped.

### Observed Problems
- The sprite helps for perfectly vertical columns, but *diagonal or arc segments still collide early*: the generated rects poke out from the visual wall, so the sprite bumps before touching the art.
- Adjusting the wall thickness to a single `CELL_SIZE` still leaves offset on slopes, because each diagonal sample generates an axis-aligned strip. The strip’s width cannot perfectly follow the angled polyomino shape, so it always contains “empty” space.
- The sprite’s bounding box entirely relies on AABBs. When the wall leans inwards, the true surface is at an angle but our rectangles remain axis-aligned, producing a conservative boundary. Ledges are fine (since they’re horizontal), but arcs/diagonals need a better approximation.

### Attempts So Far
1. Generated cliff strips at each sample (step ~4px) with width equal to `CELL_SIZE`.
2. Stored all geometry in world coordinates (fixed earlier bug where they were local).
3. Reduced `CLIFF_CLEARANCE` to 0 and kept thickness minimal.
4. Tried adjusting `prepareCliffField` bounds to ensure enough segments exist.

### Next Ideas
- Instead of AABB strips, approximate the diagonal face using smaller rotated vectors or slope-aware collision (e.g., compute normal from two nearby samples and project the sprite’s position onto that normal).
- Another option: generate more, thinner vertical slices but shrink them by the angle offset, effectively stepping the actual diagonal with many micro-AABBs.
- Or compute a polygon outline for each segment and feed it into a SAT-style collision (heavier change).

### Quick Debug Checklist
- `getCliffCollisionRects()` is the main place to tweak: adjust sampling `step`, compute actual interior edge minus a tiny epsilon (maybe convert to `edge +/- cos(theta) * thickness`).
- Log the generated rects for a slope segment; compare to visual wall.
- Consider caching per-segment slopes to rebuild thicker rects aligned more tightly.
