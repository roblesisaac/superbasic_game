# Lumen-Loop Ride Spec & Checklist

## Core brief

- Wheel-like ride that appears as a glowing halo when the player taps the sprite and completes a ±360° joystick rotation.
- While active, the player drags anywhere on-screen to rotate the joystick proxy; clockwise rotation rolls right, counter-clockwise rolls left, preserving velocity like a wheel.
- Rotation behaves like pedaling a bike: partial arcs add small nudges, sustained spins build momentum, and reversing direction bleeds speed before accelerating the other way.
- Pinch-to-zoom while Lumen-Loop is active scales the halo radius; zooming in enlarges the ring so each degree of rotation covers more ground (higher leverage), while zooming out shortens the stride
- Larger rings behave like bigger gears: they require more torque to start rolling (slower to spool up) but cover more ground per rotation once moving; smaller rings engage almost instantly with less effort but travel shorter distances per spin.
- Helium is injected while airborne by pinching/zooming the loop: jumping + pinch inflates the ring with helium, causing a floaty descent until the gas bleeds off.
- Faster rotation directly increases roll speed but drains the shared energy/power bar, enforcing a stamina loop while riding.
- Dragging downward while rotating and then releasing channels the existing jump mechanics, launching in the opposite direction proportional to drag duration/energy.
- Pinching/zooming outward shrinks the halo until it “pops,” stowing the ride and returning to standard controls.
- Skills (including Lumen-Loop) remain demo-visible through the existing top-right button that currently opens the “Terminal Settings” menu; tapping it surfaces the skill list.

## Demo-only assumptions

- Player starts the session with a non-zero helium resource to showcase floating behavior.
- Lumen-Loop skill is unlocked by default for the demo (later gated behind discovery).
- Collecting helium or pinch-filling the loop while airborne makes the sprite gently float upward and gradually returns the halo size toward its initial radius as helium dissipates.

## Implementation Checklist

1. [x] **Lock in design + player flow**
   - [x] Finalize the Lumen-Loop name and update any in-game copy/tooltips.
   - [x] Document the activation gesture (tap sprite + ±360° rotation), momentum vs. energy trade-off, and the drag-down release jump behavior.
   - [x] Define pinch-to-zoom → halo-scale mapping (zoom in = larger halo, zoom out = dismissal) and how it affects movement leverage.
2. [x] **Extend ride configuration constants**
   - [x] In `src/defold/config/constants.ts`, add values for base halo radius, pinch zoom min/max scale, glow thickness, rotation-to-velocity factor, angular decay, pinch responsiveness, helium float force, helium bleed rate, energy drain per rotation, jump impulse scaling, and scale-based inertia/energy multipliers.
   - [x] Mirror any constants referenced by both the browser runtime and Defold-exported scripts.
3. [x] **Augment shared state**
   - [x] Update `src/defold/runtime/state/game_state.ts` (and related type definitions) with Lumen-Loop fields: `isActive`, `angularVelocity`, `rotationAccum`, `haloScale`, `pinchIntent`, `heliumAmount`, `heliumFloatTimer`, `energy`, and cooldown bookkeeping.
   - [x] Ensure serialization/reset helpers seed demo builds with the requested helium amount and unlocked skill flag.
4. [x] **Create dedicated ride module**
   - [x] Add `src/defold/game_objects/rides/lumen_loop.ts` exporting pure helpers to initialize, update, and render the ride; avoid DOM globals so the code ports to Defold scripts.
   - [x] Provide APIs for `activate`, `update(dt, inputs)`, `applyPinch(deltaScale)`, `applyHelium(amount)`, `consumeEnergy(amount)`, `triggerJump(direction)`, and `draw(ctx, camera)`.
5. [x] **Wire activation + pinch gestures into input handling**
   - [x] In `src/defold/runtime/input.ts`, track per-touch polar coordinates to detect signed angle accumulation; trigger activation when the player both taps the sprite and surpasses ±360°.
   - [x] Capture pinch distance deltas (two-finger on touch, scroll-wheel fallback for desktop) and forward normalized zoom factors to the ride module; interpret sustained zoom-out as a dismissal request.
   - [x] Recognize drag-down + release gestures while rotating to route into the existing jump system with the correct direction/impulse.
   - [x] Once active, treat all drags as rotation inputs rather than spawning standard rides until the Lumen-Loop deactivates.
     - Sanity check: Tap the sprite, rotate a full loop, pinch in/out, and confirm normal ride gestures remain blocked while the loop is active.
6. [x] **Integrate helium behavior**
   - [x] Seed the player with the demo helium amount in `game_state` initialization.
     - Sanity check: Start the build with seeded helium, pinch while airborne, and ensure lift/bleed feedback matches the constants.

- [x] Detect airborne pinch/zoom gestures to inject helium into the active loop; while helium is present, apply an upward force/offset and slowly reduce halo scale toward the base radius as helium drains over time.
  - [x] Expose hooks so pickups (e.g., `src/defold/game_objects/heartPickup.ts` or a future helium collectible) can call `applyHelium`.

7. [x] **Movement + physics coupling**
   - [x] In `src/defold/runtime/game_app.ts` (or the movement controller), convert angular velocity × circumference into horizontal sprite velocity, clamped by `MIN_RIDE_SPEED`/`MAX_RIDE_SPEED`, and scale energy drain with angular speed.
   - [x] Respect pinch-inflated halo scale when computing stride length and startup inertia so larger rings need more torque to accelerate but cruise farther per revolution.
   - [x] Rework rotation input so it feeds a pedal-style momentum accumulator (small drags = light pushes, continuous spins = high speed) instead of instantly mapping angle deltas to full ride velocity.
   - [x] Apply friction/decay so the Lumen-Loop coasts briefly after input stops.
     - Sanity check: Log or visualize angular velocity vs. sprite velocity/energy to verify clamping and decay behave as expected.
8. [x] **Render the halo + zoom effects**
  - [x] Reuse `drawPixelStripDots`/`computePixelStripGlow` to render a circular pixel strip whose radius is `baseRadius * haloScale`.
  - [x] Tie glow intensity and thickness to angular velocity and pinch scale; ensure camera offsets keep the ring centered on the sprite.
  - [x] Add a shrinking animation when helium bleeds off to visually communicate the float cooldown.
    - Sanity check: Observe the halo while pinching/rotating and confirm glow radius/intensity updates smoothly (and shrinks as helium drains).
9. [ ] **Collisions, lifecycle, and teardown**
   - [ ] Decide if the halo collides like existing rides (`Ride.getRect()`) or grants temporary invulnerability; update collision checks accordingly.
   - [ ] Provide cleanup hooks for exiting the screen, exhausting helium, hitting zero energy, losing momentum, zooming out to dismissal, or manually canceling the ride so normal ride spawning resumes.
   - [ ] Reset pinch/helium state when the ride deactivates to prevent stale inputs.
   - Sanity check: Drive the ride through each exit condition and ensure collisions/cleanup restore baseline controls without lingering state.
10. [ ] **UI, skill toggles, and feedback**

- [ ] Update HUD/tutorial surfaces (e.g., `src/defold/gui/hud.ts`) with a demo-only tip that Lumen-Loops are available and how to trigger pinch zoom + helium float.
- [ ] Ensure the top-right “Terminal Settings” button doubles as the skills drawer in the demo; inside that panel, add a glowing ring icon flagged as unlocked, with copy describing activation, zoom/dismiss, and helium pinch timing.
- [ ] Visualize energy/power bar drain, the zoom-out “pop” dismissal, and jump-charged launches with audio/particle cues.
- Sanity check: Open the HUD/skills overlay in the demo and confirm the new copy, icon, and feedback cues appear and respond.

11. [ ] **Testing + docs**

- [ ] Smoke-test touch, mouse, and controller scenarios for rotation detection, pinch scaling, and helium float.
- [ ] Verify the spec holds inside both the Defold runtime and the web build (camera offsets, scaling, inputs).
- [ ] Update `organize-files.md` (or a new design note) with where the Lumen-Loop modules live and how to re-enable discovery gating later.
- Sanity check: Run the smoke tests across input modes/builds, ensuring the documented behavior matches the current implementation.
