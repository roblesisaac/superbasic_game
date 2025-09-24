import { GATE_THICKNESS } from '../config/constants.js';
import { asciiArtEnabled } from '../systems/settings.js';

interface FillerGateOptions {
  y: number;
  startX: number;
  width: number;
}

interface CollisionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class FillerGate {
  y: number;
  startX: number;
  width: number;
  active = true;
  floating = false;
  speed = 0;
  direction = 0;
  originalSpeed = 0;

  constructor({ y, startX, width }: FillerGateOptions) {
    this.y = y;
    this.startX = startX;
    this.width = Math.max(0, width);
  }

  update(): void {}

  startFloating(): void {}

  setSpan(startX: number, width: number): void {
    this.startX = startX;
    this.width = Math.max(0, width);
    this.active = this.width > 0;
  }

  getRects(): CollisionRect[] {
    if (!this.active || this.width <= 0) return [];
    return [
      {
        x: this.startX,
        y: this.y - GATE_THICKNESS / 2,
        w: this.width,
        h: GATE_THICKNESS,
      },
    ];
  }

  draw(ctx: CanvasRenderingContext2D, cameraY: number): void {
    if (!this.active || this.width <= 0) return;

    const rect = {
      x: this.startX,
      y: this.y - GATE_THICKNESS / 2,
      w: this.width,
      h: GATE_THICKNESS,
    };

    if (asciiArtEnabled) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (rect.w > 0 && rect.h > 0) {
        const count = Math.max(1, Math.floor(rect.w / 10));
        const ascii = ':'.repeat(count);
        ctx.fillText(ascii, rect.x + rect.w / 2, rect.y - cameraY + rect.h / 2);
      }
      return;
    }

    ctx.fillStyle = '#5aa2ff';
    ctx.fillRect(rect.x, rect.y - cameraY, rect.w, rect.h);
  }
}

export type FillerGateInstance = FillerGate;
