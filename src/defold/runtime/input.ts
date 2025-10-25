import {
  MIN_SWIPE_DISTANCE,
  MIN_SWIPE_TIME,
  VELOCITY_SAMPLE_TIME,
  MAX_RIDES,
  SPRITE_SIZE,
} from "../config/constants.js";
import { canvas, canvasWidth } from "./state/rendering_state.js";
import { cameraY } from "./state/camera_state.js";
import type { GameWorldState } from "./state/game_state.js";
import {
  createRideFromInput,
  countActiveMovingRides,
} from "../game_objects/rides.js";
import {
  activateLumenLoop,
  applyPinch as applyLumenLoopPinch,
  deactivateLumenLoop,
  triggerLumenLoopJump,
  type LumenLoopJumpResult,
} from "../game_objects/rides/lumen_loop.js";
import {
  showSettings,
  toggleSettings,
  hideSettings,
} from "../../web/ui/settings_overlay.js";

type PointSample = { x: number; y: number; time: number };

type RideGesture = {
  distance: number;
  durationMs: number;
  screenY: number;
  cameraY: number;
  canvasWidth: number;
};

type JoystickState = {
  active: boolean;
  baseX: number;
  baseY: number;
  stickX: number;
  stickY: number;
  baseRadius: number;
  stickRadius: number;
  maxDistance: number;
};

const JOYSTICK_PIXEL_SIZE = 2;
const PINCH_SCROLL_SCALE = 0.0025;
const TWO_PI = Math.PI * 2;
const LUMEN_ROTATION_ACTIVATION = TWO_PI;
const LUMEN_INPUT_CLAIM_THRESHOLD = Math.PI / 3; // claim after ~120° rotation

type PointerKey = number | "mouse";

type LumenLoopGestureState = {
  pointerId: PointerKey | null;
  lastAngle: number;
  accumulatedAngle: number;
  pendingActivation: boolean;
  dragStart: PointSample | null;
  lastSample: PointSample | null;
  jumpDragStart: PointSample | null;
  claimedInput: boolean;
};

function drawDPadBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  const pixel = JOYSTICK_PIXEL_SIZE;
  const maxOffset = Math.floor(radius / pixel) * pixel;
  const halfThickness = pixel;

  ctx.fillStyle = "#ffffff";

  for (let px = -halfThickness; px <= halfThickness; px += pixel) {
    for (let py = -maxOffset; py <= maxOffset; py += pixel) {
      ctx.fillRect(x + px, y + py, pixel, pixel);
    }
  }

  for (let px = -maxOffset; px <= maxOffset; px += pixel) {
    for (let py = -halfThickness; py <= halfThickness; py += pixel) {
      ctx.fillRect(x + px, y + py, pixel, pixel);
    }
  }

  ctx.fillStyle = "#000000";

  const innerOffset = Math.max(0, maxOffset - pixel);

  for (let px = -halfThickness; px <= halfThickness; px += pixel) {
    for (let py = -innerOffset; py <= innerOffset; py += pixel) {
      ctx.fillRect(x + px, y + py, pixel, pixel);
    }
  }

  for (let px = -innerOffset; px <= innerOffset; px += pixel) {
    for (let py = -halfThickness; py <= halfThickness; py += pixel) {
      ctx.fillRect(x + px, y + py, pixel, pixel);
    }
  }

  const clearOffset = pixel * 2;

  for (let px = -clearOffset; px <= clearOffset; px += pixel) {
    for (let py = -clearOffset; py <= clearOffset; py += pixel) {
      ctx.clearRect(x + px, y + py, pixel, pixel);
    }
  }
}

function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill = false,
): void {
  if (fill) {
    for (let px = -radius; px <= radius; px += JOYSTICK_PIXEL_SIZE) {
      for (let py = -radius; py <= radius; py += JOYSTICK_PIXEL_SIZE) {
        const distance = Math.sqrt(px * px + py * py);
        if (distance <= radius - JOYSTICK_PIXEL_SIZE / 2) {
          ctx.fillRect(
            x + px,
            y + py,
            JOYSTICK_PIXEL_SIZE,
            JOYSTICK_PIXEL_SIZE,
          );
        }
      }
    }
    return;
  }

  let decision = 3 - 2 * radius;
  let offsetX = 0;
  let offsetY = radius;

  const drawCirclePoints = (cx: number, cy: number, dx: number, dy: number) => {
    const points: Array<[number, number]> = [
      [cx + dx, cy + dy],
      [cx - dx, cy + dy],
      [cx + dx, cy - dy],
      [cx - dx, cy - dy],
      [cx + dy, cy + dx],
      [cx - dy, cy + dx],
      [cx + dy, cy - dx],
      [cx - dy, cy - dx],
    ];

    for (const [pointX, pointY] of points) {
      ctx.fillRect(pointX, pointY, JOYSTICK_PIXEL_SIZE, JOYSTICK_PIXEL_SIZE);
    }
  };

  drawCirclePoints(x, y, offsetX, offsetY);

  while (offsetY >= offsetX) {
    offsetX += JOYSTICK_PIXEL_SIZE;
    if (decision > 0) {
      offsetY -= JOYSTICK_PIXEL_SIZE;
      decision = decision + 4 * (offsetX - offsetY) + 10;
    } else {
      decision = decision + 4 * offsetX + 6;
    }
    drawCirclePoints(x, y, offsetX, offsetY);
  }
}

export class InputHandler {
  game: GameWorldState;
  ensureReset: () => void;
  touchStart: PointSample | null;
  touchSamples: PointSample[];
  touchSwipe: boolean;
  isJoystickMode: boolean;
  mouseStart: PointSample | null;
  mouseSamples: PointSample[];
  isMouseDragging: boolean;
  mouseSwipe: boolean;
  isMouseJoystickMode: boolean;
  keyboardCharging: boolean;
  keyboardChargeStart: number;
  keyboardMovementCharging: boolean;
  keyboardMovementDirection: { x: number; y: number };
  pressedKeys: Set<string>;
  trackpadGestureActive: boolean;
  trackpadStartX: number;
  trackpadStartTime: number;
  lastArrowTime: number;
  arrowCooldownMs: number;
  joystick: JoystickState;
  lumenLoopGesture: LumenLoopGestureState;
  lumenLoopRotationDelta: number;
  lumenLoopJumpIntent: LumenLoopJumpResult | null;
  lastPinchDistance: number | null;

  constructor(game: GameWorldState, ensureReset: () => void) {
    this.game = game;
    this.ensureReset = ensureReset;

    this.touchStart = null;
    this.touchSamples = [];
    this.touchSwipe = false;
    this.isJoystickMode = false;

    this.mouseStart = null;
    this.mouseSamples = [];
    this.isMouseDragging = false;
    this.mouseSwipe = false;
    this.isMouseJoystickMode = false;

    this.keyboardCharging = false;
    this.keyboardChargeStart = 0;

    this.keyboardMovementCharging = false;
    this.keyboardMovementDirection = { x: 0, y: 0 };
    this.pressedKeys = new Set();

    this.trackpadGestureActive = false;
    this.trackpadStartX = 0;
    this.trackpadStartTime = 0;

    this.lastArrowTime = 0;
    this.arrowCooldownMs = 140;

    this.joystick = {
      active: false,
      baseX: 0,
      baseY: 0,
      stickX: 0,
      stickY: 0,
      baseRadius: 15,
      stickRadius: 6,
      maxDistance: 9,
    };

    this.lumenLoopGesture = {
      pointerId: null,
      lastAngle: 0,
      accumulatedAngle: 0,
      pendingActivation: false,
      dragStart: null,
      lastSample: null,
      jumpDragStart: null,
      claimedInput: false,
    };
    this.lumenLoopRotationDelta = 0;
    this.lumenLoopJumpIntent = null;
    this.lastPinchDistance = null;

    this.bind();
  }

  calculateDirection(
    startX: number,
    startY: number,
    currentX: number,
    currentY: number,
  ) {
    const dx = currentX - startX;
    const dy = currentY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) return { x: 0, y: 0, distance: 0 };

    return {
      x: dx / distance,
      y: dy / distance,
      distance,
    };
  }

  startJoystick(x: number, y: number) {
    this.joystick.active = true;
    this.joystick.baseX = x;
    this.joystick.baseY = y;
    this.joystick.stickX = x;
    this.joystick.stickY = y;
  }

  updateJoystick(x: number, y: number) {
    if (!this.joystick.active) return;
    const { baseX, baseY, maxDistance } = this.joystick;
    const dx = x - baseX;
    const dy = y - baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= maxDistance) {
      this.joystick.stickX = x;
      this.joystick.stickY = y;
      return;
    }

    const angle = Math.atan2(dy, dx);
    this.joystick.stickX = baseX + Math.cos(angle) * maxDistance;
    this.joystick.stickY = baseY + Math.sin(angle) * maxDistance;
  }

  endJoystick() {
    this.joystick.active = false;
  }

  drawJoystick(ctx: CanvasRenderingContext2D) {
    if (!this.joystick.active || showSettings) return;

    const { baseX, baseY, baseRadius, stickX, stickY, stickRadius } =
      this.joystick;

    drawDPadBase(ctx, baseX, baseY, baseRadius);

    ctx.fillStyle = "#ffffff";
    drawPixelCircle(ctx, stickX, stickY, stickRadius, true);
  }

  consumeLumenLoopRotationDelta(): number {
    const delta = this.lumenLoopRotationDelta;
    this.lumenLoopRotationDelta = 0;
    return delta;
  }

  consumeLumenLoopJumpIntent(): LumenLoopJumpResult | null {
    const intent = this.lumenLoopJumpIntent;
    this.lumenLoopJumpIntent = null;
    return intent;
  }

  bind() {
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const primaryTouch = e.touches[0];
        if (!primaryTouch) return;
        const primaryPoint = this.getTouchPoint(primaryTouch, rect);
        const time = Date.now();
        const x = primaryPoint.x;
        const y = primaryPoint.y;

        if (x > canvasWidth - 50 && y < 50) {
          toggleSettings();
          if (!showSettings) this.ensureReset();
          return;
        }
        if (showSettings) {
          hideSettings();
          this.ensureReset();
          return;
        }
        for (const touch of Array.from(e.changedTouches)) {
          const sample = this.touchToSample(touch, rect);
          if (this.shouldBindLumenGesture(sample)) {
            this.startLumenLoopGesture(touch.identifier, sample);
            break;
          }
        }
        if (e.touches.length >= 2) {
          this.lastPinchDistance = this.computePinchDistance(e.touches, rect);
        }
        const primaryPointerIsLumen = this.doesPointerControlLumen(
          primaryTouch.identifier,
        );

        this.touchStart = { x, y, time };
        this.touchSamples = [{ ...this.touchStart }];
        this.touchSwipe = false;
        this.isJoystickMode = false;

        if (!primaryPointerIsLumen) {
          this.startJoystick(x, y);
          this.game.sprite?.startCharging();
          if (
            this.game.sprite &&
            !this.game.sprite.onGround &&
            !this.game.sprite.inWater &&
            this.game.sprite.vy > 0
          ) {
            this.game.sprite.startGliding();
          }
        }
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        if (!this.touchStart || showSettings) return;

        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        for (const touch of Array.from(e.changedTouches)) {
          const touchSample = this.touchToSample(touch, r);
          this.updateLumenLoopRotation(touch.identifier, touchSample);
        }
        this.handlePinchZoom(e.touches, r);

        const sample: PointSample = {
          x: t.clientX - r.left,
          y: t.clientY - r.top,
          time: Date.now(),
        };
        this.touchSamples.push(sample);
        const cutoff = sample.time - VELOCITY_SAMPLE_TIME;
        this.touchSamples = this.touchSamples.filter((q) => q.time >= cutoff);

        const activePointerIsLumen = this.doesPointerControlLumen(
          t.identifier,
        );
        if (!activePointerIsLumen) {
          this.updateJoystick(sample.x, sample.y);
        }

        const direction = this.calculateDirection(
          this.touchStart.x,
          this.touchStart.y,
          sample.x,
          sample.y,
        );
        const dt = sample.time - this.touchStart.time;

        const sprite = this.game.sprite;
        const spriteAirborne = !!(sprite && !sprite.onGround);
        const spriteSwimming = !!(sprite && sprite.inWater);

        if (!activePointerIsLumen && !this.game.lumenLoop.isActive) {
          if (
            !this.touchSwipe &&
            !this.isJoystickMode &&
            direction.distance >= MIN_SWIPE_DISTANCE &&
            dt >= MIN_SWIPE_TIME
          ) {
            if (spriteAirborne && !spriteSwimming && sprite) {
              this.touchSwipe = true;
              sprite.charging = false;
              sprite.cancelMovementCharging();
            } else if (sprite) {
              this.isJoystickMode = true;
              sprite.charging = false;
              sprite.startMovementCharging(direction);
            }
          } else if (this.isJoystickMode && this.game.sprite) {
            this.game.sprite.updateMovementCharging(direction);
          }
        }

        if (
          !activePointerIsLumen &&
          sprite &&
          spriteAirborne &&
          !spriteSwimming &&
          sprite.vy > 0 &&
          !sprite.gliding &&
          this.game.energyBar?.canUse()
        ) {
          sprite.startGliding();
        }
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const lumenPointerReleased = this.handleLumenTouchesEnded(
          e.changedTouches,
          rect,
        );
        if (e.touches.length < 2) {
          this.lastPinchDistance = null;
        } else {
          this.lastPinchDistance = this.computePinchDistance(e.touches, rect);
        }
        if (!this.touchStart || showSettings) {
          this.endJoystick();
          return;
        }

        const sprite = this.game.sprite;
        const spriteAirborne = !!(sprite && !sprite.onGround);
        const spriteSwimming = !!(sprite && sprite.inWater);

        const endTime = Date.now();
        const last =
          this.touchSamples[this.touchSamples.length - 1] || this.touchStart;
        const dx = last.x - this.touchStart.x;
        const total = Math.max(1, endTime - this.touchStart.time);

        const lumenActive = this.game.lumenLoop.isActive;

        if (
          !lumenActive &&
          this.touchSwipe &&
          sprite &&
          spriteAirborne &&
          !spriteSwimming
        ) {
          this.spawnRideFromGesture(dx, total, last.y);
        } else if (!lumenActive && this.isJoystickMode && this.game.sprite) {
          this.game.sprite.releaseMovement();
        } else if (!lumenPointerReleased) {
          this.game.sprite?.releaseJump();
        }

        this.game.sprite?.stopGliding();
        this.endJoystick();
        this.touchStart = null;
        this.touchSamples = [];
        this.touchSwipe = false;
        this.isJoystickMode = false;
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchcancel",
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        this.handleLumenTouchesEnded(e.changedTouches, rect);
        this.lastPinchDistance = null;
        this.game.sprite?.stopGliding();
        this.endJoystick();
        this.touchStart = null;
        this.touchSamples = [];
        this.touchSwipe = false;
        this.isJoystickMode = false;
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchcancel",
      (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        this.handleLumenTouchesEnded(e.changedTouches, rect);
        this.lastPinchDistance = null;
        this.game.sprite?.stopGliding();
        this.endJoystick();
        this.touchStart = null;
        this.touchSamples = [];
        this.touchSwipe = false;
        this.isJoystickMode = false;
      },
      { passive: false },
    );

    canvas.addEventListener("mousedown", (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const sample: PointSample = { x, y, time: Date.now() };

      if (x > canvasWidth - 50 && y < 50) {
        toggleSettings();
        if (!showSettings) this.ensureReset();
        return;
      }
      if (showSettings) {
        hideSettings();
        this.ensureReset();
        return;
      }
      if (this.shouldBindLumenGesture(sample)) {
        this.startLumenLoopGesture("mouse", sample);
      }

      const mouseControlsLumen = this.doesPointerControlLumen("mouse");

      this.mouseStart = sample;
      this.mouseSamples = [{ ...this.mouseStart }];
      this.isMouseDragging = true;
      this.mouseSwipe = false;
      this.isMouseJoystickMode = false;

      if (!mouseControlsLumen) {
        this.startJoystick(x, y);

        this.game.sprite?.startCharging();
        if (
          this.game.sprite &&
          !this.game.sprite.onGround &&
          !this.game.sprite.inWater &&
          this.game.sprite.vy > 0
        ) {
          this.game.sprite.startGliding();
        }
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      if (!this.isMouseDragging || showSettings || !this.mouseStart) return;

      const r = canvas.getBoundingClientRect();
      const sample: PointSample = {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        time: Date.now(),
      };
      this.mouseSamples.push(sample);
      const cutoff = sample.time - VELOCITY_SAMPLE_TIME;
      this.mouseSamples = this.mouseSamples.filter((q) => q.time >= cutoff);
      this.updateLumenLoopRotation("mouse", sample);

      const mouseControlsLumen = this.doesPointerControlLumen("mouse");
      if (!mouseControlsLumen) {
        this.updateJoystick(sample.x, sample.y);
      }

      const direction = this.calculateDirection(
        this.mouseStart.x,
        this.mouseStart.y,
        sample.x,
        sample.y,
      );
      const dt = sample.time - this.mouseStart.time;

      const sprite = this.game.sprite;
      const spriteAirborne = !!(sprite && !sprite.onGround);
      const spriteSwimming = !!(sprite && sprite.inWater);

      if (!mouseControlsLumen && !this.game.lumenLoop.isActive) {
        if (
          !this.mouseSwipe &&
          !this.isMouseJoystickMode &&
          direction.distance >= MIN_SWIPE_DISTANCE &&
          dt >= MIN_SWIPE_TIME
        ) {
          if (spriteAirborne && !spriteSwimming && sprite) {
            this.mouseSwipe = true;
            sprite.charging = false;
            sprite.cancelMovementCharging();
          } else if (sprite) {
            this.isMouseJoystickMode = true;
            sprite.charging = false;
            sprite.startMovementCharging(direction);
          }
        } else if (this.isMouseJoystickMode && this.game.sprite) {
          this.game.sprite.updateMovementCharging(direction);
        }
      }

      if (
        !mouseControlsLumen &&
        sprite &&
        spriteAirborne &&
        !spriteSwimming &&
        sprite.vy > 0 &&
        !sprite.gliding &&
        this.game.energyBar?.canUse()
      ) {
        sprite.startGliding();
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      const rect = canvas.getBoundingClientRect();
      const sample: PointSample = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        time: Date.now(),
      };
      const lumenPointerReleased = this.endLumenLoopGesture("mouse", sample);
      if (!this.mouseStart || showSettings) {
        this.endJoystick();
        return;
      }

      const endTime = Date.now();
      const last =
        this.mouseSamples[this.mouseSamples.length - 1] || this.mouseStart;
      const dx = last.x - this.mouseStart.x;
      const total = Math.max(1, endTime - this.mouseStart.time);

      const sprite = this.game.sprite;
      const spriteAirborne = !!(sprite && !sprite.onGround);
      const spriteSwimming = !!(sprite && sprite.inWater);

      const lumenActive = this.game.lumenLoop.isActive;

      if (
        !lumenActive &&
        this.mouseSwipe &&
        sprite &&
        spriteAirborne &&
        !spriteSwimming
      ) {
        this.spawnRideFromGesture(dx, total, last.y);
      } else if (!lumenActive && this.isMouseJoystickMode && this.game.sprite) {
        this.game.sprite.releaseMovement();
      } else if (!lumenPointerReleased) {
        this.game.sprite?.releaseJump();
      }

      this.game.sprite?.stopGliding();
      this.endJoystick();
      this.isMouseDragging = false;
      this.mouseStart = null;
      this.mouseSamples = [];
      this.mouseSwipe = false;
      this.isMouseJoystickMode = false;
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (showSettings) return;

        if (this.game.lumenLoop.isActive) {
          const deltaScale = Math.max(
            -0.35,
            Math.min(0.35, -e.deltaY * PINCH_SCROLL_SCALE),
          );
          if (Math.abs(deltaScale) > 0.0001) {
            e.preventDefault();
            this.applyLumenPinchDelta(deltaScale);
            return;
          }
        }

        if (
          Math.abs(e.deltaX) > Math.abs(e.deltaY) &&
          Math.abs(e.deltaX) > 10
        ) {
          e.preventDefault();

          if (!this.trackpadGestureActive) {
            this.trackpadGestureActive = true;
            this.trackpadStartX = e.deltaX;
            this.trackpadStartTime = Date.now();
            return;
          }

          const currentTime = Date.now();
          const totalDeltaX = e.deltaX - this.trackpadStartX;
          const totalTime = currentTime - this.trackpadStartTime;

          if (
            Math.abs(totalDeltaX) > 50 &&
            totalTime > 100 &&
            this.game.sprite &&
            !this.game.sprite.onGround &&
            !this.game.sprite.inWater
          ) {
            const rect = canvas.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;
            this.spawnRideFromGesture(totalDeltaX, totalTime, mouseY);
            this.trackpadGestureActive = false;
          }
        } else {
          this.trackpadGestureActive = false;
        }
      },
      { passive: false },
    );

    canvas.addEventListener("mouseleave", () => {
      this.trackpadGestureActive = false;
    });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !showSettings && !this.keyboardCharging) {
        e.preventDefault();
        this.keyboardCharging = true;
        this.keyboardChargeStart = Date.now();
        this.game.sprite?.startCharging();
        if (
          this.game.sprite &&
          !this.game.sprite.onGround &&
          !this.game.sprite.inWater &&
          this.game.sprite.vy > 0
        ) {
          this.game.sprite.startGliding();
        }
      }

      if (
        !showSettings &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
      ) {
        e.preventDefault();
        this.pressedKeys.add(e.code);

        if (!this.keyboardMovementCharging) {
          this.keyboardMovementCharging = true;
          this.updateKeyboardMovementDirection();
          this.game.sprite?.startMovementCharging(
            this.keyboardMovementDirection,
          );
        } else {
          this.updateKeyboardMovementDirection();
          this.game.sprite?.updateMovementCharging(
            this.keyboardMovementDirection,
          );
        }
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.code === "Space" && !showSettings && this.keyboardCharging) {
        e.preventDefault();
        this.keyboardCharging = false;
        this.game.sprite?.releaseJump();
        this.game.sprite?.stopGliding();
      }

      if (
        !showSettings &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
      ) {
        e.preventDefault();
        this.pressedKeys.delete(e.code);

        if (this.pressedKeys.size === 0 && this.keyboardMovementCharging) {
          this.keyboardMovementCharging = false;
          this.game.sprite?.releaseMovement();
        } else if (this.keyboardMovementCharging) {
          this.updateKeyboardMovementDirection();
          this.game.sprite?.updateMovementCharging(
            this.keyboardMovementDirection,
          );
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.code === "Space" ||
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)
      ) {
        e.preventDefault();
      }
    });
  }

  updateKeyboardMovementDirection() {
    let x = 0;
    let y = 0;

    if (this.pressedKeys.has("ArrowLeft")) x -= 1;
    if (this.pressedKeys.has("ArrowRight")) x += 1;
    if (this.pressedKeys.has("ArrowUp")) y -= 1;
    if (this.pressedKeys.has("ArrowDown")) y += 1;

    const length = Math.sqrt(x * x + y * y);
    if (length > 0) {
      x /= length;
      y /= length;
    }

    this.keyboardMovementDirection = { x, y };
  }

  spawnRideFromGesture(dx: number, totalTimeMs: number, screenY: number) {
    if (this.game.lumenLoop.isActive) {
      return;
    }
    const sprite = this.game.sprite;
    if (!sprite) {
      return;
    }

    const isAirborne = !sprite.onGround || Math.abs(sprite.vy) > 0.01;
    if (!isAirborne || sprite.inWater) {
      return;
    }

    const activeMovers = countActiveMovingRides(this.game.rides);
    if (activeMovers >= MAX_RIDES) return;

    const gesture: RideGesture = {
      distance: dx,
      durationMs: totalTimeMs,
      screenY,
      cameraY,
      canvasWidth,
    };

    const ride = createRideFromInput(gesture);
    this.game.rides.push(ride);
  }

  private shouldBindLumenGesture(sample: PointSample): boolean {
    if (this.lumenLoopGesture.pointerId !== null) return false;
    if (this.game.lumenLoop.isActive) return true;
    return this.isPointOnSprite(sample.x, sample.y);
  }

  private startLumenLoopGesture(
    pointerId: PointerKey,
    sample: PointSample,
  ): void {
    if (!this.shouldBindLumenGesture(sample)) return;
    this.lumenLoopGesture.pointerId = pointerId;
    this.lumenLoopGesture.lastAngle = this.computeAngleToSprite(
      sample.x,
      sample.y,
    );
    this.lumenLoopGesture.accumulatedAngle = 0;
    this.lumenLoopGesture.pendingActivation = !this.game.lumenLoop.isActive;
    this.lumenLoopGesture.dragStart = sample;
    this.lumenLoopGesture.lastSample = sample;
    this.lumenLoopGesture.jumpDragStart = null;
    this.lumenLoopGesture.claimedInput = this.game.lumenLoop.isActive;
    if (this.game.lumenLoop.isActive) {
      this.claimLumenPointerControl();
    }
  }

  private updateLumenLoopRotation(
    pointerId: PointerKey,
    sample: PointSample,
  ): void {
    if (this.lumenLoopGesture.pointerId !== pointerId) return;
    const sprite = this.game.sprite;
    if (!sprite) return;

    const loopState = this.game.lumenLoop;
    const previousSample = this.lumenLoopGesture.lastSample;
    const prevAngle = this.lumenLoopGesture.lastAngle;
    const angle = this.computeAngleToSprite(sample.x, sample.y);
    const delta = normalizeAngle(angle - prevAngle);
    this.lumenLoopGesture.lastAngle = angle;
    this.lumenLoopGesture.lastSample = sample;

    if (!Number.isFinite(delta)) return;

    if (!loopState.isActive && this.lumenLoopGesture.pendingActivation) {
      this.lumenLoopGesture.accumulatedAngle += delta;
      if (
        !this.lumenLoopGesture.claimedInput &&
        Math.abs(this.lumenLoopGesture.accumulatedAngle) >=
          LUMEN_INPUT_CLAIM_THRESHOLD
      ) {
        this.claimLumenPointerControl();
      }
      if (
        Math.abs(this.lumenLoopGesture.accumulatedAngle) >=
        LUMEN_ROTATION_ACTIVATION
      ) {
        const activated = activateLumenLoop(loopState);
        if (activated) {
          this.lumenLoopGesture.pendingActivation = false;
          this.lumenLoopGesture.accumulatedAngle = 0;
          this.claimLumenPointerControl();
        }
      }
    }

    if (loopState.isActive) {
      this.lumenLoopRotationDelta += delta;
      this.lumenLoopGesture.pendingActivation = false;

      if (previousSample) {
        const deltaY = sample.y - previousSample.y;
        if (deltaY > 0) {
          if (!this.lumenLoopGesture.jumpDragStart) {
            this.lumenLoopGesture.jumpDragStart = previousSample;
          }
        } else if (deltaY < -1) {
          this.lumenLoopGesture.jumpDragStart = null;
        }
      }
    }
  }

  private handleLumenTouchesEnded(touches: TouchList, rect: DOMRect): boolean {
    let consumed = false;
    for (const touch of Array.from(touches)) {
      const sample = this.touchToSample(touch, rect);
      consumed = this.endLumenLoopGesture(touch.identifier, sample) || consumed;
    }
    return consumed;
  }

  private endLumenLoopGesture(
    pointerId: PointerKey,
    sample?: PointSample,
  ): boolean {
    if (this.lumenLoopGesture.pointerId !== pointerId) return false;
    const consumeRelease =
      this.lumenLoopGesture.claimedInput || this.game.lumenLoop.isActive;
    const finalSample = sample ?? this.lumenLoopGesture.lastSample;
    const dragStart = this.lumenLoopGesture.jumpDragStart;
    if (
      consumeRelease &&
      this.game.lumenLoop.isActive &&
      dragStart &&
      finalSample &&
      finalSample.time >= dragStart.time
    ) {
      const dy = finalSample.y - dragStart.y;
      const duration = finalSample.time - dragStart.time;
      if (dy >= MIN_SWIPE_DISTANCE && duration >= MIN_SWIPE_TIME) {
        const direction = this.calculateDirection(
          dragStart.x,
          dragStart.y,
          finalSample.x,
          finalSample.y,
        );
        if (direction.y > 0.3) {
          this.lumenLoopJumpIntent = triggerLumenLoopJump(this.game.lumenLoop, {
            x: direction.x,
            y: direction.y,
          });
        }
      }
    }
    this.resetLumenLoopGesture();
    return consumeRelease;
  }

  private resetLumenLoopGesture(): void {
    this.lumenLoopGesture.pointerId = null;
    this.lumenLoopGesture.lastAngle = 0;
    this.lumenLoopGesture.accumulatedAngle = 0;
    this.lumenLoopGesture.pendingActivation = false;
    this.lumenLoopGesture.dragStart = null;
    this.lumenLoopGesture.lastSample = null;
    this.lumenLoopGesture.jumpDragStart = null;
    this.lumenLoopGesture.claimedInput = false;
  }

  private handlePinchZoom(touches: TouchList, rect: DOMRect): void {
    if (!this.game.lumenLoop.isActive) {
      this.lastPinchDistance = null;
      return;
    }
    if (touches.length < 2) {
      this.lastPinchDistance = null;
      return;
    }
    const distance = this.computePinchDistance(touches, rect);
    if (distance <= 0) return;
    if (this.lastPinchDistance == null) {
      this.lastPinchDistance = distance;
      return;
    }
    const deltaScale =
      (distance - this.lastPinchDistance) / Math.max(distance, 1);
    if (Math.abs(deltaScale) > 0.0001) {
      this.applyLumenPinchDelta(deltaScale);
    }
    this.lastPinchDistance = distance;
  }

  private doesPointerControlLumen(pointerId: PointerKey | null): boolean {
    if (pointerId == null) return false;
    if (this.lumenLoopGesture.pointerId !== pointerId) return false;
    if (this.game.lumenLoop.isActive) return true;
    return this.lumenLoopGesture.claimedInput;
  }

  private claimLumenPointerControl(): void {
    if (this.lumenLoopGesture.claimedInput) return;
    this.lumenLoopGesture.claimedInput = true;
    this.touchSwipe = false;
    this.isJoystickMode = false;
    this.mouseSwipe = false;
    this.isMouseJoystickMode = false;
    this.endJoystick();
    const sprite = this.game.sprite;
    if (sprite) {
      sprite.charging = false;
      sprite.chargeTime = 0;
      sprite.cancelMovementCharging();
      sprite.stopGliding();
    }
  }

  private computePinchDistance(touches: TouchList, rect: DOMRect): number {
    const first = touches.item(0);
    const second = touches.item(1);
    if (!first || !second) return 0;
    const a = this.getTouchPoint(first, rect);
    const b = this.getTouchPoint(second, rect);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private applyLumenPinchDelta(deltaScale: number): void {
    if (!this.game.lumenLoop.isActive) return;
    const result = applyLumenLoopPinch(this.game.lumenLoop, deltaScale);
    if (result.shouldDismiss) {
      deactivateLumenLoop(this.game.lumenLoop);
      this.resetLumenLoopGesture();
    }
  }

  private getTouchPoint(touch: Touch, rect: DOMRect) {
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  private touchToSample(touch: Touch, rect: DOMRect): PointSample {
    const point = this.getTouchPoint(touch, rect);
    return { ...point, time: Date.now() };
  }

  private computeAngleToSprite(x: number, y: number): number {
    const sprite = this.game.sprite;
    if (!sprite) return 0;
    const centerY = sprite.y - cameraY;
    return Math.atan2(y - centerY, x - sprite.x);
  }

  private getSpriteScreenPosition(): { x: number; y: number } | null {
    const sprite = this.game.sprite;
    if (!sprite) return null;
    return { x: sprite.x, y: sprite.y - cameraY };
  }

  private isPointOnSprite(x: number, y: number): boolean {
    const center = this.getSpriteScreenPosition();
    if (!center) return false;
    const dx = x - center.x;
    const dy = y - center.y;
    const radius = SPRITE_SIZE * 0.75;
    return dx * dx + dy * dy <= radius * radius;
  }
}

function normalizeAngle(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  let result = delta;
  while (result > Math.PI) result -= TWO_PI;
  while (result < -Math.PI) result += TWO_PI;
  return result;
}
