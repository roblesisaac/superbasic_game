import {
  MIN_SWIPE_DISTANCE,
  MIN_SWIPE_TIME,
  VELOCITY_SAMPLE_TIME
} from './constants.js';
import { canvas, canvasWidth } from './globals.js';
import {
  showSettings,
  toggleSettings,
  hideSettings,
  isJoystickEnabled
} from './settings.js';
import { SwipeController } from './swipe.js';
import { JoystickController } from './joystick.js';

export class InputHandler {
  constructor(game, ensureReset) {
    this.game = game;
    this.ensureReset = ensureReset;

    this.touchStart = null;
    this.touchSamples = [];
    this.touchSwipe = false;
    this.touchContext = null;

    this.mouseStart = null;
    this.mouseSamples = [];
    this.isMouseDragging = false;
    this.mouseSwipe = false;
    this.mouseContext = null;

    // Keyboard jump charge (space)
    this.keyboardCharging = false;
    this.keyboardChargeStart = 0;

    // Keyboard movement (arrow keys)
    this.keyboardMovementCharging = false;
    this.keyboardMovementDirection = { x: 0, y: 0 };
    this.pressedKeys = new Set();

    // Trackpad gesture support
    this.trackpadGestureActive = false;
    this.trackpadStartX = 0;
    this.trackpadStartTime = 0;

    // Arrow-key spawn debounce
    this.lastArrowTime = 0;
    this.arrowCooldownMs = 140;

    this.swipeController = new SwipeController(game);
    this.joystick = new JoystickController(game);

    this.bind();
  }

  calculateDirection(startX, startY, currentX, currentY) {
    const dx = currentX - startX;
    const dy = currentY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) return { x: 0, y: 0, distance: 0 };

    return {
      x: dx / distance,
      y: dy / distance,
      distance
    };
  }

  bind() {
    // ----------------------------
    // Touch
    // ----------------------------
    canvas.addEventListener('touchstart', (e) => {
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
      if (showSettings) { hideSettings(); this.ensureReset(); return; }

      const startPoint = { x, y, time: Date.now() };
      this.touchStart = startPoint;
      this.touchSamples = [{ ...startPoint }];
      this.touchSwipe = false;
      this.touchContext = {
        spawnEnabled: isJoystickEnabled(),
        startedOnGround: this.game.sprite.onGround
      };

      if (this.touchContext.spawnEnabled || this.touchContext.startedOnGround) {
        this.joystick.start(startPoint, this.game.sprite, {
          allowSpawn: this.touchContext.spawnEnabled,
          startScreenY: y
        });
      } else {
        this.joystick.cancel();
      }

      this.game.sprite.startCharging();
      if (!this.game.sprite.onGround && this.game.sprite.vy > 0) {
        this.game.sprite.startGliding();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.touchStart || showSettings) return;

      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const s = { x: t.clientX - r.left, y: t.clientY - r.top, time: Date.now() };
      this.touchSamples.push(s);
      const cutoff = s.time - VELOCITY_SAMPLE_TIME;
      this.touchSamples = this.touchSamples.filter(q => q.time >= cutoff);

      const dir = this.calculateDirection(this.touchStart.x, this.touchStart.y, s.x, s.y);
      const dt = s.time - this.touchStart.time;
      const spawnEnabled = this.touchContext ? this.touchContext.spawnEnabled : isJoystickEnabled();

      if (this.game.sprite.onGround) {
        this.joystick.update(s, this.game.sprite);
      } else if (spawnEnabled) {
        this.game.sprite.charging = false;
        this.game.sprite.movementCharging = false;
        this.joystick.update(s, this.game.sprite);
      } else if (!this.touchSwipe && dir.distance >= MIN_SWIPE_DISTANCE && dt >= MIN_SWIPE_TIME) {
        this.touchSwipe = true;
        this.game.sprite.charging = false;
        this.game.sprite.movementCharging = false;
        this.joystick.cancel();
      }

      if (!this.game.sprite.onGround && this.game.sprite.vy > 0 && !this.game.sprite.gliding && this.game.energyBar.canUse()) {
        this.game.sprite.startGliding();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!this.touchStart || showSettings) return;

      const endTime = Date.now();
      const last = this.touchSamples[this.touchSamples.length - 1] || this.touchStart;
      const dx = last.x - this.touchStart.x;
      const total = Math.max(1, endTime - this.touchStart.time);

      const joystickResult = this.joystick.end({ ...last, time: endTime }, this.game.sprite);
      let handled = joystickResult.handled;

      if (!this.game.sprite.onGround && (!this.touchContext || !this.touchContext.spawnEnabled) && this.touchSwipe) {
        this.swipeController.spawnFromGesture(dx, total, last.y);
        handled = true;
      }

      if (!handled) {
        this.game.sprite.releaseJump();
      }

      this.game.sprite.stopGliding();
      this.touchStart = null;
      this.touchSamples = [];
      this.touchSwipe = false;
      this.touchContext = null;
    }, { passive: false });

    // ----------------------------
    // Mouse
    // ----------------------------
    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;

      if (x > canvasWidth - 50 && y < 50) {
        toggleSettings();
        if (!showSettings) this.ensureReset();
        return;
      }
      if (showSettings) { hideSettings(); this.ensureReset(); return; }

      const startPoint = { x, y, time: Date.now() };
      this.mouseStart = startPoint;
      this.mouseSamples = [{ ...startPoint }];
      this.isMouseDragging = true;
      this.mouseSwipe = false;
      this.mouseContext = {
        spawnEnabled: isJoystickEnabled(),
        startedOnGround: this.game.sprite.onGround
      };

      if (this.mouseContext.spawnEnabled || this.mouseContext.startedOnGround) {
        this.joystick.start(startPoint, this.game.sprite, {
          allowSpawn: this.mouseContext.spawnEnabled,
          startScreenY: y
        });
      } else {
        this.joystick.cancel();
      }

      this.game.sprite.startCharging();
      if (!this.game.sprite.onGround && this.game.sprite.vy > 0) {
        this.game.sprite.startGliding();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isMouseDragging || showSettings) return;

      const r = canvas.getBoundingClientRect();
      const s = { x: e.clientX - r.left, y: e.clientY - r.top, time: Date.now() };
      this.mouseSamples.push(s);
      const cutoff = s.time - VELOCITY_SAMPLE_TIME;
      this.mouseSamples = this.mouseSamples.filter(q => q.time >= cutoff);

      const dir = this.calculateDirection(this.mouseStart.x, this.mouseStart.y, s.x, s.y);
      const dt = s.time - this.mouseStart.time;
      const spawnEnabled = this.mouseContext ? this.mouseContext.spawnEnabled : isJoystickEnabled();

      if (this.game.sprite.onGround) {
        this.joystick.update(s, this.game.sprite);
      } else if (spawnEnabled) {
        this.game.sprite.charging = false;
        this.game.sprite.movementCharging = false;
        this.joystick.update(s, this.game.sprite);
      } else if (!this.mouseSwipe && dir.distance >= MIN_SWIPE_DISTANCE && dt >= MIN_SWIPE_TIME) {
        this.mouseSwipe = true;
        this.game.sprite.charging = false;
        this.game.sprite.movementCharging = false;
        this.joystick.cancel();
      }

      if (!this.game.sprite.onGround && this.game.sprite.vy > 0 && !this.game.sprite.gliding && this.game.energyBar.canUse()) {
        this.game.sprite.startGliding();
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (!this.mouseStart || showSettings) return;

      const endTime = Date.now();
      const last = this.mouseSamples[this.mouseSamples.length - 1] || this.mouseStart;
      const dx = last.x - this.mouseStart.x;
      const total = Math.max(1, endTime - this.mouseStart.time);

      const joystickResult = this.joystick.end({ ...last, time: endTime }, this.game.sprite);
      let handled = joystickResult.handled;

      if (!this.game.sprite.onGround && (!this.mouseContext || !this.mouseContext.spawnEnabled) && this.mouseSwipe) {
        this.swipeController.spawnFromGesture(dx, total, last.y);
        handled = true;
      }

      if (!handled) {
        this.game.sprite.releaseJump();
      }

      this.game.sprite.stopGliding();
      this.isMouseDragging = false;
      this.mouseStart = null;
      this.mouseSamples = [];
      this.mouseSwipe = false;
      this.mouseContext = null;
    });

    // ----------------------------
    // Trackpad (two-finger horizontal swipe)
    // ----------------------------
    canvas.addEventListener('wheel', (e) => {
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

        if (Math.abs(totalDeltaX) > 50 && totalTime > 100 && !this.game.sprite.onGround) {
          const rect = canvas.getBoundingClientRect();
          const mouseY = e.clientY - rect.top;
          this.swipeController.spawnFromGesture(totalDeltaX, totalTime, mouseY);
          this.trackpadGestureActive = false;
        }
      } else {
        this.trackpadGestureActive = false;
      }
    }, { passive: false });

    canvas.addEventListener('mouseleave', () => {
      this.trackpadGestureActive = false;
    });

    // ----------------------------
    // Keyboard: Jump (Space)
    // ----------------------------
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !showSettings && !this.keyboardCharging) {
        e.preventDefault();
        this.keyboardCharging = true;
        this.keyboardChargeStart = Date.now();
        this.game.sprite.startCharging();
        if (!this.game.sprite.onGround && this.game.sprite.vy > 0) this.game.sprite.startGliding();
      }

      if (!showSettings && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        this.pressedKeys.add(e.code);

        if (!this.keyboardMovementCharging) {
          this.keyboardMovementCharging = true;
          this.updateKeyboardMovementDirection();
          this.game.sprite.startMovementCharging(this.keyboardMovementDirection);
        } else {
          this.updateKeyboardMovementDirection();
          this.game.sprite.updateMovementCharging(this.keyboardMovementDirection);
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && !showSettings && this.keyboardCharging) {
        e.preventDefault();
        this.keyboardCharging = false;
        this.game.sprite.releaseJump();
        this.game.sprite.stopGliding();
      }

      if (!showSettings && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        this.pressedKeys.delete(e.code);

        if (this.pressedKeys.size === 0 && this.keyboardMovementCharging) {
          this.keyboardMovementCharging = false;
          this.game.sprite.releaseMovement();
        } else if (this.keyboardMovementCharging) {
          this.updateKeyboardMovementDirection();
          this.game.sprite.updateMovementCharging(this.keyboardMovementDirection);
        }
      }
    });

    // Prevent space from scrolling the page
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

  draw(ctx) {
    this.joystick.draw(ctx);
  }
}
