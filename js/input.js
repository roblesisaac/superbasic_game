import {
  MIN_SWIPE_DISTANCE,
  MIN_SWIPE_TIME,
  VELOCITY_SAMPLE_TIME,
  MIN_PLATFORM_SPEED,
  MAX_PLATFORM_SPEED,
  MAX_PLATFORMS,
  PLATFORM_MIN_WIDTH,
  PLATFORM_MAX_WIDTH
} from './constants.js';
import { canvas, canvasWidth, cameraY } from './globals.js';
import { Platform } from './platforms.js';
import { clamp } from './utils.js';
import { showSettings, toggleSettings, hideSettings } from './settings.js';

export class InputHandler {
  constructor(game, ensureReset) {
    this.game = game;
    this.ensureReset = ensureReset;

    this.touchStart = null;
    this.lastTouch = null;
    this.touchSamples = [];
    this.touchSwipe = false;
    this.touchMode = null; // 'move' or 'platform'

    this.mouseStart = null;
    this.lastMouse = null;
    this.mouseSamples = [];
    this.mouseSwipe = false;
    this.isMouseDown = false;
    this.mouseMode = null;

    this.arrowState = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
    this.arrowCharging = false;
    this.spaceCharging = false;

    this.lastArrowTime = 0;
    this.arrowCooldownMs = 140;

    this.trackpadGestureActive = false;
    this.trackpadStartX = 0;
    this.trackpadStartTime = 0;

    this.bind();
  }

  _startCharge() {
    this.game.sprite.startCharging();
    if (!this.game.sprite.onGround && this.game.sprite.vy > 0) this.game.sprite.startGliding();
  }

  _finishCharge(dx, dy) {
    if (Math.hypot(dx, dy) <= MIN_SWIPE_DISTANCE) this.game.sprite.releaseJump();
    else this.game.sprite.releaseMove(dx, dy);
    this.game.sprite.stopGliding();
  }

  bind() {
    // Touch
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const x = t.clientX - r.left;
      const y = t.clientY - r.top;

      if (x > canvasWidth - 50 && y < 50) {
        e.preventDefault();
        toggleSettings();
        if (!showSettings) this.ensureReset();
        return;
      }
      if (showSettings) {
        e.preventDefault();
        hideSettings();
        this.ensureReset();
        return;
      }

      e.preventDefault();
      if (this.game.sprite.onGround) {
        this.touchMode = 'move';
        this.touchStart = { x, y };
        this.lastTouch = { x, y };
        this._startCharge();
      } else {
        this.touchMode = 'platform';
        const time = Date.now();
        this.touchStart = { x, y, time };
        this.touchSamples = [{ ...this.touchStart }];
        this.touchSwipe = false;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (!this.touchStart || showSettings) return;
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const x = t.clientX - r.left;
      const y = t.clientY - r.top;
      if (this.touchMode === 'move') {
        this.lastTouch = { x, y };
      } else {
        const s = { x, y, time: Date.now() };
        this.touchSamples.push(s);
        const cutoff = s.time - VELOCITY_SAMPLE_TIME;
        this.touchSamples = this.touchSamples.filter(q => q.time >= cutoff);
        const dx = s.x - this.touchStart.x;
        const dt = s.time - this.touchStart.time;
        if (!this.touchSwipe && Math.abs(dx) >= MIN_SWIPE_DISTANCE && dt >= MIN_SWIPE_TIME) {
          this.touchSwipe = true;
        }
      }
      if (!this.game.sprite.onGround && this.game.sprite.vy > 0 && !this.game.sprite.gliding && this.game.energyBar.canUse()) {
        this.game.sprite.startGliding();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (!this.touchStart || showSettings) return;
      e.preventDefault();
      if (this.touchMode === 'move') {
        const end = this.lastTouch || this.touchStart;
        const dx = end.x - this.touchStart.x;
        const dy = end.y - this.touchStart.y;
        this._finishCharge(dx, dy);
        this.touchStart = null; this.lastTouch = null;
      } else {
        const endTime = Date.now();
        const last = this.touchSamples[this.touchSamples.length - 1] || this.touchStart;
        const dx = last.x - this.touchStart.x;
        const total = Math.max(1, endTime - this.touchStart.time);
        if (this.touchSwipe) this.createPlatformFromGesture(dx, total, last.y);
        else this.game.sprite.releaseJump();
        this.game.sprite.stopGliding();
        this.touchStart = null;
        this.touchSamples = [];
        this.touchSwipe = false;
      }
    }, { passive: false });

    // Mouse
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
      this.isMouseDown = true;
      if (this.game.sprite.onGround) {
        this.mouseMode = 'move';
        this.mouseStart = { x, y };
        this.lastMouse = { x, y };
        this._startCharge();
      } else {
        this.mouseMode = 'platform';
        const time = Date.now();
        this.mouseStart = { x, y, time };
        this.mouseSamples = [{ ...this.mouseStart }];
        this.mouseSwipe = false;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown || showSettings) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (this.mouseMode === 'move') {
        this.lastMouse = { x, y };
      } else {
        const s = { x, y, time: Date.now() };
        this.mouseSamples.push(s);
        const cutoff = s.time - VELOCITY_SAMPLE_TIME;
        this.mouseSamples = this.mouseSamples.filter(q => q.time >= cutoff);
        const dx = s.x - this.mouseStart.x;
        const dt = s.time - this.mouseStart.time;
        if (!this.mouseSwipe && Math.abs(dx) >= MIN_SWIPE_DISTANCE && dt >= MIN_SWIPE_TIME) {
          this.mouseSwipe = true;
        }
      }
      if (!this.game.sprite.onGround && this.game.sprite.vy > 0 && !this.game.sprite.gliding && this.game.energyBar.canUse()) {
        this.game.sprite.startGliding();
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (!this.isMouseDown || showSettings) return;
      if (this.mouseMode === 'move') {
        const end = this.lastMouse || this.mouseStart;
        const dx = end.x - this.mouseStart.x;
        const dy = end.y - this.mouseStart.y;
        this._finishCharge(dx, dy);
      } else {
        const endTime = Date.now();
        const last = this.mouseSamples[this.mouseSamples.length - 1] || this.mouseStart;
        const dx = last.x - this.mouseStart.x;
        const total = Math.max(1, endTime - this.mouseStart.time);
        if (this.mouseSwipe) this.createPlatformFromGesture(dx, total, last.y);
        else this.game.sprite.releaseJump();
        this.game.sprite.stopGliding();
        this.mouseSamples = [];
        this.mouseSwipe = false;
      }
      this.isMouseDown = false;
      this.mouseStart = null; this.lastMouse = null; this.mouseMode = null;
    });

    // Trackpad gesture
    canvas.addEventListener('wheel', (e) => {
      if (showSettings || this.game.sprite.onGround) return;
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
        if (Math.abs(totalDeltaX) > 50 && totalTime > 100) {
          const rect = canvas.getBoundingClientRect();
          const mouseY = e.clientY - rect.top;
          this.createPlatformFromGesture(totalDeltaX, totalTime, mouseY);
          this.trackpadGestureActive = false;
        }
      } else {
        this.trackpadGestureActive = false;
      }
    }, { passive: false });

    canvas.addEventListener('mouseleave', () => {
      this.trackpadGestureActive = false;
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !showSettings && !this.spaceCharging) {
        e.preventDefault();
        this.spaceCharging = true;
        this._startCharge();
      }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code) && !showSettings) {
        if (this.game.sprite.onGround) {
          e.preventDefault();
          if (!this.arrowCharging) {
            this.arrowCharging = true;
            this._startCharge();
          }
          this.arrowState[e.code] = true;
        } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
          e.preventDefault();
          const now = Date.now();
          if (now - this.lastArrowTime >= this.arrowCooldownMs) {
            this.lastArrowTime = now;
            const dir = e.code === 'ArrowRight' ? 1 : -1;
            this.createPlatformFromKey(dir);
          }
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.spaceCharging) {
        e.preventDefault();
        this.spaceCharging = false;
        this._finishCharge(0, -1);
      }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code) && this.arrowCharging) {
        e.preventDefault();
        const dir = {
          x: (this.arrowState.ArrowRight ? 1 : 0) - (this.arrowState.ArrowLeft ? 1 : 0),
          y: (this.arrowState.ArrowDown ? 1 : 0) - (this.arrowState.ArrowUp ? 1 : 0)
        };
        this.arrowState[e.code] = false;
        if (!this.arrowState.ArrowLeft && !this.arrowState.ArrowRight && !this.arrowState.ArrowUp && !this.arrowState.ArrowDown) {
          this.arrowCharging = false;
          if (dir.x === 0 && dir.y === 0) this.game.sprite.releaseJump();
          else this.game.sprite.releaseMove(dir.x, dir.y);
          this.game.sprite.stopGliding();
        }
      }
    });
  }

  createPlatformFromGesture(dx, totalTimeMs, screenY) {
    const activeMovers = this.game.platforms.filter(p => p.direction !== 0).length;
    if (activeMovers >= MAX_PLATFORMS) return;

    const dir = (dx >= 0) ? 1 : -1;
    const speedRaw = Math.abs(dx) / (totalTimeMs / 1000);
    const speed = clamp(speedRaw, MIN_PLATFORM_SPEED, MAX_PLATFORM_SPEED);

    const w = clamp(
      PLATFORM_MIN_WIDTH + (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH) * (totalTimeMs / 700),
      PLATFORM_MIN_WIDTH,
      PLATFORM_MAX_WIDTH
    );

    const worldY = screenY + cameraY;
    const x = (dir > 0) ? -w : canvasWidth;
    const platform = new Platform(x, worldY, w, speed, dir);
    this.game.platforms.push(platform);
  }

  createPlatformFromKey(dir) {
    const activeMovers = this.game.platforms.filter(p => p.direction !== 0).length;
    if (activeMovers >= MAX_PLATFORMS) return;

    const w = (PLATFORM_MIN_WIDTH + PLATFORM_MAX_WIDTH) * 0.5;
    const speed = (MIN_PLATFORM_SPEED + MAX_PLATFORM_SPEED) * 0.6;

    const screenY = canvas.height * 0.5;
    const worldY = screenY + cameraY;
    const x = (canvasWidth * 0.5) - (w * 0.5);

    const platform = new Platform(x, worldY, w, speed, dir);
    this.game.platforms.push(platform);
  }
}
