import {
  HEART_PIXEL_COLUMNS,
  HEART_PIXEL_ROWS,
} from '../gui/drawPixelatedHeart.js';

export interface HeartPickupOptions {
  x: number;
  y: number;
  pixelSize?: number;
  respawns?: boolean;
  respawnDelay?: number;
  active?: boolean;
}

export class HeartPickup {
  x: number;
  y: number;
  pixelSize: number;
  respawns: boolean;
  respawnDelay: number;
  active: boolean;
  private _timer: number;

  constructor({
    x,
    y,
    pixelSize = 2,
    respawns = true,
    respawnDelay = 5,
    active = true,
  }: HeartPickupOptions) {
    this.x = x;
    this.y = y;
    this.pixelSize = Math.max(1, Math.floor(pixelSize));
    this.respawns = respawns;
    this.respawnDelay = Math.max(0, respawnDelay);
    this.active = active;
    this._timer = 0;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (!this.respawns || this.active || this._timer <= 0) return;
    this._timer = Math.max(0, this._timer - dt);
    if (this._timer === 0) {
      this.active = true;
    }
  }

  collect(): boolean {
    if (!this.active) return false;
    this.active = false;
    this._timer = this.respawns ? this.respawnDelay : 0;
    return true;
  }

  kill(): void {
    this.active = false;
    this.respawns = false;
    this._timer = 0;
  }

  isActive(): boolean {
    return this.active;
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x,
      y: this.y,
      width: HeartPickup.getDimensions(this.pixelSize).width,
      height: HeartPickup.getDimensions(this.pixelSize).height,
    };
  }

  getRenderInfo(): { pixelSize: number; rect: { x: number; y: number; width: number; height: number } } {
    return {
      pixelSize: this.pixelSize,
      rect: this.getBounds(),
    };
  }

  static getDimensions(pixelSize: number): { width: number; height: number } {
    const size = Math.max(1, Math.floor(pixelSize));
    return {
      width: HEART_PIXEL_COLUMNS * size,
      height: HEART_PIXEL_ROWS * size,
    };
  }
}
