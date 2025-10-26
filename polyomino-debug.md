# Polyomino Performance Debug Notes

## Issue
Game freezes when using low density values for polyomino generation, specifically:
- `POLYOMINO_DENSITY_OUTER = 0.6`
- `POLYOMINO_DENSITY_INNER = 0.1`

Works fine with:
- `POLYOMINO_DENSITY_OUTER = 0.9`
- `POLYOMINO_DENSITY_INNER = 0.4`

## Current Implementation

### Density Control
Located in `src/defold/runtime/environment/geometry/polyomino.ts`:
```typescript
const POLYOMINO_DENSITY_SINGLE = 0.6; // Single layer blocks
const POLYOMINO_DENSITY_OUTER = 0.9; // Outer layer of double-layer blocks (solid)
const POLYOMINO_DENSITY_INNER = 0.4; // Inner layer of double-layer blocks (porous)
```

### How Density Works
- Density = 1.0 means fully solid (no cells removed)
- Density = 0.1 means only 10% of interior cells remain (90% removed)
- Edge cells are always preserved for structural integrity
- Removal happens in `generateSingleLayer()` function

### Double Layer System
1. `generatePolyomino()` creates single layer shapes
2. `flattenPolyominoEdge()` automatically generates double-layer version when flattening
3. Two layers:
   - **Outer layer**: Uses `POLYOMINO_DENSITY_OUTER` (solid, straight edge)
   - **Inner layer**: Uses `POLYOMINO_DENSITY_INNER` (porous, weathered)
4. Layers are stacked based on edge direction (left/right = horizontal, top/bottom = vertical)

### Caching
- Cache key for single layer: `"seed_minSize_maxSize"`
- Cache key for double layer: `"L_seed_minSize_maxSize_edge"`
- Max cache size: 500 entries
- LRU-style eviction when full

## Attempted Fixes

### 1. Safety Check in Flattening
Added bounds check to skip flattening if dimensions exceed 50 cells:
```typescript
if (maxDimension > 50) {
  return mainCells; // Skip flattening
}
```

### 2. Caching
Added caching to both `generatePolyomino()` and `generatePolyominoWithLayers()`

### 3. Floating Pixel Filtering
Filter out floating pixels before flattening (keep only cells within 80% of bounds)

## Suspected Root Causes

### Theory 1: Sparse Layers Create Large Bounds
- With 0.1 density, inner layer is 90% empty
- Floating pixels might be far apart
- When layers are stacked, combined bounds could be huge
- Flattening tries to fill all gaps between sparse cells

### Theory 2: Cache Bypass
- `flattenPolyominoEdge()` regenerates polyominos each time
- The hash-based seed might not be consistent
- Cache might not be hit effectively

### Theory 3: Iteration Over Sparse Sets
- With very sparse shapes, iterating to find bounds/edges is slow
- Multiple passes over the same sparse set compounds the issue

### Theory 4: Flattening Algorithm
- The flattening loops might create too many cells even with safety check
- Need to profile which specific loop is causing the freeze

## Next Steps to Debug

1. **Add console logging** to track:
   - How many cells are in each layer before/after density application
   - Bounds dimensions before/after stacking
   - Whether safety check is triggered
   - Cache hit/miss rates

2. **Profile the freeze**:
   - Use browser DevTools Performance tab
   - Identify which function is blocking
   - Check if it's generation, flattening, or rendering

3. **Test isolation**:
   - Disable double-layer generation temporarily (`useDoubleLayers = false`)
   - Test with single layer at 0.1 density
   - Test double layer without flattening

4. **Alternative approaches**:
   - Pre-generate a fixed set of polyominos at startup
   - Use simpler shapes for low density (don't stack layers)
   - Limit the number of polyominos generated per frame
   - Use Web Workers for generation

## Temporary Workaround

Keep density values at safe levels:
```typescript
const POLYOMINO_DENSITY_OUTER = 0.9;
const POLYOMINO_DENSITY_INNER = 0.4;
```

## Files Involved

- `src/defold/runtime/environment/geometry/polyomino.ts` - Core generation logic
- `src/defold/runtime/environment/drawables/drawWell.ts` - Well walls (uses polyominos)
- `src/defold/runtime/environment/drawables/drawCliffs.ts` - Cliffs (uses polyominos, has own caching)

## Related Features

- Rock block generation with straight edges and jagged sides
- Floating debris pixels for visual detail
- Notches for inner dimples
- Left edge wobble for variation
