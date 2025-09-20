import { SPRITE_SIZE } from './constants.js';
import { asciiArtEnabled } from './settings.js';
import { cameraY, canvasHeight, groundY } from './globals.js';
import { budgetSections } from './budget.js';

export let enemies = [];

export function resetEnemies() {
  enemies.length = 0;
}

const ENEMY_SIZE = 14;
const ENEMY_MIN_SPEED = 80;
const ENEMY_MAX_SPEED = 140;
const TRACK_MARGIN = 6;

export class Enemy {
  constructor({ track, direction = 1, speed }) {
    this.track = track; // { type: 'H'|'V', x1, x2, y1, y2 }
    this.direction = Math.random() < 0.5 ? -1 : 1;
    if (direction === 1 || direction === -1) this.direction = direction;
    this.speed = speed || (ENEMY_MIN_SPEED + Math.random() * (ENEMY_MAX_SPEED - ENEMY_MIN_SPEED));

    this.size = ENEMY_SIZE;
    this.active = true;
    this.x = this.track.type === 'H' ? this._rand(this.track.x1, this.track.x2) : (this.track.x1 + this.track.x2) / 2;
    this.y = this.track.type === 'V' ? this._rand(this.track.y1, this.track.y2) : (this.track.y1 + this.track.y2) / 2;
  }

  _rand(a, b) { return a + Math.random() * (b - a); }

  update(dt, game) {
    if (!this.active) return;

    if (this.track.type === 'H') {
      this.x += this.speed * this.direction * dt;
      if (this.x <= this.track.x1) { this.x = this.track.x1; this.direction *= -1; }
      if (this.x >= this.track.x2) { this.x = this.track.x2; this.direction *= -1; }
    } else {
      this.y += this.speed * this.direction * dt;
      if (this.y <= this.track.y1) { this.y = this.track.y1; this.direction *= -1; }
      if (this.y >= this.track.y2) { this.y = this.track.y2; this.direction *= -1; }
    }

    // Cull far below camera to keep list small
    if (this.y > cameraY + canvasHeight + 300) this.active = false;

    // Sprite collision
    const sprite = game.sprite;
    if (!sprite) return;
    const halfSprite = SPRITE_SIZE / 2;
    const left = this.x - this.size / 2;
    const right = this.x + this.size / 2;
    const top = this.y - this.size / 2;
    const bottom = this.y + this.size / 2;

    const sLeft = sprite.x - halfSprite;
    const sRight = sprite.x + halfSprite;
    const sTop = sprite.y - halfSprite;
    const sBottom = sprite.y + halfSprite;

    const hOverlap = (sRight >= left) && (sLeft <= right);
    const vOverlap = (sBottom >= top) && (sTop <= bottom);
    if (hOverlap && vOverlap) {
      // Determine stomp vs damage: if sprite is descending, treat as stomp
      if (sprite.vy > 0 && sTop < this.y) {
        // Stomp: eliminate enemy and give a small bounce
        this.active = false;
        sprite.vy = -600;
      } else {
        // Damage on touch
        if (!sprite.stunned) sprite.takeDamage();
      }
    }

    // Remove if far above ground out of bounds (safety)
    if (this.y < -200) this.active = false;
  }

  draw(ctx, cameraY) {
    if (!this.active) return;
    const sx = this.x;
    const sy = this.y - cameraY;
    if (sy < -50 || sy > canvasHeight + 50) return;

    if (asciiArtEnabled) {
      ctx.save();
      ctx.fillStyle = '#ff4d4d';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x', sx, sy);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = '#FF4444';
      ctx.strokeStyle = '#CC0000';
      ctx.lineWidth = 2;
      const r = this.size / 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(-3, -2, 2, 2);
      ctx.fillRect(1, -2, 2, 2);
      // Mouth
      ctx.fillRect(-3, 2, 6, 1);
      ctx.restore();
    }
  }
}

export function updateEnemies(list, dt, game) {
  for (const e of list) e.update(dt, game);
}

export function pruneInactiveEnemies(list) {
  for (let i = list.length - 1; i >= 0; i--) if (!list[i] || list[i].active === false) list.splice(i, 1);
}

export function drawEnemies(ctx, list, cameraYArg) {
  for (const e of list) e.draw(ctx, cameraYArg);
}

// Gate-driven spawns ---------------------------------------------------------
export function createEnemiesForGate(gate) {
  if (!gate || typeof gate.getRects !== 'function') return;

  // Determine section by gate.y
  const feet = Math.max(0, Math.floor((groundY - gate.y) / 16)); // PIXELS_PER_FOOT = 16
  const sectionIndex = Math.floor(feet / 100);
  const section = budgetSections[sectionIndex];
  if (!section) return;

  const remaining = Math.max(0, (section.itemCount || 0) - (section.spawned || 0));
  if (remaining <= 0) return;

  const rects = gate.getRects().filter(r => r && r.w > 12 && r.h > 12);
  if (rects.length === 0) return;

  // Spawn up to 2 per gate, respecting section cap
  const desired = Math.min(2, remaining);
  let spawned = 0;

  // Prefer longer segments so enemies have room to move
  const scored = rects.map(r => ({ r, score: Math.max(r.w, r.h) }));
  scored.sort((a, b) => b.score - a.score);

  for (let i = 0; i < scored.length && spawned < desired; i++) {
    const rect = scored[i].r;
    const isHorizontal = rect.w >= rect.h;

    if (isHorizontal) {
      const x1 = rect.x + TRACK_MARGIN;
      const x2 = rect.x + rect.w - TRACK_MARGIN;
      if (x2 - x1 < ENEMY_SIZE + 4) continue;
      const track = { type: 'H', x1, x2, y1: rect.y + rect.h / 2, y2: rect.y + rect.h / 2 };
      enemies.push(new Enemy({ track }));
    } else {
      const y1 = rect.y + TRACK_MARGIN;
      const y2 = rect.y + rect.h - TRACK_MARGIN;
      if (y2 - y1 < ENEMY_SIZE + 4) continue;
      const track = { type: 'V', x1: rect.x + rect.w / 2, x2: rect.x + rect.w / 2, y1, y2 };
      enemies.push(new Enemy({ track }));
    }
    spawned++;
    section.spawned = (section.spawned || 0) + 1;
  }
}

