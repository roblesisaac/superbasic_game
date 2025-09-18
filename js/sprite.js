import {
    GRAVITY, GLIDE_GRAVITY_FACTOR, GROUND_FRICTION,
    CHARGE_TIME, JUMP_MIN, JUMP_MAX, JUMP_SMALL_COOLDOWN,
    STRETCH_SCALE_X, STRETCH_SCALE_Y, STRETCH_TIME,
    VELOCITY_STRETCH_FACTOR, MAX_VELOCITY_STRETCH,
    IMPACT_SQUASH_FACTOR, IMPACT_DECAY_RATE,
    CHARGE_SQUASH_MAX, CHARGE_WIDEN_MAX,
    SAFE_FALL_VY, SAFE_FALL_HEIGHT, STUN_TIME, SPRITE_SIZE,
    MOVEMENT_MIN, MOVEMENT_MAX, RIDE_SPEED_THRESHOLD,
    RIDE_BOUNCE_VX_FACTOR, RIDE_BOUNCE_VY
  } from './constants.js';
  import { clamp } from './utils.js';
  import { canvasWidth, groundY, cameraY } from './globals.js';
  
  const SPRITE_SRC = '/icons/sprite.svg';
  const spriteImg = new window.Image();
  spriteImg.src = SPRITE_SRC;
  let spriteLoaded = false;
  spriteImg.onload = () => { spriteLoaded = true; };
  
  export class Sprite {
    constructor(x, y, hooks) {
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.onGround = true; this.onPlatform = false;
      
      // Jump charging
      this.charging = false; this.chargeTime = 0;
      
      // Movement charging (joystick)
      this.movementCharging = false;
      this.movementChargeTime = 0;
      this.movementDirection = { x: 0, y: 0 }; // normalized direction vector
      
      this.gliding = false;
      this.stunned = false; this.stunTime = 0;
      this.fallStartY = y;
  
      // visuals
      this.scaleX = 1; this.scaleY = 1;
      this.stretchTimer = 0;
      this.impactSquash = 0;
      this.velocityScaleX = 1;
      this.velocityScaleY = 1;
      this.lastMovementDirection = { x: 0, y: 0 }; // for stretch effects
      this.facingLeft = false; // true if last moving left
  
      // hooks to access game state without circular imports
      this.hooks = hooks; // { energyBar, hearts, onGameOver, getRides:()=>[], getGates:()=>[] }
    }
  
    startCharging() {
      if (this.hooks.energyBar.state === 'cooldown') {
        this.charging = true; 
        this.chargeTime = 0; 
        return;
      }
      if (this.onGround && !this.stunned && this.hooks.energyBar.canUse()) {
        this.charging = true; 
        this.chargeTime = 0;
      }
    }

    startMovementCharging(direction) {
      if (this.hooks.energyBar.state === 'cooldown') {
        this.movementCharging = true;
        this.movementChargeTime = 0;
        this.movementDirection = { ...direction };
        return;
      }
      if (!this.stunned && this.hooks.energyBar.canUse()) {
        this.movementCharging = true;
        this.movementChargeTime = 0;
        this.movementDirection = { ...direction };
      }
    }

    updateMovementCharging(direction) {
      if (this.movementCharging) {
        this.movementDirection = { ...direction };
      }
    }
  
    releaseJump() {
      if (this.charging && this.hooks.energyBar.state === 'cooldown') {
        this.vy = -JUMP_SMALL_COOLDOWN;
        this.onGround = false;
        this.fallStartY = this.y;
        this.hooks.energyBar.extendCooldown(0.22);
        this._doFollowThroughStretch({ x: 0, y: -1 });
        this.charging = false; 
        this.chargeTime = 0;
        return;
      }
      if (this.charging && this.onGround && !this.stunned) {
        const r = Math.min(1, this.chargeTime / CHARGE_TIME);
        const vy = JUMP_MIN + (JUMP_MAX - JUMP_MIN) * r;
        this.vy = -vy;
        this.onGround = false;
        this.fallStartY = this.y;
        this._doFollowThroughStretch({ x: 0, y: -1 });
      }
      this.charging = false; 
      this.chargeTime = 0;
    }

    releaseMovement() {
      if (this.movementCharging) {
        if (this.hooks.energyBar.state === 'cooldown') {
          // Small movement during cooldown
          const force = MOVEMENT_MIN * 0.5;
          this.vx += -this.movementDirection.x * force;
          this.vy += -this.movementDirection.y * force;
          this.hooks.energyBar.extendCooldown(0.15);
        } else if (!this.stunned) {
          // Normal movement
          const r = Math.min(1, this.movementChargeTime / CHARGE_TIME);
          const force = MOVEMENT_MIN + (MOVEMENT_MAX - MOVEMENT_MIN) * r;
          
          // Apply movement in opposite direction of drag
          this.vx += -this.movementDirection.x * force;
          this.vy += -this.movementDirection.y * force;
          
          // Clamp velocity to prevent extreme speeds
          const maxVel = MOVEMENT_MAX * 1.2;
          this.vx = clamp(this.vx, -maxVel, maxVel);
          this.vy = clamp(this.vy, -maxVel, maxVel);
          
          if (!this.onGround) {
            this.fallStartY = this.y;
          }
        }
        
        // Store direction for stretch effects
        this.lastMovementDirection = { 
          x: -this.movementDirection.x, 
          y: -this.movementDirection.y 
        };
        this._doFollowThroughStretch(this.lastMovementDirection);
      }
      
      this.movementCharging = false;
      this.movementChargeTime = 0;
      this.movementDirection = { x: 0, y: 0 };
    }
  
    startGliding() {
      if (!this.onGround && this.vy > 0 && !this.stunned && this.hooks.energyBar.canUse()) {
        this.gliding = true;
      }
    }
    
    stopGliding() { 
      this.gliding = false; 
    }
  
    takeDamage() {
      this.hooks.hearts.takeDamage(() => this.hooks.onGameOver());
      this.stunned = true;
      this.stunTime = STUN_TIME;
      this.impactSquash = IMPACT_SQUASH_FACTOR * 0.5;
    }
  
    _doFollowThroughStretch(direction) { 
      this.stretchTimer = STRETCH_TIME;
      if (direction) {
        this.lastMovementDirection = { ...direction };
      }
    }
  
    _updateVelocityStretch() {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const amt = Math.min(speed * VELOCITY_STRETCH_FACTOR, MAX_VELOCITY_STRETCH);
      
      if (speed > 50) {
        // Stretch based on movement direction
        const normalizedVx = this.vx / speed;
        const normalizedVy = this.vy / speed;
        
        // Horizontal stretch
        if (Math.abs(normalizedVx) > 0.3) {
          this.velocityScaleX = 1 + amt * Math.abs(normalizedVx);
          this.velocityScaleY = 1 - amt * Math.abs(normalizedVx) * 0.5;
        }
        
        // Vertical stretch
        if (Math.abs(normalizedVy) > 0.3) {
          this.velocityScaleY = 1 + amt * Math.abs(normalizedVy);
          this.velocityScaleX = 1 - amt * Math.abs(normalizedVy) * 0.3;
        }
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
      sx *= this.velocityScaleX; 
      sy *= this.velocityScaleY;
  
      // Charging effects
      if (this.charging && this.hooks.energyBar.state === 'active') {
        const chargeRatio = Math.min(1, this.chargeTime / CHARGE_TIME);
        sx *= (1 + CHARGE_WIDEN_MAX * chargeRatio);
        sy *= (1 - CHARGE_SQUASH_MAX * chargeRatio);
      }

      // Movement charging effects
      if (this.movementCharging && this.hooks.energyBar.state === 'active') {
        const chargeRatio = Math.min(1, this.movementChargeTime / CHARGE_TIME);
        const intensity = chargeRatio * 0.3; // Less intense than jump charging
        
        // Squash in direction of intended movement
        if (Math.abs(this.movementDirection.x) > 0.1) {
          sx *= (1 + intensity * Math.abs(this.movementDirection.x));
        }
        if (Math.abs(this.movementDirection.y) > 0.1) {
          sy *= (1 + intensity * Math.abs(this.movementDirection.y));
        }
      }
      
      // Follow-through stretch
      if (this.stretchTimer > 0) {
        const r = this.stretchTimer / STRETCH_TIME;
        const dir = this.lastMovementDirection;
        
        if (Math.abs(dir.x) > Math.abs(dir.y)) {
          // Horizontal stretch
          sx *= (STRETCH_SCALE_X + (1 - STRETCH_SCALE_X) * (1 - r));
          sy *= (STRETCH_SCALE_Y + (1 - STRETCH_SCALE_Y) * (1 - r));
        } else {
          // Vertical stretch  
          sy *= (STRETCH_SCALE_Y + (1 - STRETCH_SCALE_Y) * (1 - r));
          sx *= (STRETCH_SCALE_X + (1 - STRETCH_SCALE_X) * (1 - r));
        }
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

      // Track facing direction based on vx
      if (this.vx > 20) {
        this.facingLeft = false;
      } else if (this.vx < -20) {
        this.facingLeft = true;
      }
  
      if (this.stunned) {
        this.stunTime -= dt;
        if (this.stunTime <= 0) this.stunned = false;
        if (this.onGround && Math.abs(this.vx) > 0) {
          const fr = GROUND_FRICTION * dt;
          if (Math.abs(this.vx) <= fr) this.vx = 0; 
          else this.vx -= Math.sign(this.vx) * fr;
        }
      }
  
      const prevY = this.y;
      const hs = SPRITE_SIZE / 2;
      const wasOnGround = this.onGround;
  
      // Handle charging
      if (this.charging && this.onGround && this.hooks.energyBar.state === 'active') {
        this.chargeTime = Math.min(this.chargeTime + dt, CHARGE_TIME);
        this.hooks.energyBar.drain(45 * dt);
      }

      // Handle movement charging
      if (this.movementCharging && this.hooks.energyBar.state === 'active') {
        this.movementChargeTime = Math.min(this.movementChargeTime + dt, CHARGE_TIME);
        this.hooks.energyBar.drain(35 * dt); // Slightly less drain than jump
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
        if (Math.abs(this.vx) <= fr) this.vx = 0; 
        else this.vx -= Math.sign(this.vx) * fr;
      }
  
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.x = clamp(this.x, hs, canvasWidth - hs);
  
      const prevTop = prevY - hs;
      const prevBottom = prevY + hs;
  
      this.onGround = false; 
      this.onPlatform = false;
  
      // ride and gate collisions
      const surfaceCollections = [];
      if (typeof this.hooks.getRides === 'function') surfaceCollections.push(this.hooks.getRides());
      if (typeof this.hooks.getGates === 'function') surfaceCollections.push(this.hooks.getGates());

      outer:
      for (const collection of surfaceCollections) {
        if (!collection) continue;
        for (const surface of collection) {
          if (!surface || surface.active === false) continue;
          const rects = (typeof surface.getRects === 'function') ? surface.getRects() : [surface.getRect()];
          for (const rect of rects) {
            const hOverlap = (this.x + hs >= rect.x) && (this.x - hs <= rect.x + rect.w);
            if (!hOverlap || rect.w <= 0) continue;

            const top = this.y - hs;
            const bottom = this.y + hs;
            const surfaceTop = rect.y;
            const surfaceBottom = rect.y + rect.h;

            if (this.vy >= 0 && prevBottom <= surfaceTop && bottom >= surfaceTop) {
              if (!('getRects' in surface) && !surface.floating && (surface.speed >= RIDE_SPEED_THRESHOLD)) {
                this.vx = RIDE_BOUNCE_VX_FACTOR * surface.speed * (surface.direction || 1);
                this.vy = RIDE_BOUNCE_VY;
                this.impactSquash = 1.8 * 1.2;
              } else {
                this.y = surfaceTop - hs;
                this.vy = 0;
                this.onGround = true;
                this.onPlatform = true;
                this.vx = (surface.speed || 0) * (surface.direction || 0);
                this.gliding = false;
                if (!wasOnGround) this.impactSquash = 1.8;
                break outer;
              }
            }

            if (this.vy < 0 && prevTop >= surfaceBottom && top <= surfaceBottom) {
              this.y = surfaceBottom + hs;
              this.vy = 0;
              this.gliding = false;
              this.impactSquash = 1.8 * 0.3;
              break outer;
            }
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

      // Use facingLeft to determine mirroring
      let flip = this.facingLeft;
      if (flip) {
        ctx.scale(-1, 1);
      }
      ctx.scale(this.scaleX, this.scaleY);

      if (spriteLoaded) {
        const size = SPRITE_SIZE;
        ctx.drawImage(
          spriteImg,
          flip ? -size / 2 - size : -size / 2,
          -size / 2,
          size,
          size
        );
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(flip ? -SPRITE_SIZE / 2 - SPRITE_SIZE : -SPRITE_SIZE / 2, -SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
      }

      // Movement charging indicator
      if (this.movementCharging && this.hooks.energyBar.state === 'active') {
        const r = Math.min(1, this.movementChargeTime / CHARGE_TIME);
        const intensity = r * 255;
        ctx.fillStyle = `rgba(100, 200, 255, ${r * 0.8})`;
        
        // Draw directional indicator
        if (Math.abs(this.movementDirection.x) > 0.1 || Math.abs(this.movementDirection.y) > 0.1) {
          const arrowLength = 15 + r * 10;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            this.movementDirection.x * arrowLength,
            this.movementDirection.y * arrowLength
          );
          ctx.lineWidth = 2 + r * 2;
          ctx.strokeStyle = `rgba(100, 200, 255, ${r})`;
          ctx.stroke();
          
          // Arrow head
          const angle = Math.atan2(this.movementDirection.y, this.movementDirection.x);
          const headLength = 5 + r * 3;
          ctx.beginPath();
          ctx.moveTo(
            this.movementDirection.x * arrowLength,
            this.movementDirection.y * arrowLength
          );
          ctx.lineTo(
            this.movementDirection.x * arrowLength - headLength * Math.cos(angle - Math.PI / 6),
            this.movementDirection.y * arrowLength - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(
            this.movementDirection.x * arrowLength,
            this.movementDirection.y * arrowLength
          );
          ctx.lineTo(
            this.movementDirection.x * arrowLength - headLength * Math.cos(angle + Math.PI / 6),
            this.movementDirection.y * arrowLength - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
      }
  
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