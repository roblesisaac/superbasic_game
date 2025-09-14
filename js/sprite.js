import {
    GRAVITY, GLIDE_GRAVITY_FACTOR, GROUND_FRICTION,
    CHARGE_TIME, JUMP_MIN, JUMP_MAX, JUMP_SMALL_COOLDOWN,
    STRETCH_SCALE_X, STRETCH_SCALE_Y, STRETCH_TIME,
    VELOCITY_STRETCH_FACTOR, MAX_VELOCITY_STRETCH,
    IMPACT_SQUASH_FACTOR, IMPACT_DECAY_RATE,
    CHARGE_SQUASH_MAX, CHARGE_WIDEN_MAX,
    SAFE_FALL_VY, SAFE_FALL_HEIGHT, STUN_TIME, SPRITE_SIZE
  } from './constants.js';
  import { clamp } from './utils.js';
  import { canvasWidth, groundY, cameraY } from './globals.js';
  
  export class Sprite {
    constructor(x, y, hooks) {
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.onGround = true; this.onPlatform = false;
      this.charging = false; this.chargeTime = 0;
      this.gliding = false;
      this.stunned = false; this.stunTime = 0;
      this.fallStartY = y;
  
      // visuals
      this.scaleX = 1; this.scaleY = 1;
      this.stretchTimer = 0;
      this.impactSquash = 0;
      this.velocityScaleX = 1;
      this.velocityScaleY = 1;
  
      // hooks to access game state without circular imports
      this.hooks = hooks; // { energyBar, hearts, onGameOver, isOnGate:(p)=>boolean, getPlatforms:()=>[] }
    }
  
    startCharging() {
      if (this.hooks.energyBar.state === 'cooldown') {
        this.charging = true; this.chargeTime = 0; return;
      }
      if (this.onGround && !this.stunned && this.hooks.energyBar.canUse()) {
        this.charging = true; this.chargeTime = 0;
      }
    }
  
    releaseJump() {
      if (this.charging && this.hooks.energyBar.state === 'cooldown') {
        this.vy = -JUMP_SMALL_COOLDOWN;
        this.onGround = false;
        this.fallStartY = this.y;
        this.hooks.energyBar.extendCooldown(0.22);
        this._doFollowThroughStretch();
        this.charging = false; this.chargeTime = 0;
        return;
      }
      if (this.charging && this.onGround && !this.stunned) {
        const r = Math.min(1, this.chargeTime / CHARGE_TIME);
        const vy = JUMP_MIN + (JUMP_MAX - JUMP_MIN) * r;
        this.vy = -vy;
        this.onGround = false;
        this.fallStartY = this.y;
        this._doFollowThroughStretch();
      }
      this.charging = false; this.chargeTime = 0;
    }

    releaseMove(dx, dy) {
      if (this.charging && this.hooks.energyBar.state === 'cooldown') {
        this.vy = -JUMP_SMALL_COOLDOWN;
        this.onGround = false;
        this.fallStartY = this.y;
        this.hooks.energyBar.extendCooldown(0.22);
        this._doFollowThroughStretch();
        this.charging = false; this.chargeTime = 0;
        return;
      }
      if (this.charging && this.onGround && !this.stunned) {
        const r = Math.min(1, this.chargeTime / CHARGE_TIME);
        const speed = JUMP_MIN + (JUMP_MAX - JUMP_MIN) * r;
        const mag = Math.hypot(dx, dy) || 1;
        const nx = dx / mag;
        const ny = dy / mag;
        this.vx = -nx * speed;
        this.vy = -ny * speed;
        this.onGround = false;
        this.fallStartY = this.y;
        this._doFollowThroughStretch();
      }
      this.charging = false; this.chargeTime = 0;
    }
  
    startGliding() {
      if (!this.onGround && this.vy > 0 && !this.stunned && this.hooks.energyBar.canUse()) {
        this.gliding = true;
      }
    }
    stopGliding() { this.gliding = false; }
  
    takeDamage() {
      this.hooks.hearts.takeDamage(() => this.hooks.onGameOver());
      this.stunned = true;
      this.stunTime = STUN_TIME;
      this.impactSquash = IMPACT_SQUASH_FACTOR * 0.5;
    }
  
    _doFollowThroughStretch() { this.stretchTimer = STRETCH_TIME; }
  
    _updateVelocityStretch() {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > 0) {
        const amt = Math.min(speed * VELOCITY_STRETCH_FACTOR, MAX_VELOCITY_STRETCH);
        const nx = Math.abs(this.vx) / speed;
        const ny = Math.abs(this.vy) / speed;
        this.velocityScaleX = 1 + amt * nx - amt * ny * 0.5;
        this.velocityScaleY = 1 + amt * ny - amt * nx * 0.5;
      } else {
        const ease = 12, dt = 0.016;
        this.velocityScaleY += (1 - this.velocityScaleY) * ease * dt;
        this.velocityScaleX += (1 - this.velocityScaleX) * ease * dt;
      }
    }
    _updateImpactSquash(dt) {
      if (this.impactSquash > 0) {
        this.impactSquash -= this.impactSquash * IMPACT_DECAY_RATE * dt;
        if (this.impactSquash < 0.01) this.impactSquash = 0;
      }
    }
    _updateFollowThrough(dt) {
      if (this.stretchTimer > 0) {
        this.stretchTimer -= dt;
        if (this.stretchTimer <= 0) this.stretchTimer = 0;
      }
    }
    _applyFinalScale() {
      let sx = 1, sy = 1;
      sx *= this.velocityScaleX; sy *= this.velocityScaleY;
  
      if (this.charging && this.hooks.energyBar.state === 'active') {
        const chargeRatio = Math.min(1, this.chargeTime / CHARGE_TIME);
        sx *= (1 + CHARGE_WIDEN_MAX * chargeRatio);
        sy *= (1 - CHARGE_SQUASH_MAX * chargeRatio);
      }
      if (this.stretchTimer > 0) {
        const r = this.stretchTimer / STRETCH_TIME;
        sx *= (STRETCH_SCALE_X + (1 - STRETCH_SCALE_X) * (1 - r));
        sy *= (STRETCH_SCALE_Y + (1 - STRETCH_SCALE_Y) * (1 - r));
      }
      if (this.impactSquash > 0) {
        sx *= (1 + this.impactSquash * 0.4);
        sy *= (1 - this.impactSquash * 0.6);
      }
      this.scaleX = clamp(sx, 0.3, 2.0);
      this.scaleY = clamp(sy, 0.3, 2.0);
    }
  
    update(dt) {
      this._updateVelocityStretch();
      this._updateImpactSquash(dt);
      this._updateFollowThrough(dt);
  
      if (this.stunned) {
        this.stunTime -= dt;
        if (this.stunTime <= 0) this.stunned = false;
        if (this.onGround && Math.abs(this.vx) > 0) {
          const fr = GROUND_FRICTION * dt;
          if (Math.abs(this.vx) <= fr) this.vx = 0; else this.vx -= Math.sign(this.vx) * fr;
        }
      }
  
      const prevY = this.y;
      const hs = SPRITE_SIZE / 2;
      const wasOnGround = this.onGround;
  
      if (this.charging && this.onGround && this.hooks.energyBar.state === 'active') {
        this.chargeTime = Math.min(this.chargeTime + dt, CHARGE_TIME);
        this.hooks.energyBar.drain(45 * dt);
      }
      if (this.gliding && this.vy > 0 && !this.onGround) {
        if (this.hooks.energyBar.canUse()) this.hooks.energyBar.drain(30 * dt);
        else this.gliding = false;
      }
  
      let g = GRAVITY;
      if (this.gliding && this.vy > 0 && !this.onGround) g *= GLIDE_GRAVITY_FACTOR;
      this.vy += g * dt;
  
      if (this.onGround && Math.abs(this.vx) > 0) {
        const fr = GROUND_FRICTION * dt;
        if (Math.abs(this.vx) <= fr) this.vx = 0; else this.vx -= Math.sign(this.vx) * fr;
      }
  
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.x = clamp(this.x, hs, canvasWidth - hs);
  
      const prevTop = prevY - hs;
      const prevBottom = prevY + hs;
  
      this.onGround = false; this.onPlatform = false;
  
      // platform collisions
      const plats = this.hooks.getPlatforms();
      outer:
      for (const p of plats) {
        if (!p || p.active === false) continue;
        const rects = (typeof p.getRects === 'function') ? p.getRects(canvasWidth) : [p.getRect()];
        for (const r of rects) {
          const hOverlap = (this.x + hs >= r.x) && (this.x - hs <= r.x + r.w);
          if (!hOverlap || r.w <= 0) continue;
  
          const top = this.y - hs;
          const bottom = this.y + hs;
          const platTop = r.y;
          const platBottom = r.y + r.h;
  
          // land on top
          if (this.vy >= 0 && prevBottom <= platTop && bottom >= platTop) {
            if (!('getRects' in p) && !p.floating && (p.speed >= 650)) {
              this.vx = 0.9 * p.speed * (p.direction || 1);
              this.vy = -900;
              this.impactSquash = 1.8 * 1.2;
            } else {
              this.y = platTop - hs;
              this.vy = 0;
              this.onGround = true;
              this.onPlatform = true;
              this.vx = (p.speed || 0) * (p.direction || 0);
              this.gliding = false;
              if (!wasOnGround) this.impactSquash = 1.8;
              break outer;
            }
          }
  
          // hit from below
          if (this.vy < 0 && prevTop >= platBottom && top <= platBottom) {
            this.y = platBottom + hs;
            this.vy = 0;
            this.gliding = false;
            this.impactSquash = 1.8 * 0.3;
            break outer;
          }
        }
      }
  
      // ground
      if (!this.onPlatform && this.y + hs >= groundY) {
        this.y = groundY - hs;
        if (!wasOnGround && this.vy > 0) {
          const fallHeight = this.y - this.fallStartY;
          const safe = Math.abs(this.vy) <= SAFE_FALL_VY || fallHeight <= SAFE_FALL_HEIGHT;
          if (!safe) this.takeDamage();
          const impactStrength = Math.min(2.0, Math.abs(this.vy) / 400);
          this.impactSquash = 1.8 * impactStrength;
        }
        this.onGround = true;
        this.vy = 0;
        this.gliding = false;
      }
  
      if (wasOnGround && !this.onGround) this.fallStartY = this.y;
      this._applyFinalScale();
    }
  
    draw(ctx, cameraY) {
      const px = this.x;
      const py = this.y - cameraY;
  
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(this.scaleX, this.scaleY);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-SPRITE_SIZE / 2, -SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
  
      if (this.vy > 0 && this.gliding) {
        ctx.fillStyle = '#f66';
        ctx.beginPath();
        ctx.moveTo(SPRITE_SIZE / 2, -4);
        ctx.lineTo(SPRITE_SIZE / 2 + 14, 0);
        ctx.lineTo(SPRITE_SIZE / 2, 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }
  