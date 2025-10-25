# Lumen-Loop Design Document

## Overview

The Lumen-Loop is a momentum-based wheel ride mechanic that transforms player movement into a rolling system. Players activate it through a tap-and-rotate gesture, control horizontal movement by spinning, and can scale the halo with pinch gestures to adjust movement leverage. The system integrates helium injection for floating physics and energy management for stamina-based gameplay.

This design builds upon the existing ride system in SuperBasic Man, adding a new ride type that provides continuous horizontal movement control rather than spawning discrete platform objects.

## Architecture

### System Components

The Lumen-Loop implementation follows the existing Defold-style architecture:

1. **State Management** (`src/defold/runtime/state/game_state.ts`)
   - `LumenLoopState` interface already exists in `gameWorld.lumenLoop`
   - Stores activation status, angular velocity, halo scale, helium amount, and energy

2. **Core Logic** (`src/defold/game_objects/rides/lumen_loop.ts`)
   - Needs extension for tap-to-jump and improved energy mechanics

3. **Input Handling** (`src/defold/runtime/input.ts`)
   - Gesture recognition for rotation, pinch, and tap
   - Already handles rotation tracking and pinch-to-zoom
   - Needs tap-to-jump detection during active Lumen-Loop

4. **Game Loop Integration** (`src/defold/runtime/game_app.ts`)
   - `stepLumenLoop()` function already integrates updates
   - Applies helium lift and velocity override to sprite

### Data Flow

```
Input Events → InputHandler → LumenLoopState → updateLumenLoopState() → Sprite Velocity Override
                                              ↓
                                         drawLumenLoop() → Canvas Rendering
```

## Components and Interfaces

### State Structure (Existing)

```typescript
interface LumenLoopState {
  isUnlocked: boolean; // Skill availability
  isActive: boolean; // Currently riding
  angularVelocity: number; // Momentum accumulator
  rotationAccum: number; // Total rotation for tracking
  haloScale: number; // Size multiplier (0.65-1.75)
  pinchIntent: number; // Pinch gesture delta
  heliumAmount: number; // Float resource (0-3)
  heliumFloatTimer: number; // Bleed tracking
  energy: number; // Shared with main energy bar
  cooldownTime: number; // Jump cooldown
}
```

### Activation Sequence

**Phase 1: Gesture Detection**

- User taps sprite → `shouldBindLumenGesture()` returns true
- `startLumenLoopGesture()` initializes tracking
- Halo begins rendering at tap location (partial arc)

**Phase 2: Progressive Rendering**

- As user rotates, `updateLumenLoopRotation()` accumulates angle
- Halo visual progressively completes based on `accumulatedAngle / (2π)`
- Input is "claimed" after ~120° to prevent conflicts with other gestures

**Phase 3: Activation**

- When `accumulatedAngle >= 2π`, call `activateLumenLoop()`
- Halo fully renders, `isActive` becomes true
- Sprite velocity override system engages

### Rotation Input System

**Momentum Accumulation**

- Rotation delta (radians) converted to pedal impulse
- Impulse scaled by inverse of inertia multiplier (larger halos = harder to start)
- Angular velocity clamped to momentum cap based on halo scale
- Exponential decay applied when no input (coasting)

**Velocity Translation**

- `horizontalVelocity = angularVelocity * ROTATION_TO_VELOCITY * haloScale`
- Clamped between `MIN_RIDE_SPEED` and `MAX_RIDE_SPEED`
- Applied to sprite via `setRideVelocityOverride()`

### Pinch-to-Zoom System

**Scale Adjustment**

- Pinch distance delta → normalized scale change
- `haloScale` clamped between `MIN_SCALE` (0.65) and `MAX_SCALE` (1.75)
- Affects both visual radius and physics leverage

**Helium Injection (Airborne Only)**

- Pinch-in gesture while airborne injects helium
- `heliumAmount` increases by `deltaScale * PINCH_HELIUM_RATE`
- Capped at 3 units
- Applies upward force: `heliumAmount * HELIUM_FLOAT_FORCE`

**Dismissal**

- Sustained pinch-out to minimum scale triggers `deactivateLumenLoop()`
- Resets all state variables, restores standard controls

### Energy Management

**Inertia-Based Drain**

- Energy drains only during active rotation input (not coasting)
- Drain rate: `(rotationDelta / 2π) * ENERGY_DRAIN_PER_ROTATION * energyMultiplier`
- Energy multiplier scales with halo size (larger = more drain)
- Starting from rest requires maximum energy due to high torque
- Once momentum exists, energy cost per rotation decreases

**Depletion Behavior**

- When energy reaches zero, prevent further angular velocity increases
- Allow natural decay (coasting continues)
- Energy regenerates when stationary (existing system)

### Jump Mechanics

**Tap-to-Jump (New Feature)**

- While Lumen-Loop is active, taps trigger standard jump mechanics
- Preserve Lumen-Loop state (angular velocity, halo scale remain unchanged)
- No special handling needed - existing jump system handles impulse and energy

**Drag-Release Jump (Existing)**

- Detect downward drag during rotation
- On release, trigger `triggerLumenLoopJump()`
- Apply impulse opposite to drag direction
- Scale by drag duration and available energy
- Consume energy proportional to impulse

### Halo Rendering

**Visual Feedback**

- Circular pixel strip with glow effect
- Radius: `BASE_RADIUS * haloScale * heliumBleedFactor`
- Color lerps from yellow (`#f5f797`) to cyan (`#9be7ff`) based on helium
- Glow intensity increases with angular velocity
- Segments rotate to create wheel appearance

**Progressive Activation Visual**

- During activation gesture, render partial halo arc
- Arc completion: `(accumulatedAngle / 2π) * 360°`
- Start at tap location, grow clockwise/counterclockwise based on rotation direction
- Full circle appears when activation completes

## Data Models

### Constants (Existing in `constants.ts`)

```typescript
LUMEN_LOOP_BASE_RADIUS = 52; // Base halo size
LUMEN_LOOP_MIN_SCALE = 0.65; // Zoom-out limit
LUMEN_LOOP_MAX_SCALE = 1.75; // Zoom-in limit
LUMEN_LOOP_ROTATION_TO_VELOCITY = 120; // Speed per momentum unit
LUMEN_LOOP_ANGULAR_DECAY = 1.6; // Coasting decay rate
LUMEN_LOOP_HELIUM_FLOAT_FORCE = 500; // Upward acceleration
LUMEN_LOOP_HELIUM_BLEED_RATE = 0.35; // Depletion per second
LUMEN_LOOP_ENERGY_DRAIN_PER_ROTATION = 14; // Base energy cost
LUMEN_LOOP_PEDAL_IMPULSE = 12; // Momentum per rotation
LUMEN_LOOP_PEDAL_MOMENTUM_MAX = 6.5; // Velocity cap
```

### Gesture State (Existing in `InputHandler`)

```typescript
type LumenLoopGestureState = {
  pointerId: PointerKey | null; // Touch/mouse tracking
  lastAngle: number; // Previous angle to sprite
  accumulatedAngle: number; // Total rotation for activation
  pendingActivation: boolean; // Waiting for 360° completion
  dragStart: PointSample | null; // Initial touch point
  lastSample: PointSample | null; // Most recent position
  jumpDragStart: PointSample | null; // Downward drag tracking
  claimedInput: boolean; // Prevents gesture conflicts
};
```

## Error Handling

### Invalid State Transitions

- **Activation without unlock**: Check `isUnlocked` before allowing activation
- **Multiple simultaneous gestures**: Use `claimedInput` flag to prevent conflicts
- **NaN/Infinity values**: Validate all numeric inputs with `Number.isFinite()`

### Edge Cases

- **Sprite null**: All functions check `sprite` existence before operations
- **Camera offset**: Adjust touch coordinates by `cameraY` for world-space calculations
- **Energy depletion mid-rotation**: Allow coasting but prevent acceleration
- **Helium injection on ground**: Check `sprite.onGround` and `sprite.inWater` before injection
- **Rapid pinch gestures**: Clamp scale changes and use decay to smooth intent

### Deactivation Conditions

1. Pinch-out to minimum scale
2. Sprite exits screen bounds
3. Angular velocity reaches zero AND energy depleted (after timeout)
4. Manual dismissal via gesture

## Testing Strategy

### Unit Tests (Optional)

- **State transitions**: Activation, deactivation, energy depletion
- **Physics calculations**: Velocity conversion, momentum accumulation, decay
- **Scale clamping**: Min/max bounds, helium bleed effects
- **Energy drain**: Inertia-based calculation, multiplier scaling

### Integration Tests (Optional)

- **Gesture recognition**: Rotation tracking, pinch detection, tap-to-jump
- **Sprite interaction**: Velocity override, helium lift application
- **Visual rendering**: Halo appearance, progressive activation, color lerping

### Manual Testing Focus

- **Activation feel**: 360° rotation gesture responsiveness
- **Movement control**: Pedaling momentum, coasting behavior
- **Scale leverage**: Larger halos harder to start, travel farther per rotation
- **Energy balance**: Stamina cost feels fair, coasting doesn't drain
- **Helium floating**: Smooth upward force, visual feedback clear
- **Tap-to-jump**: Works reliably without dismissing ride
- **Dismissal**: Pinch-out gesture intuitive, no accidental exits

## Implementation Notes

### Existing Code Reuse

- Sprite velocity override system already supports ride mechanics
- Energy bar integration already exists via `gameWorld.energyBar`
- Input gesture tracking infrastructure in place
- Pixel strip rendering utilities available

### New Code Requirements

1. **Progressive halo rendering during activation**
   - Modify `drawLumenLoop()` to handle partial arc rendering
   - Add `pendingActivation` visual state

2. **Tap-to-jump detection**
   - Ensure taps and long press trigger standard jump mechanics when Lumen-Loop active
   - Preserve Lumen-Loop state during jump

3. **Inertia-based energy drain**
   - Modify energy calculation in `updateLumenLoopState()`
   - Scale drain by current angular velocity (higher momentum = less drain per input)
   - Only drain during active rotation input, not coasting

4. **Activation visual feedback**
   - Track `accumulatedAngle` during pending activation
   - Render partial halo arc proportional to completion
   - Smooth transition to full halo on activation

### Performance Considerations

- Halo rendering uses pixel strip dots (36 segments)
- Glow effects use canvas shadow blur (GPU accelerated)
- Input sampling limited to 120ms window
- State updates run at fixed timestep (capped at 0.04s)

### Accessibility

- Visual feedback: Glow intensity, color changes, size scaling
- No audio cues currently (future enhancement)
- Touch, mouse, and trackpad support
- Keyboard controls not applicable for rotation gesture

## Dependencies

### Internal

- `src/defold/runtime/state/game_state.ts` - State management
- `src/defold/game_objects/sprite.ts` - Player character
- `src/defold/runtime/input.ts` - Gesture handling
- `src/defold/config/constants.ts` - Tuning parameters
- `src/defold/game_objects/rendering/pixelStrip.ts` - Visual rendering

### External

- Canvas 2D API for rendering
- Touch/Mouse event APIs for input
- No external libraries required

## Future Enhancements

- **Visual effects**: Particle trails, speed lines, impact effects
- **Audio feedback**: Rotation whoosh, activation chime, helium injection sound
- **Combo system**: Reward sustained rotation with bonus speed/energy regen
