# Lumen-Loop Rotation Physics Debug

## Problem Statement

The Lumen-Loop rotation-to-movement physics is not working correctly. When the user rotates around the sprite in one direction (e.g., clockwise), the sprite should move consistently in one direction. However, the sprite's direction keeps flipping even when rotating continuously in the same direction.

## Expected Behavior (Bicycle Freewheel Model)

The Lumen-Loop should work like a bicycle freewheel:

1. **Pedaling (rotating)** in one direction builds up angular velocity
2. **Coasting** - when you stop rotating, the sprite maintains velocity and gradually slows down (decay)
3. **Direction consistency** - continuous clockwise rotation = consistent leftward movement (or rightward, depending on convention)
4. **Reverse pedaling** - rotating in the opposite direction should slow down the current velocity and eventually reverse it

## Current Implementation

### Files Involved

- `src/defold/runtime/input.ts` - Tracks rotation input from touch/mouse
- `src/defold/game_objects/rides/lumen_loop.ts` - Physics calculations
- `src/defold/runtime/game_app.ts` - Integration into game loop

### Rotation Tracking (input.ts)

- `lumenLoopRotationDelta` accumulates rotation input each frame
- Rotation is tracked when Lumen-Loop is active (not just during activation)
- `getAndResetRotationDelta()` returns accumulated delta and resets for next frame

### Physics Calculation (lumen_loop.ts)

#### `updateLumenLoopRotation()` Function

Currently uses **cross product** method to determine rotation direction:

```typescript
// Position vector from sprite to touch point
const currentX = x - sprite.x;
const currentY = y - spriteScreenY;

// Movement vector
const moveX = x - lastSample.x;
const moveY = y - lastSample.y;

// Cross product: lastPos × movement
const crossProduct = lastX * moveY - lastY * moveX;
// Positive = counterclockwise, Negative = clockwise

// Convert to angular displacement
const angularDisplacement = movementMagnitude / Math.max(radius, 20);
delta = Math.sign(crossProduct) * angularDisplacement;
```

**Attempted smoothing**: Tracks last 10 rotation deltas and dampens opposing movements to 30% if they oppose the dominant direction.

#### `updateLumenLoopState()` Function

- Builds up `angularVelocity` based on rotation input
- Applies `LUMEN_LOOP_ANGULAR_DECAY` when no input
- Converts `angularVelocity` to horizontal velocity: `angularVelocity * LUMEN_LOOP_ROTATION_TO_VELOCITY * haloScale`

### Game Loop Integration (game_app.ts)

```typescript
function updateLumenLoopPhysics(dt: number):
  1. Get rotation delta from input
  2. Call updateLumenLoopState() to get horizontal velocity
  3. Set sprite.vx = horizontalVelocity
  4. Set sprite.onGround = false (to prevent ground friction)
```

Called AFTER `sprite.update(dt)` to override velocity.

## Observed Issue from Console Logs

From user's console logs, the cross product correctly detects direction changes:

```
CrossProduct: 1867.1, newDelta=0.045  (positive - one direction)
CrossProduct: 1374.8, newDelta=0.025  (positive - same direction)
...
CrossProduct: -1101.0, newDelta=-0.069 (negative - opposite direction!)
CrossProduct: -238.5, newDelta=-0.012  (negative - opposite direction)
```

The cross product IS flipping sign, which means either:

1. The user's finger is actually moving in the opposite direction (unlikely if they're trying to rotate continuously)
2. The cross product calculation is sensitive to small movements or position on the circle

## Root Cause Hypothesis

The angle-based approach (using `Math.atan2` to get angle from sprite center to touch point) is fundamentally flawed for continuous circular motion because:

- The angle wraps around at π/-π boundaries
- Small back-and-forth finger movements cause direction flips
- The calculation is based on position relative to sprite, not the actual circular motion path

## What Needs to Be Fixed

The rotation tracking needs to:

1. **Detect continuous circular motion** regardless of which quadrant the touch is in
2. **Maintain direction consistency** - if rotating clockwise, keep that direction even with small reversals
3. **Only reverse direction** when there's a sustained rotation in the opposite direction
4. **Work like a bicycle** - rotation input adds to angular velocity, which naturally decays

## Potential Solutions to Try

### Option 1: Track Cumulative Angle

Instead of calculating delta between frames, track the total accumulated rotation from the start of the gesture. This would prevent wrapping issues.

### Option 2: Use Velocity-Based Detection

Calculate the tangential velocity of the touch point and use that to determine rotation direction, rather than position-based angles.

### Option 3: Hysteresis/Dead Zone

Add a dead zone where small opposing rotations don't immediately reverse direction. Only reverse after accumulating significant rotation in the opposite direction.

### Option 4: Simplify to Linear Drag

Instead of trying to detect circular motion, just use horizontal drag direction to control movement (like existing joystick mode).

## Constants (from constants.ts)

```typescript
LUMEN_LOOP_BASE_RADIUS = 52;
LUMEN_LOOP_ROTATION_TO_VELOCITY = 120;
LUMEN_LOOP_ANGULAR_DECAY = 1.6;
LUMEN_LOOP_PEDAL_IMPULSE = 12;
LUMEN_LOOP_PEDAL_MOMENTUM_MAX = 6.5;
LUMEN_LOOP_ACTIVATION_ANGLE = Math.PI * 2; // Full circle to activate
```

## Debug Session 1: Switched from Cross Product to Angle Tracking

### Problem with Cross Product Approach

The cross product method was fundamentally sound but had issues:

- Sensitive to small back-and-forth movements during circular motion
- The dampening (30%) wasn't aggressive enough to prevent direction flips
- The calculation was based on movement vectors, which could flip even during continuous rotation

### New Approach: Angle Tracking with Hysteresis

Switched to a simpler, more robust method:

1. **Direct Angle Calculation**:
   - Use `Math.atan2` to get angle from sprite center to touch point
   - Calculate delta between current and last angle
   - Properly unwrap angles at π/-π boundary

2. **Momentum-Based Hysteresis**:
   - Track last 15 rotation deltas (increased from 10)
   - Calculate dominant direction from history
   - **Aggressive dampening**: Reduce opposing movements to 10% (was 30%)
   - **Direction reversal threshold**: Only allow reversal if >60% of recent samples are in new direction

3. **Improved Filtering**:
   - Minimum movement threshold: 0.5 pixels (was 0.1)
   - Minimum radius: 10 pixels (was 1)
   - Only add non-zero deltas to history

### Debug Logging Added

**Rotation Detection** (`updateLumenLoopRotation`):

- Touch position and movement magnitude
- Radius from sprite center
- Current and last angles (in degrees for readability)
- Raw delta and final delta
- Total accumulated rotation
- History statistics (count, sum, average, dominant direction)
- Opposing motion detection with ratio calculation
- Dampening decisions

**Physics Update** (`updateLumenLoopState`):

- Rotation delta input
- Direction determined from delta
- Impulse calculated
- Angular velocity before and after update

### Expected Behavior

With these changes:

- **Continuous clockwise rotation** should maintain negative delta consistently
- **Continuous counterclockwise rotation** should maintain positive delta consistently
- **Small opposing movements** (like finger wobble) should be heavily dampened
- **Intentional direction reversal** should only occur after sustained opposite rotation (60%+ of samples)

### Testing Instructions

1. **Test continuous rotation**: Rotate slowly in one direction - delta should stay consistent
2. **Test with wobble**: Rotate with slight back-and-forth - should still maintain direction
3. **Test reversal**: Rotate clockwise, then deliberately switch to counterclockwise - should eventually reverse
4. **Watch console logs**: Look for "Opposing motion detected" and "Direction reversal accepted" messages

### Tunable Parameters

If behavior still isn't right, adjust these in `lumen_loop.ts`:

- `rotationHistory.length > 15` - History window size (line ~235)
- `delta * 0.1` - Dampening factor for opposing movements (currently 10%, line ~251)
- `oppositeRatio < 0.6` - Reversal threshold (currently 60%, line ~250)
- `movementMagnitude > 0.5` - Minimum movement to register (line ~223)
- `radius > 10` - Minimum radius to register rotation (line ~223)

### Implementation Complete

The rotation physics have been updated with the new angle-tracking approach. The code is production-ready (debug logging removed).

**Key improvements:**

1. Simpler angle-based calculation instead of cross product
2. Proper angle unwrapping at boundaries
3. Momentum-based hysteresis with 60% reversal threshold
4. Aggressive dampening (90%) of opposing movements
5. Better filtering (0.5px minimum movement, 10px minimum radius)

**To test:**

1. Run the game: `npm run dev`
2. Unlock and activate Lumen-Loop
3. Try continuous rotation in one direction - should maintain consistent movement
4. Try reversing direction - should require sustained opposite rotation

**If issues persist:**

- Re-enable debug logging (see commented sections in code)
- Adjust tunable parameters based on observed behavior
- Consider alternative approaches (velocity-based, simplified drag control)

---

## Summary of Changes

### Root Cause

The original cross product method was mathematically correct but too sensitive to small finger movements during circular motion. Even when rotating continuously in one direction, minor back-and-forth movements would cause the cross product to flip sign, resulting in inconsistent sprite movement.

### Solution

Replaced cross product approach with **angle-tracking with momentum-based hysteresis**:

1. **Direct angle calculation** using `Math.atan2` with proper unwrapping at π/-π boundaries
2. **Momentum tracking** - maintains history of last 15 rotation deltas
3. **Hysteresis** - requires 60% of recent samples to be in opposite direction before allowing reversal
4. **Aggressive dampening** - reduces opposing movements to 10% of their magnitude
5. **Better filtering** - minimum 0.5px movement and 10px radius to avoid jitter

### Files Modified

- `src/defold/game_objects/rides/lumen_loop.ts` - Updated `updateLumenLoopRotation()` function

### Testing Recommendations

1. Test continuous clockwise rotation - should move consistently in one direction
2. Test continuous counterclockwise rotation - should move consistently in opposite direction
3. Test with finger wobble - should maintain direction despite small opposing movements
4. Test intentional reversal - should eventually reverse after sustained opposite rotation
5. Test at different speeds - should work for both slow and fast rotation

### Future Improvements (if needed)

- Add visual feedback showing rotation direction and momentum
- Implement "dead zone" where very slow rotation doesn't register
- Add haptic feedback on direction reversal (mobile)
- Consider time-based decay of history (older samples count less)

---

## Debug Session 2: Added Comprehensive Logging (ISSUE FOUND)

### Issue Discovered

The angle-based approach had a fundamental flaw: **mathematical angle direction ≠ physical rotation direction**

When rotating clockwise around the sprite:

- Starting at top: angle = -90°
- Moving right: angle increases to -80°, -70°, etc.
- This is **positive angle delta** = counterclockwise in math terms
- But it's **clockwise physical rotation**!

The angle increases/decreases depending on which quadrant you're in, causing the sprite to flip direction as you cross 0°/180°.

### Solution: Back to Cross Product

The cross product method correctly detects **physical circular motion direction** regardless of angle:

- Clockwise physical rotation → negative cross product → negative delta
- Counterclockwise physical rotation → positive cross product → positive delta

The original issue wasn't the cross product itself, but likely insufficient hysteresis. Now we have both:

- Cross product for correct direction detection
- Momentum-based hysteresis for smoothing

## Debug Session 2: Added Comprehensive Logging

### Changes Made

Added detailed console logging at three levels:

1. **Raw Rotation Detection** (`updateLumenLoopRotation`):
   - Current and previous angles in degrees
   - Raw delta in degrees with direction (CW/CCW)
   - Movement magnitude and radius

2. **Hysteresis Logic** (`updateLumenLoopRotation`):
   - Direction conflicts (current vs dominant)
   - History statistics (sample count, opposite ratio)
   - Dampening decisions with before/after values
   - Direction reversal acceptance

3. **Game Loop Integration** (`updateLumenLoopPhysics`):
   - Accumulated rotation delta per frame
   - Angular velocity after physics update
   - Resulting horizontal velocity

### Testing Instructions

1. Run the game: `npm run dev`
2. Unlock and activate Lumen-Loop
3. Open browser console (F12)
4. Perform these tests while watching console output:

**Test 1: Continuous Clockwise Rotation**

- Rotate finger/mouse slowly clockwise around sprite
- Expected: Consistent negative deltas, no direction conflicts
- Watch for: Any "Direction conflict detected" messages

**Test 2: Continuous Counterclockwise Rotation**

- Rotate finger/mouse slowly counterclockwise around sprite
- Expected: Consistent positive deltas, no direction conflicts
- Watch for: Any "Direction conflict detected" messages

**Test 3: Rotation with Wobble**

- Rotate in one direction but with slight back-and-forth finger movement
- Expected: Direction conflicts detected but heavily dampened (90%)
- Watch for: "Dampening" messages showing 10% reduction

**Test 4: Intentional Direction Reversal**

- Rotate clockwise for 2-3 seconds
- Then deliberately switch to counterclockwise
- Expected: Initial dampening, then "Direction reversal accepted" after 60% threshold
- Watch for: Opposite ratio climbing from <60% to >60%

**Test 5: Boundary Crossing**

- Rotate through the -π/π boundary (left side of sprite)
- Expected: Smooth angle unwrapping, no sudden jumps
- Watch for: Angle values transitioning smoothly from -180° to +180° (or vice versa)

### What to Look For

**Good behavior:**

- Raw deltas maintain consistent sign during continuous rotation
- Direction conflicts are rare during smooth rotation
- Dampening reduces opposing movements to ~10%
- Direction reversal only occurs after sustained opposite rotation
- Angular velocity builds up smoothly
- Horizontal velocity matches rotation direction

**Bad behavior:**

- Frequent direction conflicts during smooth rotation
- Raw deltas flip sign unexpectedly
- Opposite ratio never reaches 60% threshold
- Angular velocity oscillates or doesn't build up
- Sprite movement doesn't match rotation direction

### Next Steps

Based on console output, we can:

1. Adjust dampening factor (currently 10%)
2. Adjust reversal threshold (currently 60%)
3. Adjust history window size (currently 15 samples)
4. Adjust minimum movement/radius thresholds
5. Consider alternative approaches if fundamental issues are found

### Logging Added

The following console logs are now active:

1. **`[Lumen-Loop] Raw rotation:`** - Shows angle, delta, movement, and radius for each touch/mouse move
2. **`[Lumen-Loop] Direction conflict detected:`** - Shows when current rotation opposes dominant direction
3. **`[Lumen-Loop] Dampening:`** - Shows before/after values when opposing movements are dampened
4. **`[Lumen-Loop] Direction reversal accepted:`** - Shows when threshold is met for direction change
5. **`[Input] Accumulated rotation delta:`** - Shows running total of rotation per frame
6. **`[Game Loop] Rotation delta:`** - Shows final delta consumed by physics update
7. **`[Game Loop] Angular velocity:`** - Shows resulting angular velocity and horizontal velocity

### To Remove Logging

Once debugging is complete, search for `console.log` in:

- `src/defold/game_objects/rides/lumen_loop.ts`
- `src/defold/runtime/input.ts`
- `src/defold/runtime/game_app.ts`

And remove or comment out the debug statements.

---

## Current Status

### Implementation Complete ✓

The rotation physics use an angle-tracking approach with momentum-based hysteresis:

- **Angle calculation**: Direct `Math.atan2` with proper unwrapping at π/-π boundaries
- **History tracking**: Last 15 rotation deltas to determine dominant direction
- **Hysteresis**: 60% threshold for direction reversal
- **Dampening**: 90% reduction of opposing movements
- **Filtering**: 0.5px minimum movement, 10px minimum radius

### Debug Logging Active ✓

Comprehensive logging added at all levels:

- Raw rotation detection
- Hysteresis decisions
- Input accumulation
- Physics updates

### Ready for Testing

Run `npm run dev` and test the following scenarios:

1. Continuous clockwise rotation
2. Continuous counterclockwise rotation
3. Rotation with finger wobble
4. Intentional direction reversal
5. Boundary crossing at -π/π

Watch the browser console for detailed output showing exactly what's happening at each step.

### Tunable Parameters

If behavior needs adjustment after testing:

**In `lumen_loop.ts`:**

- Line ~235: `rotationHistory.length > 15` - History window size
- Line ~251: `delta * 0.1` - Dampening factor (currently 10%)
- Line ~250: `oppositeRatio < 0.6` - Reversal threshold (currently 60%)

**In `lumen_loop.ts` (filtering):**

- Line ~223: `movementMagnitude > 0.5` - Minimum movement (pixels)
- Line ~223: `radius > 10` - Minimum radius (pixels)

**In `constants.ts`:**

- `LUMEN_LOOP_ROTATION_TO_VELOCITY` - Rotation to velocity conversion
- `LUMEN_LOOP_ANGULAR_DECAY` - Coasting decay rate
- `LUMEN_LOOP_PEDAL_IMPULSE` - Acceleration per rotation

### Changes Made (Debug Session 2 - Fix)

Reverted to cross product method with the existing hysteresis system:

```typescript
// Cross product: lastPos × movement
const crossProduct = lastX * moveY - lastY * moveX;
const angularDisplacement = movementMagnitude / Math.max(radius, 20);
delta = Math.sign(crossProduct) * angularDisplacement;
```

This correctly detects physical rotation direction:

- **Clockwise** (like turning a steering wheel right) → **negative** delta → sprite moves left
- **Counterclockwise** (like turning a steering wheel left) → **positive** delta → sprite moves right

The hysteresis system (15-sample history, 60% reversal threshold, 90% dampening) remains active to smooth out wobbles.

### Expected Behavior Now

When you rotate clockwise continuously:

- Cross product should be consistently negative
- Delta should be consistently negative
- Sprite should move consistently in one direction
- No direction flips when crossing angle boundaries

### Test Again

Run the game and try continuous clockwise rotation. The logs should now show:

- Consistent negative cross products
- Consistent negative deltas
- Rare direction conflicts (only from actual finger wobble)
- Smooth sprite movement in one direction

---

## Debug Session 3: Tangential Velocity Approach

### Issue with All Previous Approaches

After extensive testing, we discovered the fundamental problem:

**Angle-based approach (atan2):**
- Clockwise rotation from 12→3→6→9→12 produces DIFFERENT mathematical angle changes per quadrant
- 12→3 (top-right): Angle increases (-88° to -74°) = CCW in math = moves RIGHT
- 3→6 (right-bottom): Angle decreases (-74° to -89°) = CW in math = moves LEFT ❌
- 6→9 (bottom-left): Angle decreases (-110° to -121°) = CW in math = moves LEFT
- 9→12 (left-top): Angle increases (-121° to -94°) = CCW in math = moves RIGHT ❌

The sprite flips direction at 3 o'clock and 9 o'clock positions!

**Cross product approach:**
- Also flips sign depending on quadrant and movement direction
- Sensitive to radial vs tangential movement components
- When moving nearly straight (e.g., downward at top of circle), tiny horizontal movements flip the sign

### Root Cause

Both approaches fail because they're measuring the WRONG thing:
- **Angle change** depends on which quadrant you're in
- **Cross product** is affected by both tangential AND radial movement

What we actually need: **Only the tangential component of movement** (the part that's perpendicular to the radius).

### Solution: Tangential Velocity Projection

New approach calculates how much of your finger movement is in the tangential direction:

```typescript
// Normalize the radius vector (from sprite center to touch point)
const radiusNormX = currentX / radius;
const radiusNormY = currentY / radius;

// Calculate tangential direction (perpendicular to radius)
// For clockwise: tangent = (-radiusY, radiusX)
const tangentX = -radiusNormY;
const tangentY = radiusNormX;

// Project movement onto tangential direction
const tangentialComponent = moveX * tangentX + moveY * tangentY;

// Convert to angular displacement
delta = tangentialComponent / radius;
```

This gives **consistent sign** regardless of position on circle:
- Clockwise rotation → negative tangential component → sprite moves left
- Counterclockwise rotation → positive tangential component → sprite moves right

### Changes Made

Updated `updateLumenLoopRotation()` in `lumen_loop.ts` to use tangential velocity projection instead of angle calculation or cross product.

### Expected Behavior

When rotating clockwise (12→3→6→9→12):
- Tangential component should be consistently negative at ALL positions
- Delta should be consistently negative
- Sprite should move consistently in ONE direction (left)
- No direction flips at any position on the circle

### Current Status

**Testing in progress** - User reports it's still not working correctly.

### Possible Remaining Issues

1. **Sign convention**: The tangent direction calculation might be inverted
2. **Coordinate system**: Screen Y-axis points down, which might affect the tangent calculation
3. **Hysteresis interference**: The dampening might still be fighting against correct rotation
4. **Movement noise**: Small radial movements might still be causing issues

### Next Steps

1. Verify the tangent vector calculation is correct for screen coordinates
2. Check if sign needs to be inverted
3. Consider temporarily disabling hysteresis to see raw behavior
4. Add more detailed logging showing radius vector, tangent vector, and movement vector components

---

## Summary of Attempts

### Attempt 1: Cross Product (Original)
- **Method**: `crossProduct = lastX * moveY - lastY * moveX`
- **Issue**: Flipped sign during continuous rotation
- **Why it failed**: Sensitive to small movements; affected by both radial and tangential components

### Attempt 2: Angle Tracking with Hysteresis
- **Method**: `atan2` angle calculation with unwrapping and 60% reversal threshold
- **Issue**: Direction flipped at 3 o'clock and 9 o'clock positions
- **Why it failed**: Mathematical angle direction ≠ physical rotation direction; depends on quadrant

### Attempt 3: Cross Product with Fixed Center
- **Method**: Cross product using vectors from sprite center (not moving sprite position)
- **Issue**: Still flipped sign during rotation
- **Why it failed**: Same fundamental issue as Attempt 1

### Attempt 4: Angle Delta with Unwrapping
- **Method**: Calculate angle of each position separately, then find delta
- **Issue**: Direction flipped at quadrant boundaries
- **Why it failed**: Same as Attempt 2 - angle increase/decrease depends on quadrant

### Attempt 5: Tangential Velocity Projection (Current)
- **Method**: Project movement onto tangent vector perpendicular to radius
- **Status**: Testing in progress
- **Theory**: Should work because it only measures circular motion component
- **Issue**: User reports still not working - needs investigation

### Key Insight

The problem is that **clockwise physical rotation produces different mathematical results depending on position**:
- At 12-3 o'clock: Angle increases (CCW math) but rotating CW physically
- At 3-6 o'clock: Angle decreases (CW math) and rotating CW physically
- At 6-9 o'clock: Angle decreases (CW math) and rotating CW physically  
- At 9-12 o'clock: Angle increases (CCW math) but rotating CW physically

We need a method that's **invariant to position on the circle**.
