import {
  MIN_SWIPE_DISTANCE,
  MIN_SWIPE_TIME,
  VELOCITY_SAMPLE_TIME,
  MAX_RIDES,
} from '../../config/constants.js';
import { canvas, canvasWidth } from './state/rendering_state.js';
import { cameraY } from './state/camera_state.js';
import type { GameWorldState } from './state/game_state.js';
import { createRideFromInput, countActiveMovingRides } from '../game_objects/rides.js';
import { showSettings, toggleSettings, hideSettings } from '../gui/settings_overlay.js';

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

function drawDPadBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
): void {
  const pixel = JOYSTICK_PIXEL_SIZE;
  const maxOffset = Math.floor(radius / pixel) * pixel;
  const halfThickness = pixel;

  ctx.fillStyle = '#ffffff';

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

  ctx.fillStyle = '#000000';

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
  fill = false
): void {
  if (fill) {
    for (let px = -radius; px <= radius; px += JOYSTICK_PIXEL_SIZE) {
      for (let py = -radius; py <= radius; py += JOYSTICK_PIXEL_SIZE) {
        const distance = Math.sqrt(px * px + py * py);
        if (distance <= radius - JOYSTICK_PIXEL_SIZE / 2) {
          ctx.fillRect(x + px, y + py, JOYSTICK_PIXEL_SIZE, JOYSTICK_PIXEL_SIZE);
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

    this.bind();
  }

  calculateDirection(startX: number, startY: number, currentX: number, currentY: number) {
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
    if (!this.joystick.active || showSettings || this.isWellMode()) return;

    const { baseX, baseY, baseRadius, stickX, stickY, stickRadius } = this.joystick;

    drawDPadBase(ctx, baseX, baseY, baseRadius);

    ctx.fillStyle = '#ffffff';
    drawPixelCircle(ctx, stickX, stickY, stickRadius, true);
  }

  private resetTouchState(): void {
    this.touchStart = null;
    this.touchSamples = [];
    this.touchSwipe = false;
    this.isJoystickMode = false;
    this.endJoystick();
  }

  private resetMouseState(): void {
    this.isMouseDragging = false;
    this.mouseStart = null;
    this.mouseSamples = [];
    this.mouseSwipe = false;
    this.isMouseJoystickMode = false;
    this.endJoystick();
  }

  private isWellMode(): boolean {
    return this.game.mode === 'well' && !!this.game.wellExperience;
  }

  private handleWellPointer(eventType: 'start' | 'move' | 'end', x?: number, y?: number): boolean {
    if (!this.isWellMode() || !this.game.wellExperience) return false;
    if (eventType === 'start' && x !== undefined && y !== undefined) {
      this.game.wellExperience.onPointerStart(x, y);
    } else if (eventType === 'move' && x !== undefined && y !== undefined) {
      this.game.wellExperience.onPointerMove(x, y);
    } else if (eventType === 'end') {
      this.game.wellExperience.onPointerEnd();
    }
    return true;
  }

  bind() {
    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

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

        if (this.handleWellPointer('start', x, y)) {
          this.resetTouchState();
          return;
        }

        this.touchStart = { x, y, time: Date.now() };
        this.touchSamples = [{ ...this.touchStart }];
        this.touchSwipe = false;
        this.isJoystickMode = false;

        this.startJoystick(x, y);

        this.game.sprite?.startCharging();
        if (this.game.sprite && !this.game.sprite.onGround && this.game.sprite.vy > 0) {
          this.game.sprite.startGliding();
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        const sample: PointSample = {
          x: t.clientX - r.left,
          y: t.clientY - r.top,
          time: Date.now(),
        };

        if (this.handleWellPointer('move', sample.x, sample.y)) {
          return;
        }

        if (!this.touchStart || showSettings) return;

        this.touchSamples.push(sample);
        const cutoff = sample.time - VELOCITY_SAMPLE_TIME;
        this.touchSamples = this.touchSamples.filter((q) => q.time >= cutoff);
        this.updateJoystick(sample.x, sample.y);

        const direction = this.calculateDirection(
          this.touchStart.x,
          this.touchStart.y,
          sample.x,
          sample.y
        );
        const dt = sample.time - this.touchStart.time;

        if (
          !this.touchSwipe &&
          !this.isJoystickMode &&
          direction.distance >= MIN_SWIPE_DISTANCE &&
          dt >= MIN_SWIPE_TIME
        ) {
          if (this.game.sprite && !this.game.sprite.onGround) {
            this.touchSwipe = true;
            this.game.sprite.charging = false;
            this.game.sprite.movementCharging = false;
          } else if (this.game.sprite) {
            this.isJoystickMode = true;
            this.game.sprite.charging = false;
            this.game.sprite.startMovementCharging(direction);
          }
        } else if (this.isJoystickMode && this.game.sprite) {
          this.game.sprite.updateMovementCharging(direction);
        }

        if (
          this.game.sprite &&
          !this.game.sprite.onGround &&
          this.game.sprite.vy > 0 &&
          !this.game.sprite.gliding &&
          this.game.energyBar?.canUse()
        ) {
          this.game.sprite.startGliding();
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        if (this.handleWellPointer('end')) {
          this.resetTouchState();
          return;
        }

        if (!this.touchStart || showSettings) {
          this.endJoystick();
          return;
        }

        const endTime = Date.now();
        const last = this.touchSamples[this.touchSamples.length - 1] || this.touchStart;
        const dx = last.x - this.touchStart.x;
        const total = Math.max(1, endTime - this.touchStart.time);

        if (this.touchSwipe && this.game.sprite && !this.game.sprite.onGround) {
          this.spawnRideFromGesture(dx, total, last.y);
        } else if (this.isJoystickMode && this.game.sprite) {
          this.game.sprite.releaseMovement();
        } else {
          this.game.sprite?.releaseJump();
        }

        this.game.sprite?.stopGliding();
        this.endJoystick();
        this.touchStart = null;
        this.touchSamples = [];
        this.touchSwipe = false;
        this.isJoystickMode = false;
      },
      { passive: false }
    );

    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;

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

      if (this.handleWellPointer('start', x, y)) {
        this.resetMouseState();
        return;
      }

      this.mouseStart = { x, y, time: Date.now() };
      this.mouseSamples = [{ ...this.mouseStart }];
      this.isMouseDragging = true;
      this.mouseSwipe = false;
      this.isMouseJoystickMode = false;

      this.startJoystick(x, y);

      this.game.sprite?.startCharging();
      if (this.game.sprite && !this.game.sprite.onGround && this.game.sprite.vy > 0) {
        this.game.sprite.startGliding();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const sample: PointSample = {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        time: Date.now(),
      };

      if (this.handleWellPointer('move', sample.x, sample.y)) {
        return;
      }

      if (!this.isMouseDragging || showSettings || !this.mouseStart) return;

      this.mouseSamples.push(sample);
      const cutoff = sample.time - VELOCITY_SAMPLE_TIME;
      this.mouseSamples = this.mouseSamples.filter((q) => q.time >= cutoff);
      this.updateJoystick(sample.x, sample.y);

      const direction = this.calculateDirection(
        this.mouseStart.x,
        this.mouseStart.y,
        sample.x,
        sample.y
      );
      const dt = sample.time - this.mouseStart.time;

      if (
        !this.mouseSwipe &&
        !this.isMouseJoystickMode &&
        direction.distance >= MIN_SWIPE_DISTANCE &&
        dt >= MIN_SWIPE_TIME
      ) {
        if (this.game.sprite && !this.game.sprite.onGround) {
          this.mouseSwipe = true;
          this.game.sprite.charging = false;
          this.game.sprite.movementCharging = false;
        } else if (this.game.sprite) {
          this.isMouseJoystickMode = true;
          this.game.sprite.charging = false;
          this.game.sprite.startMovementCharging(direction);
        }
      } else if (this.isMouseJoystickMode && this.game.sprite) {
        this.game.sprite.updateMovementCharging(direction);
      }

      if (
        this.game.sprite &&
        !this.game.sprite.onGround &&
        this.game.sprite.vy > 0 &&
        !this.game.sprite.gliding &&
        this.game.energyBar?.canUse()
      ) {
        this.game.sprite.startGliding();
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (this.handleWellPointer('end')) {
        this.resetMouseState();
        return;
      }

      if (!this.mouseStart || showSettings) {
        this.endJoystick();
        return;
      }

      const endTime = Date.now();
      const last = this.mouseSamples[this.mouseSamples.length - 1] || this.mouseStart;
      const dx = last.x - this.mouseStart.x;
      const total = Math.max(1, endTime - this.mouseStart.time);

      if (this.mouseSwipe && this.game.sprite && !this.game.sprite.onGround) {
        this.spawnRideFromGesture(dx, total, last.y);
      } else if (this.isMouseJoystickMode && this.game.sprite) {
        this.game.sprite.releaseMovement();
      } else {
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
      'wheel',
      (e) => {
        if (showSettings) return;
        if (this.isWellMode()) return;

        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10) {
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
            !this.game.sprite.onGround
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
      { passive: false }
    );

    canvas.addEventListener('mouseleave', () => {
      this.trackpadGestureActive = false;
    });

    document.addEventListener('keydown', (e) => {
      if (this.isWellMode()) return;
      if (e.code === 'Space' && !showSettings && !this.keyboardCharging) {
        e.preventDefault();
        this.keyboardCharging = true;
        this.keyboardChargeStart = Date.now();
        this.game.sprite?.startCharging();
        if (this.game.sprite && !this.game.sprite.onGround && this.game.sprite.vy > 0) {
          this.game.sprite.startGliding();
        }
      }

      if (!showSettings && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        this.pressedKeys.add(e.code);

        if (!this.keyboardMovementCharging) {
          this.keyboardMovementCharging = true;
          this.updateKeyboardMovementDirection();
          this.game.sprite?.startMovementCharging(this.keyboardMovementDirection);
        } else {
          this.updateKeyboardMovementDirection();
          this.game.sprite?.updateMovementCharging(this.keyboardMovementDirection);
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (this.isWellMode()) return;
      if (e.code === 'Space' && !showSettings && this.keyboardCharging) {
        e.preventDefault();
        this.keyboardCharging = false;
        this.game.sprite?.releaseJump();
        this.game.sprite?.stopGliding();
      }

      if (!showSettings && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        this.pressedKeys.delete(e.code);

        if (this.pressedKeys.size === 0 && this.keyboardMovementCharging) {
          this.keyboardMovementCharging = false;
          this.game.sprite?.releaseMovement();
        } else if (this.keyboardMovementCharging) {
          this.updateKeyboardMovementDirection();
          this.game.sprite?.updateMovementCharging(this.keyboardMovementDirection);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (this.isWellMode()) return;
      if (e.code === 'Space' || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
  }

  updateKeyboardMovementDirection() {
    let x = 0;
    let y = 0;

    if (this.pressedKeys.has('ArrowLeft')) x -= 1;
    if (this.pressedKeys.has('ArrowRight')) x += 1;
    if (this.pressedKeys.has('ArrowUp')) y -= 1;
    if (this.pressedKeys.has('ArrowDown')) y += 1;

    const length = Math.sqrt(x * x + y * y);
    if (length > 0) {
      x /= length;
      y /= length;
    }

    this.keyboardMovementDirection = { x, y };
  }

  spawnRideFromGesture(dx: number, totalTimeMs: number, screenY: number) {
    if (!this.game.sprite || this.game.sprite.onGround) return;

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
}
