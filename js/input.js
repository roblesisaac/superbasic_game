import { MIN_SWIPE_DISTANCE } from './constants.js';
import { canvas, canvasWidth } from './globals.js';
import { showSettings, toggleSettings, hideSettings } from './settings.js';

export class InputHandler {
  constructor(game, ensureReset) {
    this.game = game;
    this.ensureReset = ensureReset;

    this.touchStart = null;
    this.lastTouch = null;

    this.mouseStart = null;
    this.lastMouse = null;
    this.isMouseDown = false;

    this.arrowState = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
    this.arrowCharging = false;
    this.spaceCharging = false;

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

      if (!this.game.sprite.onGround) return;

      e.preventDefault();
      this.touchStart = { x, y };
      this.lastTouch = { x, y };
      this._startCharge();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (!this.touchStart || showSettings) return;
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      this.lastTouch = { x: t.clientX - r.left, y: t.clientY - r.top };
      if (!this.game.sprite.onGround && this.game.sprite.vy > 0 && !this.game.sprite.gliding && this.game.energyBar.canUse()) {
        this.game.sprite.startGliding();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (!this.touchStart || showSettings) return;
      e.preventDefault();
      const end = this.lastTouch || this.touchStart;
      const dx = end.x - this.touchStart.x;
      const dy = end.y - this.touchStart.y;
      this._finishCharge(dx, dy);
      this.touchStart = null; this.lastTouch = null;
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
      if (!this.game.sprite.onGround) return;
      this.mouseStart = { x, y };
      this.lastMouse = { x, y };
      this.isMouseDown = true;
      this._startCharge();
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown || showSettings) return;
      const r = canvas.getBoundingClientRect();
      this.lastMouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!this.game.sprite.onGround && this.game.sprite.vy > 0 && !this.game.sprite.gliding && this.game.energyBar.canUse()) {
        this.game.sprite.startGliding();
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (!this.isMouseDown || showSettings) return;
      const end = this.lastMouse || this.mouseStart;
      const dx = end.x - this.mouseStart.x;
      const dy = end.y - this.mouseStart.y;
      this._finishCharge(dx, dy);
      this.isMouseDown = false;
      this.mouseStart = null; this.lastMouse = null;
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !showSettings && !this.spaceCharging) {
        e.preventDefault();
        this.spaceCharging = true;
        this._startCharge();
      }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code) && !showSettings) {
        if (!this.game.sprite.onGround) return;
        e.preventDefault();
        if (!this.arrowCharging) {
          this.arrowCharging = true;
          this._startCharge();
        }
        this.arrowState[e.code] = true;
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
}
