import { ENERGY_MAX, ENERGY_REGEN_RATE, COOLDOWN_TIME } from '../config/constants.js';
import { clamp } from '../utils/utils.js';
import { gameOverDiv } from '../core/globals.js';

export class EnergyBar {
  energy: number;
  state: 'active' | 'cooldown';
  cooldown: number;

  constructor() {
    this.energy = ENERGY_MAX * 0.9;
    this.state = 'active';
    this.cooldown = 0;
  }

  canUse() {
    return this.state === 'active' && this.energy > 0;
  }

  drain(amount: number) {
    if (this.state !== 'active') return;
    this.energy = clamp(this.energy - amount, 0, ENERGY_MAX);
    if (this.energy <= 0) this.startCooldown();
  }

  startCooldown() {
    this.state = 'cooldown';
    this.cooldown = COOLDOWN_TIME;
    this.energy = 0;
  }

  extendCooldown(dt: number) {
    if (this.state === 'cooldown') this.cooldown += dt;
  }

  update(dt: number, canRecharge: boolean) {
    if (this.state === 'cooldown') {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.state = 'active';
        this.cooldown = 0;
      } else {
        this.energy = 0;
      }
    } else if (canRecharge) {
      this.energy = clamp(this.energy + ENERGY_REGEN_RATE * 0.3 * dt, 0, ENERGY_MAX);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const x = 12;
    const y = 12;
    const w = 160;
    const h = 12;
    ctx.fillStyle = '#1b603f';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = this.state === 'cooldown' ? '#2c3e50' : '#3ddc84';
    const fill = this.state === 'cooldown' ? 0 : w * (this.energy / ENERGY_MAX);
    ctx.fillRect(x, y, fill, h);
    ctx.strokeStyle = '#0a2';
    ctx.strokeRect(x, y, w, h);

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
  max: number;
  value: number;

  constructor() {
    this.max = 4;
    this.value = 3;
  }

  takeDamage(onZero?: () => void) {
    this.value = Math.max(0, this.value - 1);
    if (this.value === 0 && typeof onZero === 'function') onZero();
  }

  gain(amount = 1) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.value = Math.min(this.max, this.value + amount);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const x0 = 12;
    const y0 = 30;
    const size = 12;
    const pad = 4;
    for (let i = 0; i < this.max; i++) {
      ctx.fillStyle = i < this.value ? '#ff5b6e' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(x0 + i * (size + pad), y0, size, size);
    }
  }
}

// Reference game over div so TypeScript recognises usage
void gameOverDiv;
