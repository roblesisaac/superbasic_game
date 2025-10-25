# Requirements Document

## Introduction

The Lumen-Loop is a wheel-like ride mechanic for SuperBasic Man that transforms player movement into a momentum-based rolling system. Players activate the ride through a tap-and-rotate gesture, then control horizontal movement by spinning a virtual joystick. The system includes pinch-to-zoom scaling that affects movement leverage, helium injection for floating physics, and energy management that creates a stamina loop. This feature enhances the core platforming experience with a skill-based movement option that rewards sustained input and strategic resource management.

## Glossary

- **Lumen-Loop**: The wheel-like ride system that appears as a glowing halo around the player sprite
- **Game System**: The SuperBasic Man game application and its runtime environment
- **Player**: The user controlling the game through touch, mouse, or controller input
- **Sprite**: The player character's visual representation in the game world
- **Halo**: The circular glowing visual effect that represents the active Lumen-Loop
- **Angular Velocity**: The rotational speed of the Lumen-Loop, measured in degrees or radians per second
- **Halo Scale**: The size multiplier of the halo radius, controlled by pinch-to-zoom gestures
- **Helium Resource**: A consumable resource that enables floating physics when injected into the Lumen-Loop
- **Energy Bar**: The shared stamina resource that depletes during Lumen-Loop rotation
- **Activation Gesture**: The combined input of tapping the sprite and completing a 360-degree rotation
- **Pinch Gesture**: A two-finger touch input that changes distance to control zoom level
- **Rotation Input**: Drag gestures that accumulate angular displacement to control ride direction and speed
- **Momentum Accumulator**: The system that converts rotation inputs into sustained velocity
- **Torque**: The rotational force required to accelerate the Lumen-Loop from rest

## Requirements

### Requirement 1

**User Story:** As a player, I want to activate the Lumen-Loop by tapping my sprite and rotating 360 degrees, so that I can engage the wheel-based movement system

#### Acceptance Criteria

1. WHEN the Player taps the Sprite AND completes a rotation of plus or minus 360 degrees, THE Game System SHALL activate the Lumen-Loop and display the Halo
2. WHILE the Lumen-Loop is active, THE Game System SHALL block standard ride spawning gestures
3. WHEN the Lumen-Loop activates, THE Game System SHALL initialize Angular Velocity to zero and Halo Scale to the base radius value
4. WHEN the Player completes the Activation Gesture, THE Game System SHALL center the Halo on the Sprite position

### Requirement 2

**User Story:** As a player, I want to control my horizontal movement by dragging to rotate the Lumen-Loop, so that I can roll left or right like pedaling a bike

#### Acceptance Criteria

1. WHILE the Lumen-Loop is active, WHEN the Player drags in a clockwise direction, THE Game System SHALL increase Angular Velocity in the rightward direction
2. WHILE the Lumen-Loop is active, WHEN the Player drags in a counter-clockwise direction, THE Game System SHALL increase Angular Velocity in the leftward direction
3. WHEN the Player performs partial rotation arcs, THE Game System SHALL apply small velocity increments to the Momentum Accumulator
4. WHEN the Player performs sustained rotation spins, THE Game System SHALL build Angular Velocity progressively up to the maximum ride speed
5. WHEN the Player reverses rotation direction, THE Game System SHALL reduce Angular Velocity toward zero before accelerating in the opposite direction

### Requirement 3

**User Story:** As a player, I want the Lumen-Loop to coast and slow down when I stop rotating, so that movement feels natural and momentum-based

#### Acceptance Criteria

1. WHEN Rotation Input ceases, THE Game System SHALL apply angular decay to reduce Angular Velocity over time
2. WHILE Angular Velocity is non-zero AND no Rotation Input is active, THE Game System SHALL continue moving the Sprite horizontally
3. WHEN Angular Velocity reaches zero through decay, THE Game System SHALL stop horizontal movement
4. THE Game System SHALL clamp horizontal velocity between the minimum ride speed and maximum ride speed constants

### Requirement 4

**User Story:** As a player, I want to pinch-to-zoom the halo to change its size, so that I can control movement leverage and dismiss the ride

#### Acceptance Criteria

1. WHILE the Lumen-Loop is active, WHEN the Player performs a pinch-in gesture, THE Game System SHALL increase Halo Scale up to the maximum scale limit
2. WHILE the Lumen-Loop is active, WHEN the Player performs a pinch-out gesture, THE Game System SHALL decrease Halo Scale down to the minimum scale limit
3. WHEN Halo Scale increases, THE Game System SHALL increase the distance traveled per degree of rotation
4. WHEN Halo Scale increases, THE Game System SHALL increase the Torque required to accelerate from rest
5. WHEN the Player sustains a pinch-out gesture until Halo Scale reaches the minimum threshold, THE Game System SHALL deactivate the Lumen-Loop and restore standard controls

### Requirement 5

**User Story:** As a player, I want larger halos to behave like bigger gears with higher leverage, so that scaling affects both startup effort and cruising distance

#### Acceptance Criteria

1. WHEN Halo Scale is above the base value, THE Game System SHALL reduce the rate of Angular Velocity increase per rotation input
2. WHEN Halo Scale is above the base value, THE Game System SHALL increase the horizontal distance covered per rotation cycle
3. WHEN Halo Scale is below the base value, THE Game System SHALL increase the rate of Angular Velocity increase per rotation input
4. WHEN Halo Scale is below the base value, THE Game System SHALL decrease the horizontal distance covered per rotation cycle

### Requirement 6

**User Story:** As a player, I want to inject helium into the Lumen-Loop while airborne by pinching, so that I can float gently and extend my air time

#### Acceptance Criteria

1. WHEN the Sprite is airborne AND the Player performs a pinch gesture, THE Game System SHALL consume Helium Resource and inject it into the Lumen-Loop
2. WHILE Helium Resource is present in the Lumen-Loop, THE Game System SHALL apply an upward force to the Sprite
3. WHILE Helium Resource is present, THE Game System SHALL reduce the Helium Resource amount over time at the helium bleed rate
4. WHEN Helium Resource depletes to zero, THE Game System SHALL cease applying upward force
5. WHILE Helium Resource is bleeding off, THE Game System SHALL gradually reduce Halo Scale toward the base radius

### Requirement 7

**User Story:** As a player, I want faster rotation to drain my energy bar, so that there is a stamina cost to sustained high-speed rolling

#### Acceptance Criteria

1. WHEN Angular Velocity is non-zero, THE Game System SHALL drain the Energy Bar at a rate proportional to the absolute Angular Velocity
2. WHEN the Energy Bar reaches zero, THE Game System SHALL prevent further Angular Velocity increases from Rotation Input
3. WHILE the Energy Bar is depleted, THE Game System SHALL allow Angular Velocity to decay naturally
4. THE Game System SHALL scale energy drain by the Halo Scale multiplier

### Requirement 8

**User Story:** As a player, I want to drag downward while rotating and release to jump, so that I can launch in the opposite direction using existing jump mechanics

#### Acceptance Criteria

1. WHILE the Lumen-Loop is active, WHEN the Player drags downward AND releases, THE Game System SHALL trigger a jump impulse
2. WHEN the jump is triggered, THE Game System SHALL apply impulse in the direction opposite to the drag
3. WHEN the jump is triggered, THE Game System SHALL scale impulse magnitude by the drag duration and available Energy Bar amount
4. WHEN the jump is triggered, THE Game System SHALL consume energy from the Energy Bar proportional to the impulse magnitude

### Requirement 9

**User Story:** As a player, I want the halo to render as a glowing ring that responds to my inputs, so that I receive clear visual feedback on the ride state

#### Acceptance Criteria

1. WHILE the Lumen-Loop is active, THE Game System SHALL render the Halo as a circular pixel strip centered on the Sprite
2. WHEN Angular Velocity increases, THE Game System SHALL increase the glow intensity of the Halo
3. WHEN Halo Scale changes, THE Game System SHALL update the rendered radius to match the base radius multiplied by Halo Scale
4. WHILE Helium Resource is bleeding off, THE Game System SHALL animate the Halo shrinking toward the base radius
5. THE Game System SHALL apply camera offsets to keep the Halo centered on the Sprite in screen space

### Requirement 10

**User Story:** As a player, I want the Lumen-Loop to deactivate under specific conditions, so that I can return to standard controls when the ride ends

#### Acceptance Criteria

1. WHEN the Player zooms out past the dismissal threshold, THE Game System SHALL deactivate the Lumen-Loop and hide the Halo
2. WHEN the Sprite exits the visible screen bounds, THE Game System SHALL deactivate the Lumen-Loop
3. WHEN Angular Velocity reaches zero AND the Energy Bar is depleted, THE Game System SHALL deactivate the Lumen-Loop after a timeout period
4. WHEN the Lumen-Loop deactivates, THE Game System SHALL reset all Lumen-Loop state variables to their initial values
5. WHEN the Lumen-Loop deactivates, THE Game System SHALL restore standard ride spawning and control inputs

### Requirement 11

**User Story:** As a demo player, I want to start with helium resources and an unlocked Lumen-Loop skill, so that I can immediately experience the floating mechanic

#### Acceptance Criteria

1. WHEN the Game System initializes in demo mode, THE Game System SHALL set the Helium Resource to a non-zero starting value
2. WHEN the Game System initializes in demo mode, THE Game System SHALL mark the Lumen-Loop skill as unlocked
3. WHERE demo mode is active, THE Game System SHALL display the Lumen-Loop skill in the skills menu accessed via the top-right button

### Requirement 12

**User Story:** As a player, I want to see the Lumen-Loop skill in the skills menu, so that I know it is available and understand how to use it

#### Acceptance Criteria

1. WHEN the Player opens the skills menu, THE Game System SHALL display a glowing ring icon for the Lumen-Loop skill
2. WHERE the Lumen-Loop skill is unlocked, THE Game System SHALL show the skill as available in the skills menu
3. WHEN the Player views the Lumen-Loop skill details, THE Game System SHALL display instructions for activation, zoom controls, and helium injection timing
4. THE Game System SHALL provide visual feedback for Energy Bar drain, zoom-out dismissal, and jump-charged launches through the HUD
