import {
  GRAVITY, GLIDE_GRAVITY_FACTOR, GROUND_FRICTION,
  CHARGE_TIME, JUMP_MIN, JUMP_MAX, JUMP_SMALL_COOLDOWN,
  STRETCH_SCALE_X, STRETCH_SCALE_Y, STRETCH_TIME,
  VELOCITY_STRETCH_FACTOR, MAX_VELOCITY_STRETCH,
  IMPACT_SQUASH_FACTOR, IMPACT_DECAY_RATE,
  CHARGE_SQUASH_MAX, CHARGE_WIDEN_MAX,
  SAFE_FALL_VY, SAFE_FALL_HEIGHT, STUN_TIME,
  INVULNERABILITY_TIME, INVULNERABILITY_BLINK_INTERVAL_SLOW,
  INVULNERABILITY_BLINK_INTERVAL_FAST,
  SPRITE_SIZE,
  MOVEMENT_MIN, MOVEMENT_MAX, RIDE_SPEED_THRESHOLD,
  RIDE_BOUNCE_VX_FACTOR, RIDE_BOUNCE_VY,
  RIDE_WEIGHT_SHIFT_MAX, GATE_THICKNESS,
  WATER_GRAVITY_FACTOR, WATER_BUOYANCY_ACCEL, WATER_LINEAR_DAMPING,
  WATER_MAX_SPEED, WATER_STROKE_FORCE_SCALE, WATER_ENTRY_DAMPING,
  WATER_MAX_SINK_SPEED
} from '../../config/constants.js';
import { clamp } from '../../utils/utils.js';
import { canvasHeight, canvasWidth, groundY } from '../runtime/state/rendering_state.js';
import { cameraY } from '../runtime/state/camera_state.js';
import { showHeartGainNotification } from '../gui/notifications.js';
import { HeartPickup } from './heartPickup.js';
import {
  getWellBounds,
  getWellExpansionSpan,
  getWellExpansionTopY,
  getWellRimTopY,
  getWellShaftBottomY,
  getWellShaftSpan,
  getWellWaterSurfaceY
} from '../runtime/environment/well_layout.js';

const SPRITE_SRC = '/icons/sprite.svg';
const spriteImg = new window.Image();
spriteImg.src = SPRITE_SRC;
let spriteLoaded = false;
spriteImg.onload = () => { spriteLoaded = true; };

type SpriteHooks = {
  energyBar: any;
  hearts: any;
  onGameOver: () => void;
  getRides: () => any[];
  getGates: () => any[];
  getHeartPickups?: () => HeartPickup[];
};

interface GatePassageState {
  started: boolean;
  entrySide: string | null;
  touched: boolean;
  pendingCollision: boolean;
}

export class Sprite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  onPlatform: boolean;
  platformSurface: any;
  charging: boolean;
  chargeTime: number;
  movementCharging: boolean;
  movementChargeTime: number;
  movementDirection: { x: number; y: number };
  gliding: boolean;
  stunned: boolean;
  stunTime: number;
  invulnerableTime: number;
  invulnerableBlinkTimer: number;
  invulnerableVisible: boolean;
  fallStartY: number;
  scaleX: number;
  scaleY: number;
  stretchTimer: number;
  impactSquash: number;
  velocityScaleX: number;
  velocityScaleY: number;
  lastMovementDirection: { x: number; y: number };
  facingLeft: boolean;
  waterFacingAngle: number;
  hooks: SpriteHooks;
  gateStates: WeakMap<object, GatePassageState>;
  prevX: number;
  prevY: number;
  prevVy: number;
  inWater: boolean;

  constructor(x: number, y: number, hooks: SpriteHooks) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.onGround = true; this.onPlatform = false;
    this.platformSurface = null;

    // Jump charging
    this.charging = false; this.chargeTime = 0;

    // Movement charging (joystick)
    this.movementCharging = false;
    this.movementChargeTime = 0;
    this.movementDirection = { x: 0, y: 0 }; // normalized direction vector

    this.gliding = false;
    this.stunned = false; this.stunTime = 0;
    this.invulnerableTime = 0;
    this.invulnerableBlinkTimer = 0;
    this.invulnerableVisible = true;
    this.fallStartY = y;

    // visuals
    this.scaleX = 1; this.scaleY = 1;
    this.stretchTimer = 0;
    this.impactSquash = 0;
    this.velocityScaleX = 1;
    this.velocityScaleY = 1;
    this.lastMovementDirection = { x: 0, y: 0 }; // for stretch effects
    this.facingLeft = false; // true if last moving left
    this.waterFacingAngle = 0;

    // hooks to access game state without circular imports
    this.hooks = hooks; // { energyBar, hearts, onGameOver, getRides:()=>[], getGates:()=>[] }

    this.gateStates = new WeakMap();

    this.prevX = x;
    this.prevY = y;
    this.prevVy = 0;
    this.inWater = false;
  }

  startCharging() {
    if (this.hooks.energyBar.state === 'cooldown') {
      this.charging = true; 
      this.chargeTime = 0; 
      return;
    }
    if (this.onGround && this.hooks.energyBar.canUse()) {
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
    if (this.hooks.energyBar.canUse()) {
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
    if (this.charging && this.onGround) {
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
        let force = MOVEMENT_MIN * 0.5;
        if (this.inWater && !this.onGround) {
          force *= WATER_STROKE_FORCE_SCALE;
        }
        this.vx += -this.movementDirection.x * force;
        this.vy += -this.movementDirection.y * force;
        this.hooks.energyBar.extendCooldown(0.15);
      } else {
        // Normal movement
        const r = Math.min(1, this.movementChargeTime / CHARGE_TIME);
        let force = MOVEMENT_MIN + (MOVEMENT_MAX - MOVEMENT_MIN) * r;
        if (this.inWater && !this.onGround) {
          force *= WATER_STROKE_FORCE_SCALE;
        }

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
    if (!this.onGround && this.vy > 0 && this.hooks.energyBar.canUse()) {
      this.gliding = true;
    }
  }
  
  stopGliding() { 
    this.gliding = false; 
  }

  takeDamage() {
    if (this.isInvulnerable()) return;
    this.hooks.hearts.takeDamage(() => this.hooks.onGameOver());
    this.stunned = true;
    this.stunTime = STUN_TIME;
    this.invulnerableTime = INVULNERABILITY_TIME;
    this.invulnerableBlinkTimer = this._getInvulnerabilityBlinkInterval() * 0.5;
    this.invulnerableVisible = true;
    this.impactSquash = IMPACT_SQUASH_FACTOR * 0.5;
  }

  isInvulnerable() {
    return this.invulnerableTime > 0;
  }

  _doFollowThroughStretch(direction) {
    this.stretchTimer = STRETCH_TIME;
    if (direction) {
      this.lastMovementDirection = { ...direction };
    }
  }

  _getInvulnerabilityBlinkInterval() {
    if (this.invulnerableTime <= 0) return INVULNERABILITY_BLINK_INTERVAL_FAST;
    const ratio = clamp(this.invulnerableTime / INVULNERABILITY_TIME, 0, 1);
    return INVULNERABILITY_BLINK_INTERVAL_FAST +
      (INVULNERABILITY_BLINK_INTERVAL_SLOW - INVULNERABILITY_BLINK_INTERVAL_FAST) * ratio;
  }

  _updateInvulnerability(dt: number) {
    if (this.invulnerableTime <= 0) return;

    this.invulnerableTime = Math.max(0, this.invulnerableTime - dt);
    this.invulnerableBlinkTimer -= dt;

    if (this.invulnerableBlinkTimer <= 0) {
      this.invulnerableVisible = !this.invulnerableVisible;
      this.invulnerableBlinkTimer = this._getInvulnerabilityBlinkInterval();
    }

    if (this.invulnerableTime <= 0) {
      this.invulnerableVisible = true;
      this.invulnerableBlinkTimer = 0;
    }
  }

  _isGateSurface(surface) {
    return surface && typeof surface === 'object' && typeof surface.getRects === 'function' && surface.gapInfo;
  }

  _getGateState(gate) {
    if (!this.gateStates.has(gate)) {
      this.gateStates.set(gate, {
        started: false,
        entrySide: null,
        touched: false,
        pendingCollision: false
      });
    }
    return this.gateStates.get(gate);
  }

  _markGateCollision(surface, contactType: 'top' | 'side' | 'bottom' = 'side') {
    if (!this._isGateSurface(surface)) return;
    if (typeof surface.notifyContact === 'function') {
      surface.notifyContact(contactType);
    }
    const state = this._getGateState(surface);
    state.pendingCollision = true;
  }

  _markGateBottomCollision(surface) {
    if (!this._isGateSurface(surface)) return;
    if (typeof surface.handleBottomCollision === 'function') {
      surface.handleBottomCollision();
    }
    this._markGateCollision(surface, 'bottom');
  }

  _getGateGapRect(gate) {
    if (!this._isGateSurface(gate) || !gate.gapInfo) return null;
    const type = gate.gapInfo.type;
    if (type === 'H') {
      return { x: gate.gapX, y: gate.gapY, w: gate.gapWidth, h: GATE_THICKNESS };
    }
    if (type === 'V') {
      return { x: gate.gapX, y: gate.gapY, w: GATE_THICKNESS, h: gate.gapWidth };
    }
    return null;
  }

  _determineGateSide(rect, gapRect, orientation) {
    if (!rect || !gapRect) return 'outside';
    if (orientation === 'H') {
      if (rect.bottom <= gapRect.y) return 'below';
      if (rect.top >= gapRect.y + gapRect.h) return 'above';
      if (rect.right <= gapRect.x) return 'left';
      if (rect.left >= gapRect.x + gapRect.w) return 'right';
    } else {
      if (rect.right <= gapRect.x) return 'left';
      if (rect.left >= gapRect.x + gapRect.w) return 'right';
      if (rect.bottom <= gapRect.y) return 'above';
      if (rect.top >= gapRect.y + gapRect.h) return 'below';
    }
    return 'inside';
  }

  _isValidEntrySide(side, orientation) {
    if (orientation === 'H') return side === 'below' || side === 'above';
    return side === 'left' || side === 'right';
  }

  _isOppositeSide(entrySide, exitSide, orientation) {
    if (orientation === 'H') {
      return (
        (entrySide === 'below' && exitSide === 'above') ||
        (entrySide === 'above' && exitSide === 'below')
      );
    }
    return (
      (entrySide === 'left' && exitSide === 'right') ||
      (entrySide === 'right' && exitSide === 'left')
    );
  }

  _isRectNearGap(rect, gapRect, margin = GATE_THICKNESS * 2) {
    if (!rect || !gapRect) return false;
    const expanded = {
      left: gapRect.x - margin,
      right: gapRect.x + gapRect.w + margin,
      top: gapRect.y - margin,
      bottom: gapRect.y + gapRect.h + margin
    };
    return !(
      rect.right < expanded.left ||
      rect.left > expanded.right ||
      rect.bottom < expanded.top ||
      rect.top > expanded.bottom
    );
  }

  _updateGatePassage(prevRect, currRect) {
    if (!this.hooks || typeof this.hooks.getGates !== 'function') return;
    const gates = this.hooks.getGates();
    if (!Array.isArray(gates) || gates.length === 0) return;

    for (const gate of gates) {
      if (!this._isGateSurface(gate)) continue;
      const gapRect = this._getGateGapRect(gate);
      if (!gapRect) continue;

      const state = this._getGateState(gate);
      const orientation = gate.gapInfo?.type === 'V' ? 'V' : 'H';
      const prevSide = this._determineGateSide(prevRect, gapRect, orientation);
      const currSide = this._determineGateSide(currRect, gapRect, orientation);
      const currInside = currSide === 'inside';

      if (state.started) {
        if (state.pendingCollision) {
          state.touched = true;
          state.pendingCollision = false;
        }
        if (!currInside) {
          const passed = this._isOppositeSide(state.entrySide, currSide, orientation);
          if (passed && !state.touched) this._handleGateClear(gate);

          state.started = false;
          state.entrySide = null;
          state.touched = false;
          state.pendingCollision = false;
        }
      } else {
        if (currInside && prevSide !== 'inside') {
          const entrySide = prevSide;
          const validEntry = this._isValidEntrySide(entrySide, orientation);
          state.started = true;
          state.entrySide = entrySide;
          state.touched = state.pendingCollision || !validEntry;
          state.pendingCollision = false;
        } else if (!currInside && state.pendingCollision && !this._isRectNearGap(currRect, gapRect)) {
          state.pendingCollision = false;
        }
      }
    }
  }

  _handleGateClear(gate) {
    if (gate && typeof gate.onCleanPass === 'function') {
      gate.onCleanPass();
    }
  }

  _checkHeartPickups(currRect: { left: number; right: number; top: number; bottom: number }) {
    if (!this.hooks) return;

    const overlapsBounds = (bounds: { x: number; y: number; width: number; height: number }) =>
      currRect.right >= bounds.x &&
      currRect.left <= bounds.x + bounds.width &&
      currRect.bottom >= bounds.y &&
      currRect.top <= bounds.y + bounds.height;

    const tryCollect = (bounds: { x: number; y: number; width: number; height: number }, collect: () => boolean) => {
      if (!overlapsBounds(bounds)) return;
      if (collect()) {
        this._awardHeart();
      }
    };

    const gates = typeof this.hooks.getGates === 'function' ? this.hooks.getGates() : [];
    if (Array.isArray(gates)) {
      for (const gate of gates) {
        if (!gate || typeof gate.getHeartPickup !== 'function') continue;
        const pickup = gate.getHeartPickup();
        if (!pickup) continue;

        tryCollect(pickup, () => {
          if (typeof gate.collectHeart === 'function') {
            return gate.collectHeart();
          }
          if (typeof gate.onHeartCollected === 'function') {
            return Boolean(gate.onHeartCollected());
          }
          return false;
        });
      }
    }

    const extraHearts =
      typeof this.hooks.getHeartPickups === 'function' ? this.hooks.getHeartPickups() : [];

    if (Array.isArray(extraHearts)) {
      for (const heart of extraHearts) {
        if (!heart || typeof heart.isActive !== 'function' || !heart.isActive()) continue;
        const bounds = heart.getBounds();
        tryCollect(bounds, () => heart.collect());
      }
    }
  }

  _awardHeart() {
    if (!this.hooks || !this.hooks.hearts || typeof this.hooks.hearts.gain !== 'function') return;
    const prevHearts = typeof this.hooks.hearts.value === 'number' ? this.hooks.hearts.value : 0;
    this.hooks.hearts.gain(1);
    if (typeof this.hooks.hearts.value === 'number' && this.hooks.hearts.value > prevHearts) {
      showHeartGainNotification();
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
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevVy = this.vy;
    const wasInWater = this.inWater;

    this._updateVelocityStretch();
    this._updateImpactSquash(dt);
    this._updateFollowThrough(dt);
    this._updateInvulnerability(dt);

    // Track facing direction based on vx
    if (this.vx > 20) {
      this.facingLeft = false;
    } else if (this.vx < -20) {
      this.facingLeft = true;
    }

    if (this.stunned) {
      this.stunTime -= dt;
      if (this.stunTime <= 0) this.stunned = false;
    }

    const prevX = this.x;
    const prevY = this.y;
    const hs = SPRITE_SIZE / 2;
    const wasOnGround = this.onGround;
    const wasOnPlatform = this.onPlatform;
    const well = getWellBounds(canvasWidth);
    const cavernSpan = getWellExpansionSpan(canvasWidth);
    const expansionTopY = getWellExpansionTopY(groundY, canvasHeight);
    const waterSurfaceY = getWellWaterSurfaceY(groundY, canvasHeight);
    const shaftBottomY = getWellShaftBottomY(groundY, canvasHeight);

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

    const prevBottom = prevY + hs;
    const prevHorizInCavern =
      (prevX + hs) > cavernSpan.interiorLeft &&
      (prevX - hs) < cavernSpan.interiorRight;
    const preUpdateInWater =
      prevBottom >= waterSurfaceY &&
      prevBottom >= expansionTopY &&
      prevHorizInCavern;

    let g = GRAVITY;
    if (this.gliding && this.vy > 0 && !this.onGround) g *= GLIDE_GRAVITY_FACTOR;
    if (preUpdateInWater) {
      g *= WATER_GRAVITY_FACTOR;
      this.vy -= WATER_BUOYANCY_ACCEL * dt;
    }
    this.vy += g * dt;

    if (preUpdateInWater) {
      const damping = Math.exp(-WATER_LINEAR_DAMPING * dt);
      this.vx *= damping;
      this.vy *= damping;
      if (this.vy > WATER_MAX_SINK_SPEED) this.vy = WATER_MAX_SINK_SPEED;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > WATER_MAX_SPEED) {
        const scale = WATER_MAX_SPEED / speed;
        this.vx *= scale;
        this.vy *= scale;
      }
    }

    if (this.onGround && Math.abs(this.vx) > 0) {
      const fr = GROUND_FRICTION * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * fr;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = clamp(this.x, hs, canvasWidth - hs);

    const prevTop = prevY - hs;
    const prevLeft = prevX - hs;
    const prevRight = prevX + hs;

    this.onGround = false;
    this.onPlatform = false;
    this.inWater = false;

    const previousPlatform = this.platformSurface;
    let newPlatformSurface = null;

    // ride and gate collisions
    const surfaceCollections = [];
    if (typeof this.hooks.getRides === 'function') surfaceCollections.push(this.hooks.getRides());
    if (typeof this.hooks.getGates === 'function') surfaceCollections.push(this.hooks.getGates());

    const currLeft = this.x - hs;
    const currRight = this.x + hs;
    const currTop = this.y - hs;
    const currBottom = this.y + hs;
    const epsilon = 0.1;

    let landingCandidate = null;
    let ceilingCandidate = null;
    let leftSideCandidate = null;
    let rightSideCandidate = null;
    let blockedHorizontally = false;

    for (const collection of surfaceCollections) {
      if (!collection) continue;
      for (const surface of collection) {
        if (!surface || surface.active === false) continue;
        const rects = (typeof surface.getRects === 'function') ? surface.getRects() : [surface.getRect()];
        for (const rect of rects) {
          if (!rect || rect.w <= 0 || rect.h <= 0) continue;

          const surfaceLeft = rect.x;
          const surfaceRight = rect.x + rect.w;
          const surfaceTop = rect.y;
          const surfaceBottom = rect.y + rect.h;

          const hOverlap = (currRight >= surfaceLeft) && (currLeft <= surfaceRight);
          const vOverlap = (currBottom >= surfaceTop) && (currTop <= surfaceBottom);

          const sameSurfaceAsBefore = surface === previousPlatform;
          const landingTolerance = sameSurfaceAsBefore
            ? Math.max(epsilon, RIDE_WEIGHT_SHIFT_MAX)
            : epsilon;

          if (hOverlap && this.vy >= 0 && prevBottom <= surfaceTop + landingTolerance && currBottom >= surfaceTop) {
            if (!landingCandidate || surfaceTop < landingCandidate.top) {
              landingCandidate = { surface, top: surfaceTop };
            }
          }

          if (hOverlap && this.vy < 0 && prevTop >= surfaceBottom - epsilon && currTop <= surfaceBottom) {
            if (!ceilingCandidate || surfaceBottom > ceilingCandidate.bottom) {
              ceilingCandidate = { surface, bottom: surfaceBottom };
            }
          }

          if (!vOverlap) continue;

          if (prevRight <= surfaceLeft + epsilon && currRight >= surfaceLeft) {
            const overlap = currRight - surfaceLeft;
            if (!leftSideCandidate || overlap < leftSideCandidate.overlap) {
              leftSideCandidate = {
                surface,
                overlap,
                pushX: surfaceLeft - hs
              };
            }
          }

          if (prevLeft >= surfaceRight - epsilon && currLeft <= surfaceRight) {
            const overlap = surfaceRight - currLeft;
            if (!rightSideCandidate || overlap < rightSideCandidate.overlap) {
              rightSideCandidate = {
                surface,
                overlap,
                pushX: surfaceRight + hs
              };
            }
          }
        }
      }
    }

    let activeSideCollision = null;
    if (leftSideCandidate && rightSideCandidate) {
      activeSideCollision = leftSideCandidate.overlap <= rightSideCandidate.overlap
        ? { ...leftSideCandidate, direction: -1 }
        : { ...rightSideCandidate, direction: 1 };
    } else if (leftSideCandidate) {
      activeSideCollision = { ...leftSideCandidate, direction: -1 };
    } else if (rightSideCandidate) {
      activeSideCollision = { ...rightSideCandidate, direction: 1 };
    }

    if (activeSideCollision) {
      this.x = activeSideCollision.pushX;
      this.vx = 0;
      this.impactSquash = Math.max(this.impactSquash, 0.6);
      blockedHorizontally = true;
      this._markGateCollision(activeSideCollision.surface, 'side');
    }

    if (ceilingCandidate) {
      this.y = ceilingCandidate.bottom + hs;
      if (this.vy < 0) this.vy = 0;
      this.gliding = false;
      this.impactSquash = 1.8 * 0.3;
      this._markGateBottomCollision(ceilingCandidate.surface);
    }

    if (landingCandidate) {
      const surface = landingCandidate.surface;
      this._markGateCollision(surface, 'top');
      if (!('getRects' in surface) && !surface.floating && (surface.speed >= RIDE_SPEED_THRESHOLD)) {
        this.vx = RIDE_BOUNCE_VX_FACTOR * surface.speed * (surface.direction || 1);
        this.vy = RIDE_BOUNCE_VY;
        this.impactSquash = 1.8 * 1.2;
        newPlatformSurface = null;
      } else {
        let landingTop = landingCandidate.top;
        const shouldShiftRide =
          typeof surface.applyWeightShift === 'function' &&
          (surface !== previousPlatform || !wasOnGround);

        if (shouldShiftRide) {
          surface.applyWeightShift(this.vy);
          // Don't reposition sprite during landing animation - only use base position
          // The visual effect happens in the ride's rendering, not sprite positioning
        }
        this.y = landingTop - hs;
        this.vy = 0;
        this.onGround = true;
        this.onPlatform = true;
        newPlatformSurface = surface;
        if (!blockedHorizontally) {
          this.vx = (surface.speed || 0) * (surface.direction || 0);
        } else {
          this.vx = 0;
        }
        this.gliding = false;
        if (!wasOnGround) this.impactSquash = 1.8;
      }
    }

    // Detect launch from ride platform
    if (previousPlatform && 
        previousPlatform !== newPlatformSurface && 
        typeof previousPlatform.applyLaunchEffect === 'function' &&
        (this.vy < 0 || !this.onGround)) {
      // Sprite is launching off the ride - trigger launch effect
      const launchVelocity = Math.abs(this.vy);
      previousPlatform.applyLaunchEffect(launchVelocity);
    }

    this.platformSurface = newPlatformSurface;

    const applyStaticLanding = (surfaceY: number) => {
      this.y = surfaceY - hs;
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
      this.inWater = false;
    };

    let spriteLeft = this.x - hs;
    let spriteRight = this.x + hs;
    let spriteBottom = this.y + hs;
    const centerOverOpening = this.x > well.left && this.x < well.right;
    const rimTopY = getWellRimTopY(groundY);
    const overlapsRimSpan = spriteRight > well.rimLeft && spriteLeft < well.rimRight;
    const cameFromAboveRim = prevBottom <= rimTopY;
    const eligibleForRimLanding =
      overlapsRimSpan &&
      !centerOverOpening &&
      spriteBottom >= rimTopY &&
      cameFromAboveRim;

    // ground and well rim collisions
    if (!this.onPlatform) {
      if (eligibleForRimLanding) {
        applyStaticLanding(rimTopY);
      } else if (
        spriteBottom >= groundY &&
        !centerOverOpening &&
        spriteBottom < expansionTopY &&
        (prevBottom <= groundY || wasOnGround)
      ) {
        applyStaticLanding(groundY);
      }
    }

    spriteLeft = this.x - hs;
    spriteRight = this.x + hs;
    spriteBottom = this.y + hs;

    if (spriteBottom > rimTopY && spriteRight > well.left && spriteLeft < well.right) {
      const inExpansionZone = spriteBottom >= expansionTopY;
      const { interiorLeft, interiorRight } = inExpansionZone
        ? cavernSpan
        : getWellShaftSpan(well);
      const spanWidth = interiorRight - interiorLeft;

      if (spanWidth > 0) {
        if (spriteLeft < interiorLeft) {
          this.x = interiorLeft + hs;
          spriteLeft = this.x - hs;
          spriteRight = this.x + hs;
          blockedHorizontally = true;
          if (this.vx < 0) this.vx = 0;
        }

        if (spriteRight > interiorRight) {
          this.x = interiorRight - hs;
          spriteLeft = this.x - hs;
          spriteRight = this.x + hs;
          blockedHorizontally = true;
          if (this.vx > 0) this.vx = 0;
        }
      }
    }

    let submergedInWater = false;
    if (
      spriteBottom >= expansionTopY &&
      spriteRight > cavernSpan.interiorLeft &&
      spriteLeft < cavernSpan.interiorRight
    ) {
      if (spriteBottom >= waterSurfaceY) {
        submergedInWater = true;
        this.inWater = true;
        this.onGround = false;
        if (!wasInWater) {
          this.vx *= WATER_ENTRY_DAMPING;
          this.vy *= WATER_ENTRY_DAMPING;
        }
        if (spriteBottom > shaftBottomY) {
          this.y = shaftBottomY - hs;
          spriteBottom = this.y + hs;
          if (this.vy > 0) this.vy = 0;
        }
        spriteLeft = this.x - hs;
        spriteRight = this.x + hs;
      }
    }

    if (!submergedInWater && spriteBottom >= shaftBottomY && this.vy >= 0) {
      if (spriteRight > cavernSpan.interiorLeft && spriteLeft < cavernSpan.interiorRight) {
        applyStaticLanding(shaftBottomY);
      }
    }

    const prevRect = { left: prevLeft, right: prevRight, top: prevTop, bottom: prevBottom };
    const currRect = {
      left: this.x - hs,
      right: this.x + hs,
      top: this.y - hs,
      bottom: this.y + hs
    };
    this._checkHeartPickups(currRect);
    this._updateGatePassage(prevRect, currRect);

    if (wasOnGround && !this.onGround) this.fallStartY = this.y;
    this._updateSwimOrientation(dt);
    this._applyFinalScale();
  }

  draw(ctx, cameraY) {
    const px = this.x;
    let platformVisualYOffset = 0;
    if (this.onPlatform && this.platformSurface) {
      const surface = this.platformSurface;
      if (typeof surface.getVisualYOffset === 'function') {
        platformVisualYOffset = surface.getVisualYOffset();
      } else if (typeof surface.y === 'number' && typeof surface.baseY === 'number') {
        platformVisualYOffset = surface.y - surface.baseY;
      }
    }
    const py = this.y - cameraY + platformVisualYOffset;
    const size = SPRITE_SIZE;

    // --- Draw sprite (with mirroring and scaling) ---
    const shouldRenderSprite = !(this.invulnerableTime > 0 && !this.invulnerableVisible);
    if (shouldRenderSprite) {
      ctx.save();
      ctx.translate(px, py);

      const rotateForSwimming = Math.abs(this.waterFacingAngle) > 0.001 || this.inWater;
      if (rotateForSwimming) {
        ctx.rotate(this.waterFacingAngle);
      }

      // Combine mirroring and stretch scaling in one scale call.
      // Negative X when facing left mirrors the sprite about its center when not swimming.
      const mirror = rotateForSwimming ? 1 : (this.facingLeft ? -1 : 1);
      const sx = mirror * this.scaleX;
      const sy = this.scaleY;
      ctx.scale(sx, sy);

      if (spriteLoaded) {
        ctx.drawImage(spriteImg, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-size / 2, -size / 2, size, size);
      }
      ctx.restore();
    }

    // --- Draw movement charging arrows (never mirrored, but still stretched) ---
    if (this.movementCharging && this.hooks.energyBar.state === 'active') {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(this.scaleX, this.scaleY); // Only stretch, no mirroring
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
      ctx.restore();
    }

    // --- Draw gliding indicator (mirroring doesn't matter) ---
    if (this.vy > 0 && this.gliding) {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(this.scaleX, this.scaleY);
      ctx.fillStyle = '#f66';
      ctx.beginPath();
      ctx.moveTo(SPRITE_SIZE / 2, -4);
      ctx.lineTo(SPRITE_SIZE / 2 + 14, 0);
      ctx.lineTo(SPRITE_SIZE / 2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  _updateSwimOrientation(dt: number) {
    const SWIM_ROTATE_SPEED = 12;
    const SWIM_RETURN_SPEED = 16;
    const MIN_SPEED_FOR_UPDATE = 20;

    if (this.inWater) {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > MIN_SPEED_FOR_UPDATE) {
        const targetAngle = Math.atan2(this.vy, this.vx);
        const factor = 1 - Math.exp(-SWIM_ROTATE_SPEED * dt);
        this.waterFacingAngle = this._approachAngle(this.waterFacingAngle, targetAngle, factor);
      }
    } else {
      const factor = 1 - Math.exp(-SWIM_RETURN_SPEED * dt);
      this.waterFacingAngle = this._approachAngle(this.waterFacingAngle, 0, factor);
      if (Math.abs(this.waterFacingAngle) < 0.0001) this.waterFacingAngle = 0;
    }
  }

  _approachAngle(current: number, target: number, factor: number) {
    const diff = this._normalizeAngle(target - current);
    return current + diff * clamp(factor, 0, 1);
  }

  _normalizeAngle(angle: number) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
}
