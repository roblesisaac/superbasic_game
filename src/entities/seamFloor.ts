import { GATE_THICKNESS } from '../config/constants.js';
import { asciiArtEnabled } from '../systems/settings.js';

export interface SeamFloorOptions {
  x: number;
  width: number;
  topY: number;
  thickness?: number;
  epsilon?: number;
}

export class SeamFloor {
  baseX: number;
  baseWidth: number;
  y: number;
  thickness: number;
  epsilon: number;
  active = true;
  floating = false;
  oneWay = true;

  constructor({ x, width, topY, thickness = GATE_THICKNESS, epsilon = 1 }: SeamFloorOptions) {
    this.baseX = x;
    this.baseWidth = width;
    this.thickness = thickness;
    this.epsilon = epsilon;
    this.y = topY - epsilon;
  }

  update(): void {}

  getTopY(): number {
    return this.y;
  }

  getRects() {
    return [
      {
        x: this.baseX - this.epsilon,
        y: this.y,
        w: this.baseWidth + this.epsilon * 2,
        h: this.thickness,
      },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    if (!this.active) return;
    const rect = this.getRects()[0];
    const screenX = rect.x - cameraX;
    const screenY = rect.y - cameraY;

    if (asciiArtEnabled) {
      ctx.fillStyle = '#8ab6ff';
      const count = Math.max(1, Math.floor(rect.w / 12));
      const ascii = '='.repeat(count);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '12px monospace';
      ctx.fillText(ascii, screenX, screenY + rect.h / 2);
    } else {
      const gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + rect.h);
      gradient.addColorStop(0, 'rgba(120,180,255,0.8)');
      gradient.addColorStop(1, 'rgba(120,180,255,0.3)');
      ctx.fillStyle = gradient;
      ctx.fillRect(screenX, screenY, rect.w, rect.h);
    }
  }
}
