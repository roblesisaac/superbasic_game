# Lumen-Loop Rotation Physics - Debug Log

## Problem Statement

The Lumen-Loop rotation-to-movement physics was not working correctly. When rotating continuously in one direction (e.g., clockwise), the sprite's movement direction would flip inconsistently instead of maintaining a consistent direction.

## Root Cause

Multiple approaches were attempted, all failing due to the same fundamental issue:

**The problem:** Calculating rotation based on the sprite's position or movement vectors produces different mathematical results depending on which quadrant of the circle you're in. Methods tried:

1. **Cross product** - Sensitive to both radial and tangential movement components
2. **Angle tracking from sprite center** - Angle increase/decrease depends on quadrant position
3. **Tangential velocity projection** - Still position-dependent when calculated from moving sprite

## The Solution (WORKING!)

Borrowed from a working HTML example, the correct approach is:

**Track angle from a FIXED center point (where touch started), not from the sprite**

```typescript
// On touch start - establish fixed center
lumenLoopCenter = { x: touchX, y: touchY };
lumenLoopLastAngle = Math.atan2(touchY - centerY, touchX - centerX);
lumenLoopRotationDelta = 0;

// On touch move - calculate angle from fixed center
const currentAngle = Math.atan2(touchY - centerY, touchX - centerX);

// Calculate delta and normalize
let delta = currentAngle - lastAngle;
while (delta > Math.PI) delta -= Math.PI * 2;
while (delta < -Math.PI) delta += Math.PI * 2;

// Accumulate
rotationDelta += delta;
lastAngle = currentAngle;
```

### Why This Works

- **Position-independent**: Angle is always relative to the fixed touch start point
- **Continuous**: As you rotate around the fixed center, angle changes consistently
- **Simple**: No complex vector math, just angle tracking
- **Robust**: Handles all positions uniformly

### Physics Implementation

Matches the HTML example exactly:

```typescript
const SPEED = 200; // Horizontal speed
const DECAY = 0.95; // Velocity decay when not rotating

if (rotationDelta !== 0) {
  // Set velocity directly based on rotation direction
  const rotationDirection = Math.sign(rotationDelta);
  angularVelocity = rotationDirection * SPEED;
} else {
  // Apply decay when not rotating
  angularVelocity *= DECAY;
  if (Math.abs(angularVelocity) < 0.01) {
    angularVelocity = 0;
  }
}
```

**Key differences from complex approaches:**
- Direct velocity control (no momentum accumulation)
- Simple decay (no complex physics)
- Instant direction response

## Files Modified

1. **`src/defold/runtime/input.ts`**
   - Track rotation from fixed center point (touch start position)
   - Calculate angle delta and accumulate
   - Reset center on touch end

2. **`src/defold/game_objects/rides/lumen_loop.ts`**
   - Simplified `updateLumenLoopState()` to match HTML example
   - Direct velocity control: `velocity = sign(rotationDelta) * SPEED`
   - Simple decay: `velocity *= 0.95`

3. **`src/defold/runtime/game_app.ts`**
   - Disable sprite gravity when Lumen-Loop active (`vy = 0`)
   - Disable ground friction (`onGround = false`)
   - Apply velocity directly from Lumen-Loop

## Testing Results

✅ **Continuous clockwise rotation** - Sprite moves consistently in one direction
✅ **Continuous counterclockwise rotation** - Sprite moves consistently in opposite direction  
✅ **Direction changes** - Instant response when reversing rotation
✅ **Coasting** - Smooth velocity decay when not rotating
✅ **All quadrants** - No direction flips at any position

## Key Learnings

1. **Simplicity wins** - The working solution is simpler than all failed attempts
2. **Fixed reference point** - Using a fixed center (touch start) instead of moving sprite position is crucial
3. **Direct control** - Setting velocity directly is more predictable than momentum-based physics
4. **Match working examples** - When debugging, find a working implementation and match it exactly

## Previous Failed Attempts (Summary)

- **Attempt 1**: Cross product from sprite center - flipped at quadrant boundaries
- **Attempt 2**: Angle tracking with hysteresis - still position-dependent
- **Attempt 3**: Tangential velocity projection - complex and still had issues
- **Attempt 4**: Various dampening/filtering approaches - treating symptoms not cause

All failed because they calculated rotation relative to the **moving sprite** instead of a **fixed point**.

## Additional Features Implemented

### Jump While Lumen-Loop Active
- **Standard jump mechanics**: Works naturally - hold to charge, release to jump
- **Implementation**: Existing `startCharging()` on touch down and `releaseJump()` on touch up work regardless of Lumen-Loop state
- **Gravity override logic**: Only disable gravity when NOT charging AND not moving upward
  - `if (!sprite.charging && sprite.vy >= 0) { sprite.vy = 0; }`
  - Allows jumps to work while maintaining hover effect when idle
- **Preserves state**: Lumen-Loop remains active (angular velocity, halo scale unchanged)
- **Result**: Tap = small jump, hold = charged jump, just like normal gameplay

### Incomplete Loop Reset
- **Problem**: Partial loop rendering persisted if user didn't complete full 360°
- **Solution**: On touch/mouse end, check if `lumenLoopGesture.pendingActivation` is true
- **Reset logic**: Clear `pendingActivation`, `accumulatedAngle`, and `claimedInput` flags
- **Result**: Partial loop disappears, next gesture starts fresh from 0°
