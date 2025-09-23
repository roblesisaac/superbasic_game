// Tunables & constants
// Limit the game's canvas width so it fits most mobile screens
export const CANVAS_MAX_WIDTH = 480;

export const GRAVITY = 2000;
export const GLIDE_GRAVITY_FACTOR = 0.16;
export const GROUND_FRICTION = 1200;

export const CHARGE_TIME = 2.0;
export const JUMP_MIN = 600;
export const JUMP_MAX = 1600;
export const JUMP_SMALL_COOLDOWN = 420;
export const STRETCH_SCALE_X = 0.92;
export const STRETCH_SCALE_Y = 1.12;
export const STRETCH_TIME   = 0.12;

export const VELOCITY_STRETCH_FACTOR = 0.0008;
export const MAX_VELOCITY_STRETCH = 0.3;
export const IMPACT_SQUASH_FACTOR = 1.8;
export const IMPACT_DECAY_RATE = 8.0;
export const CHARGE_SQUASH_MAX = 0.4;
export const CHARGE_WIDEN_MAX  = 0.2;

export const ENERGY_MAX = 100;
export const ENERGY_DRAIN_CHARGE = 45;
export const ENERGY_DRAIN_GLIDE  = 10;
export const ENERGY_REGEN_RATE   = 80;
export const COOLDOWN_TIME = 1.1;
export const COOLDOWN_PENALTY_PER_PRESS = 0.22;

export const SAFE_FALL_VY = 700;
export const SAFE_FALL_HEIGHT = 64;
export const STUN_TIME = 1.0;
export const INVULNERABILITY_TIME = 1.8;
export const INVULNERABILITY_BLINK_INTERVAL_SLOW = 0.2;
export const INVULNERABILITY_BLINK_INTERVAL_FAST = 0.08;
export const SPRITE_SIZE = 25;

// Rides
export const RIDE_THICKNESS = 20;
export const RIDE_SPEED_THRESHOLD = 650;
export const RIDE_BOUNCE_VX_FACTOR = 0.9;
export const RIDE_BOUNCE_VY = -900;
export const MIN_RIDE_SPEED = 200;
export const MAX_RIDE_SPEED = 900;
// Hoverboard landing physics
export const RIDE_WEIGHT_SHIFT_MIN = 3;
export const RIDE_WEIGHT_SHIFT_MAX = 8;
export const RIDE_IMPACT_PHASE_DURATION = 0.08;     // Quick initial dip
export const RIDE_ABSORPTION_PHASE_DURATION = 0.18; // Weight absorption
export const RIDE_RECOVERY_PHASE_DURATION = 0.28;   // Bounce back with overshoot
export const RIDE_SETTLE_PHASE_DURATION = 0.35;     // Final damping to hover
export const RIDE_RECOVERY_OVERSHOOT = 0.25;        // How much it overshoots upward
export const RIDE_VELOCITY_IMPACT_FACTOR = 0.006;   // How much landing velocity affects the dip
// Launch effect constants
export const RIDE_LAUNCH_LIFT_DURATION = 0.12;      // Quick upward lift when sprite launches
export const RIDE_LAUNCH_RELEASE_DURATION = 0.22;   // Release back down after lift
export const RIDE_LAUNCH_SETTLE_DURATION = 0.25;    // Final settling to neutral
export const RIDE_LAUNCH_LIFT_INTENSITY = 0.4;      // How much the ride lifts up (relative to weight shift max)
export const RIDE_LAUNCH_VELOCITY_FACTOR = 0.004;   // How much launch velocity affects the lift
export const MIN_SWIPE_DISTANCE = 24;
export const MIN_SWIPE_TIME = 80;
export const VELOCITY_SAMPLE_TIME = 120;
export const MAX_RIDES = 2;
export const RIDE_FLOAT_TIME = 5.0;
export const RIDE_MIN_WIDTH = 80;
export const RIDE_MAX_WIDTH = 320;

// Gates
export const USE_RANDOM_GATES = false;
export const GATE_THICKNESS = 20;

// Grid / Gates / Height
export const PIXELS_PER_FOOT = 16;
export const GRID_SIZE = 16;
export const GATE_EVERY_FEET = 30;
export const GATE_GAP_WIDTH = 55;

// Budget game data
export const TOTAL_ITEMS = 100;
export const MAX_ITEMS_PER_SECTION = 100;
export const ITEM_SIZE = 12;
export const GROUP_SPACING = 60;
export const ITEM_SPACING = 16;

export const DEFAULT_BUDGET_DATA: ReadonlyArray<readonly [string, number]> = [
  ["Salary", 1225],
  ["McDonald's", -25],
  ["Amazon", -150],
  ["Gas", -60],
  ["Bonus", 500],
  ["Rent", -1500],
  ["Gas", -300],
  ["Groceries", -350],
  ["Insurance", -400]
];

// Camera
export const CAM_TOP = 0.35;
export const CAM_BOTTOM = 0.65;
export const CAM_LEFT = 0.35;
export const CAM_RIGHT = 0.65;

export const MOVEMENT_MIN = 300;
export const MOVEMENT_MAX = 1000;