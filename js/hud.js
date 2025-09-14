import {
    ENERGY_MAX, ENERGY_REGEN_RATE, COOLDOWN_TIME,
  } from './constants.js';
  import { clamp } from './utils.js';
  import { gameOverDiv } from './globals.js';
  
  export class EnergyBar {
    constructor() {
      this.energy = ENERGY_MAX * 0.9;
      this.state = 'active';
      this.cooldown = 0;
    }
    canUse() { return this.state === 'active' && this.energy > 0; }
    drain(amount) {
      if (this.state !== 'active') return;
      this.energy = clamp(this.energy - amount, 0, ENERGY_MAX);
      if (this.energy <= 0) this.startCooldown();
    }
    startCooldown() {
      this.state = 'cooldown';
      this.cooldown = COOLDOWN_TIME;
      this.energy = 0;
    }
    extendCooldown(dt) {
      if (this.state === 'cooldown') this.cooldown += dt;
    }
    update(dt) {
      if (this.state === 'cooldown') {
        this.cooldown -= dt;
        if (this.cooldown <= 0) {
          this.state = 'active';
          this.cooldown = 0;
        } else {
          this.energy = 0;
        }
      } else {
        this.energy = clamp(this.energy + ENERGY_REGEN_RATE * 0.3 * dt, 0, ENERGY_MAX);
      }
    }
    draw(ctx) {
      const x = 12, y = 12, w = 160, h = 12;
      ctx.fillStyle = '#1b603f'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = (this.state === 'cooldown') ? '#2c3e50' : '#3ddc84';
      const fill = (this.state === 'cooldown') ? 0 : w * (this.energy / ENERGY_MAX);
      ctx.fillRect(x, y, fill, h);
      ctx.strokeStyle = '#0a2'; ctx.strokeRect(x, y, w, h);
  
      if (this.state === 'cooldown') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '10px LocalPressStart, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('COOLING…', x + w + 8, y - 1);
      }
    }
  }
  
  export class Hearts {
    constructor() { this.max = 4; this.value = 3; }
    takeDamage(onZero) {
      this.value = Math.max(0, this.value - 1);
      if (this.value === 0 && typeof onZero === 'function') onZero();
    }
    draw(ctx) {
      const x0 = 12, y0 = 30, size = 12, pad = 4;
      for (let i = 0; i < this.max; i++) {
        ctx.fillStyle = (i < this.value) ? '#ff5b6e' : 'rgba(255,255,255,0.2)';
        ctx.fillRect(x0 + i * (size + pad), y0, size, size);
      }
    }
  }
  