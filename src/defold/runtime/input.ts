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

        this.touchStart = { x, y, time: Date.now() };
        this.touchSamples = [{ ...this.touchStart }];
        this.touchSwipe = false;
        this.isJoystickMode = false;

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
        if (!this.touchStart || showSettings) return;

        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        const sample: PointSample = {
          x: t.clientX - r.left,
          y: t.clientY - r.top,
          time: Date.now(),
        };
        this.touchSamples.push(sample);
        const cutoff = sample.time - VELOCITY_SAMPLE_TIME;
        this.touchSamples = this.touchSamples.filter((q) => q.time >= cutoff);

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
        if (!this.touchStart || showSettings) return;

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

      this.mouseStart = { x, y, time: Date.now() };
      this.mouseSamples = [{ ...this.mouseStart }];
      this.isMouseDragging = true;
      this.mouseSwipe = false;
      this.isMouseJoystickMode = false;

      this.game.sprite?.startCharging();
      if (this.game.sprite && !this.game.sprite.onGround && this.game.sprite.vy > 0) {
        this.game.sprite.startGliding();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
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
      if (!this.mouseStart || showSettings) return;

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
