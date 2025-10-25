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

- [ ] 4. Integrate rotation-to-movement physics into game loop
  - Add rotation delta tracking to `InputHandler` in `src/defold/runtime/input.ts` to capture rotation input during active Lumen-Loop
  - Call `updateLumenLoopState()` in the game loop (`src/defold/runtime/game_app.ts`) with rotation delta and input state
  - Apply the returned horizontal velocity to sprite via velocity override system
  - Ensure rotation input is only tracked when Lumen-Loop is active and not during pending activation
  - Reset rotation delta each frame after processing
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

- [ ] 5. Block standard ride spawning when Lumen-Loop is active
  - Modify `spawnRideFromGesture()` in `src/defold/runtime/input.ts` to check if Lumen-Loop is active
  - Prevent ride spawning gestures (swipes) when `gameWorld.lumenLoop.isActive` is true
  - Ensure rotation gestures are not misinterpreted as ride spawning swipes
  - _Requirements: 1.4_

- [ ] 6. Implement pinch-to-zoom gesture handling
  - Add pinch gesture detection to `InputHandler` in `src/defold/runtime/input.ts` for touch events
  - Track two-finger touch points and calculate distance delta
  - Update `haloScale` in `gameWorld.lumenLoop` based on pinch direction (in/out)
  - Clamp scale between `LUMEN_LOOP_MIN_SCALE` (0.65) and `LUMEN_LOOP_MAX_SCALE` (1.75)
  - Trigger deactivation when scale reaches minimum threshold via sustained pinch-out
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 7. Implement helium injection and floating physics
  - Detect pinch-in gesture while sprite is airborne in `InputHandler`
  - Increase `heliumAmount` in `gameWorld.lumenLoop` when pinch-in occurs (capped at 3 units)
  - Add helium physics update in game loop to apply upward force (`LUMEN_LOOP_HELIUM_FLOAT_FORCE`)
  - Implement helium bleed-off over time at `LUMEN_LOOP_HELIUM_BLEED_RATE`
  - Gradually reduce `haloScale` toward base radius as helium bleeds off
  - Update halo color lerp in `drawLumenLoop()` based on helium amount (yellow to cyan)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.4_

- [ ] 8. Implement drag-release jump mechanic
  - Track downward drag gestures during active Lumen-Loop in `InputHandler`
  - Detect drag direction and duration using `jumpDragStart` in gesture state
  - On release, calculate jump impulse opposite to drag direction
  - Scale impulse by drag duration and available energy
  - Consume energy proportional to impulse magnitude
  - Apply impulse to sprite using existing jump system
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 9. Implement deactivation conditions
  - Add `deactivateLumenLoop()` function calls in appropriate locations
  - Check for pinch-out to minimum scale threshold and deactivate
  - Monitor sprite screen position and deactivate when exiting visible bounds
  - Reset all Lumen-Loop state variables on deactivation
  - Restore standard ride spawning and control inputs
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 10. Add visual feedback for activation progress
  - Implement glow effect that intensifies as rotation approaches 360°
  - Add color transition during activation sequence
  - Ensure smooth visual transition from partial to full halo
  - Update glow intensity based on angular velocity in active state
  - _Requirements: 1.2, 10.2_

- [ ] 11. Integrate Lumen-Loop skill into skills menu
  - Add Lumen-Loop skill icon (glowing ring) to skills menu UI
  - Display skill as unlocked when `gameWorld.lumenLoop.isUnlocked` is true
  - Add skill description with activation instructions, zoom controls, and helium injection timing
  - Ensure demo mode initializes with helium resources and unlocked skill
  - Add HUD visual feedback for energy drain, zoom-out dismissal, and jump launches
  - _Requirements: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 13.4_

- [ ] 12. Validate edge cases and error handling
  - Test activation with invalid sprite state
  - Verify behavior when energy depletes mid-rotation
  - Confirm helium injection only works when airborne
  - Test rapid pinch gestures and scale clamping
  - Validate all deactivation conditions
  - Test interaction between tap-to-jump and rotation gestures
  - Verify ride spawning is properly blocked during Lumen-Loop
  - _Requirements: All requirements_
