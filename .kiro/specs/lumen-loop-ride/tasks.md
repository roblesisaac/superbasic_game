# Implementation Plan

- [x] 1. Implement progressive halo rendering during activation gesture
  - Modify `drawLumenLoop()` in `src/defold/game_objects/rides/lumen_loop.ts` to render partial halo arc when `pendingActivation` is true
  - Calculate arc completion percentage from `accumulatedAngle / (2π)`
  - Render arc segments proportional to rotation progress
  - Add visual parameter to distinguish pending vs active state
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement inertia-based energy drain system
  - Modify `updateLumenLoopState()` in `src/defold/game_objects/rides/lumen_loop.ts` to calculate energy drain based on acceleration effort
  - Implement maximum energy drain when angular velocity is zero or near-zero (overcoming initial torque)
  - Reduce energy drain when momentum exists (proportional to current angular velocity)
  - Ensure no energy drain during coasting (when no rotation input active)
  - Scale energy drain by halo scale multiplier
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 3. Enable tap-to-jump while Lumen-Loop is active
  - Modify input handling in `src/defold/runtime/input.ts` to allow tap gestures to trigger jumps when Lumen-Loop is active
  - Ensure taps don't interfere with rotation gesture tracking
  - Verify Lumen-Loop state (angular velocity, halo scale) is preserved during jump
  - Confirm standard jump mechanics apply without modification
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 4. Add visual feedback for activation progress
  - Implement glow effect that intensifies as rotation approaches 360°
  - Add color transition during activation sequence
  - Ensure smooth visual transition from partial to full halo
  - _Requirements: 1.2, 9.2_

- [ ] 5. Validate edge cases and error handling
  - Test activation with invalid sprite state
  - Verify behavior when energy depletes mid-rotation
  - Confirm helium injection only works when airborne
  - Test rapid pinch gestures and scale clamping
  - Validate deactivation conditions
  - _Requirements: All requirements_
