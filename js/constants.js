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
export const SPRITE_SIZE = 16;

// Rides
export const RIDE_THICKNESS = 20;
export const RIDE_SPEED_THRESHOLD = 650;
export const RIDE_BOUNCE_VX_FACTOR = 0.9;
export const RIDE_BOUNCE_VY = -900;
export const MIN_RIDE_SPEED = 200;
export const MAX_RIDE_SPEED = 900;
export const MIN_SWIPE_DISTANCE = 24;
export const MIN_SWIPE_TIME = 80;
export const VELOCITY_SAMPLE_TIME = 120;
export const MAX_RIDES = 2;
export const RIDE_FLOAT_TIME = 5.0;
export const RIDE_MIN_WIDTH = 80;
export const RIDE_MAX_WIDTH = 320;

// Gates
export const GATE_THICKNESS = 20;

// Grid / Gates / Height
export const PIXELS_PER_FOOT = 32;
export const GRID_SIZE = 32;
export const GATE_EVERY_FEET = 15;
export const GATE_GAP_WIDTH = 50;

// Budget game data
export const TOTAL_ITEMS = 100;
export const MAX_ITEMS_PER_SECTION = 50;
export const ITEM_SIZE = 12;
export const GROUP_SPACING = 60;
export const ITEM_SPACING = 16;

export const DEFAULT_BUDGET_DATA = [
  ["Salary", 1000],
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

export const MOVEMENT_MIN = 300;
export const MOVEMENT_MAX = 1000;