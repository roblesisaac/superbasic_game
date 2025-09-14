import {
    MIN_SWIPE_DISTANCE, MIN_SWIPE_TIME, VELOCITY_SAMPLE_TIME,
    MIN_PLATFORM_SPEED, MAX_PLATFORM_SPEED, MAX_PLATFORMS,
    PLATFORM_MIN_WIDTH, PLATFORM_MAX_WIDTH
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
      this.touchSamples = [];
      this.touchSwipe = false;
  
      this.mouseStart = null;
      this.mouseSamples = [];
      this.isMouseDragging = false;
      this.mouseSwipe = false;
  
      // Keyboard jump charge (space)
      this.keyboardCharging = false;
      this.keyboardChargeStart = 0;
  
      // Trackpad gesture support
      this.trackpadGestureActive = false;
      this.trackpadStartX = 0;
      this.trackpadStartTime = 0;
  
      // Arrow-key spawn debounce
      this.lastArrowTime = 0;
      this.arrowCooldownMs = 140; // light debounce to avoid spam
  
      this.bind();
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
  
        // toggle settings
        if (x > canvasWidth - 50 && y < 50) {
          toggleSettings();
          if (!showSettings) this.ensureReset();
          return;
        }
        if (showSettings) { hideSettings(); this.ensureReset(); return; }
  
        this.touchStart = { x, y, time: Date.now() };
        this.touchSamples = [{ ...this.touchStart }];
        this.touchSwipe = false;
  
        this.game.sprite.startCharging();
        if (!this.game.sprite.onGround && this.game.sprite.vy > 0) this.game.sprite.startGliding();
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
  
        const dx = s.x - this.touchStart.x;
        const dt = s.time - this.touchStart.time;
        if (!this.touchSwipe && Math.abs(dx) >= MIN_SWIPE_DISTANCE && dt >= MIN_SWIPE_TIME) {
          this.touchSwipe = true;
          this.game.sprite.charging = false;
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
  
        if (this.touchSwipe) this.createPlatformFromGesture(dx, total, last.y);
        else this.game.sprite.releaseJump();
  
        this.game.sprite.stopGliding();
        this.touchStart = null; this.touchSamples = []; this.touchSwipe = false;
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
  
        this.mouseStart = { x, y, time: Date.now() };
        this.mouseSamples = [{ ...this.mouseStart }];
        this.isMouseDragging = true;
        this.mouseSwipe = false;
  
        this.game.sprite.startCharging();
        if (!this.game.sprite.onGround && this.game.sprite.vy > 0) this.game.sprite.startGliding();
      });
  
      canvas.addEventListener('mousemove', (e) => {
        if (!this.isMouseDragging || showSettings) return;
        const r = canvas.getBoundingClientRect();
        const s = { x: e.clientX - r.left, y: e.clientY - r.top, time: Date.now() };
        this.mouseSamples.push(s);
        const cutoff = s.time - VELOCITY_SAMPLE_TIME;
        this.mouseSamples = this.mouseSamples.filter(q => q.time >= cutoff);
  
        const dx = s.x - this.mouseStart.x;
        const dt = s.time - this.mouseStart.time;
        if (!this.mouseSwipe && Math.abs(dx) >= MIN_SWIPE_DISTANCE && dt >= MIN_SWIPE_TIME) {
          this.mouseSwipe = true;
          this.game.sprite.charging = false;
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
  
        if (this.mouseSwipe) this.createPlatformFromGesture(dx, total, last.y);
        else this.game.sprite.releaseJump();
  
        this.game.sprite.stopGliding();
        this.isMouseDragging = false;
        this.mouseStart = null;
        this.mouseSamples = [];
        this.mouseSwipe = false;
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
      });
  
      document.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && !showSettings && this.keyboardCharging) {
          e.preventDefault();
          this.keyboardCharging = false;
          this.game.sprite.releaseJump();
          this.game.sprite.stopGliding();
        }
      });
  
      // Prevent space from scrolling the page
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') e.preventDefault();
  
        // ----------------------------
        // Keyboard: Left/Right arrows -> spawn moving platform mid-screen
        // ----------------------------
        if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !showSettings) {
          e.preventDefault();
          const now = Date.now();
          if (now - this.lastArrowTime < this.arrowCooldownMs) return;
          this.lastArrowTime = now;
  
          const dir = (e.code === 'ArrowRight') ? 1 : -1;
          this.createPlatformFromKey(dir);
        }
      });
    }
  
    /**
     * Creates a platform from a left/right swipe or trackpad gesture.
     * Spawns from the corresponding canvas edge and moves inward.
     */
    createPlatformFromGesture(dx, totalTimeMs, screenY) {
      const activeMovers = this.game.platforms.filter(p => p.direction !== 0).length;
      if (activeMovers >= MAX_PLATFORMS) return;
  
      const dir = (dx >= 0) ? 1 : -1;
      const speedRaw = Math.abs(dx) / (totalTimeMs / 1000);
      const speed = clamp(speedRaw, MIN_PLATFORM_SPEED, MAX_PLATFORM_SPEED);
  
      const w = clamp(
        PLATFORM_MIN_WIDTH + (PLATFORM_MAX_WIDTH - PLATFORM_MIN_WIDTH) * (totalTimeMs / 700),
        PLATFORM_MIN_WIDTH, PLATFORM_MAX_WIDTH
      );
  
      const worldY = screenY + cameraY;
      const x = (dir > 0) ? -w : canvasWidth;
      const platform = new Platform(x, worldY, w, speed, dir);
      this.game.platforms.push(platform);
    }
  
    /**
     * Creates a platform from keyboard arrow input.
     * Spawns horizontally centered (mid-screen), at mid-screen Y, moving left/right.
     * Uses a comfortable default width/speed so it feels snappy without a "charge".
     */
    createPlatformFromKey(dir) {
      const activeMovers = this.game.platforms.filter(p => p.direction !== 0).length;
      if (activeMovers >= MAX_PLATFORMS) return;
  
      // Reasonable defaults for keyboard: mid width & mid speed
      const w = (PLATFORM_MIN_WIDTH + PLATFORM_MAX_WIDTH) * 0.5;
      const speed = (MIN_PLATFORM_SPEED + MAX_PLATFORM_SPEED) * 0.6; // a bit brisk
  
      // Mid-screen spawn
      const screenY = canvas.height * 0.5;
      const worldY = screenY + cameraY;
      const x = (canvasWidth * 0.5) - (w * 0.5);
  
      const platform = new Platform(x, worldY, w, speed, dir);
      this.game.platforms.push(platform);
    }
  }  