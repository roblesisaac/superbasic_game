import { PLATFORM_THICKNESS, PLATFORM_SPEED_THRESHOLD, PLATFORM_FLOAT_TIME } from './constants.js';
import { canvasWidth } from './globals.js';

export class Platform {
  constructor(x, y, width, speed, direction) {
    this.x = x; this.y = y; this.width = width;
    this.speed = speed; this.direction = direction;
    this.active = true; this.floating = false; this.floatTime = 0;
    this.originalSpeed = speed;
  }
  update(dt) {
    if (!this.active) return;
    if (this.floating) {
      this.floatTime -= dt;
      if (this.floatTime <= 0) this.active = false;
      return;
    }
    this.x += this.speed * this.direction * dt;

    if (this.direction > 0 && this.x > canvasWidth + this.width) this.active = false;
    if (this.direction < 0 && this.x + this.width < 0) this.active = false;
  }
  startFloating() {
    this.floating = true;
    this.floatTime = PLATFORM_FLOAT_TIME;
    this.speed = 0;
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    let color = (this.originalSpeed >= PLATFORM_SPEED_THRESHOLD) ? '#ff6b35' : '#4ecdc4';
    if (this.floating) color = '#9b59b6';
    ctx.fillStyle = color;
    ctx.fillRect(this.x, this.y - PLATFORM_THICKNESS / 2 - cameraY, this.width, PLATFORM_THICKNESS);
  }
  getRect() {
    return { x: this.x, y: this.y - PLATFORM_THICKNESS / 2, w: this.width, h: PLATFORM_THICKNESS };
  }
}

/**
 * SegmentedGatePlatform
 * - Creates 1–3 horizontal segments spanning the canvas width, linked by vertical connectors.
 * - A single "gap" (gate opening) is carved into either a horizontal segment OR a vertical connector.
 * - Fully static (no motion), plays nicely with sprite collision using getRects().
 */
export class SegmentedGatePlatform {
  constructor(y, canvasW, gapW, segmentCount) {
    this.y = y;
    this.canvasWidth = canvasW;
    this.gapW = gapW;
    this.segmentCount = Math.max(1, Math.min(3, Math.floor(segmentCount || 1)));
    this.active = true;
    this.floating = false;
    this.speed = 0;
    this.direction = 0;
    this.originalSpeed = 0;

    this._generateLayout();
    this._chooseGap();
  }

  update() {}
  startFloating() {}

  /**
   * Build a staircase-like polyline across the screen using segmentCount
   * horizontal spans separated by vertical risers.
   */
  _generateLayout() {
    const thickness = PLATFORM_THICKNESS;
    const minHSpan = 60; // minimum width of a horizontal segment
    const totalHSpan = this.canvasWidth;

    // Randomly split the canvas width into N horizontal spans
    const N = this.segmentCount;
    const remaining = totalHSpan - N * minHSpan;
    const cuts = [];
    for (let i = 0; i < N - 1; i++) cuts.push(Math.random());
    cuts.sort((a, b) => a - b);

    const shares = [cuts[0], ...cuts.slice(1).map((v, i) => v - cuts[i]), 1 - cuts[cuts.length - 1]];
    const extraSpans = shares.map(s => s * remaining);

    this.hSegs = [];
    for (let i = 0; i < N; i++) {
      this.hSegs.push(minHSpan + extraSpans[i]);
    }

    // Vertical offsets between segments: alternate up/down (randomly choose direction)
    this.vOffsets = []; // length N-1
    const baseMag = 20; // min
    const extraMag = 80; // additional 0-80
    let dir = Math.random() > 0.5 ? 1 : -1;
    for (let i = 0; i < N - 1; i++) {
      const mag = baseMag + Math.random() * extraMag;
      this.vOffsets.push(dir * mag);
      dir *= -1; // alternate
    }

    // Build rects for horizontals + vertical connectors
    // Horizontal segments accumulate from x=0 to canvasWidth
    this.rects = [];
    let cursorX = 0;
    let currentY = this.y;

    for (let i = 0; i < N; i++) {
      const w = this.hSegs[i];
      const hRect = { type: 'H', index: i, x: cursorX, y: currentY - thickness / 2, w: w, h: thickness };
      this.rects.push(hRect);

      // Vertical connector (except after last)
      if (i < N - 1) {
        const nextY = currentY + this.vOffsets[i];
        const top = Math.min(currentY, nextY) - thickness / 2;
        const vRect = {
          type: 'V',
          index: i, // connector after segment i
          x: cursorX + w - thickness / 2,
          y: top,
          w: thickness,
          h: Math.abs(nextY - currentY) + thickness
        };
        this.rects.push(vRect);
        currentY = nextY; // advance Y
      }

      cursorX += w; // advance X
    }
  }

  /**
   * Choose where the gap goes: any horizontal segment OR vertical connector.
   * For horizontal: carve out gap along X direction.
   * For vertical: carve out gap along Y direction (same gapW length).
   */
  _chooseGap() {
    // Pick one rect at random to hold the gap
    const candidates = this.rects.filter(r => (r.type === 'H' && r.w > this.gapW + 10) || (r.type === 'V' && r.h > this.gapW + 10));
    const target = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : this.rects[0];

    this.gapInfo = { type: target.type, index: target.index };

    if (target.type === 'H') {
      // Gap along horizontal span
      const minX = target.x + 5;
      const maxX = target.x + target.w - this.gapW - 5;
      this.gapX = Math.max(minX, Math.min(maxX, minX + Math.random() * (maxX - minX)));
      this.gapY = target.y; // for drawing markers
    } else {
      // Gap along vertical connector
      const minY = target.y + 5;
      const maxY = target.y + target.h - this.gapW - 5;
      this.gapY = Math.max(minY, Math.min(maxY, minY + Math.random() * (maxY - minY)));
      this.gapX = target.x; // for drawing markers
    }
  }

  /**
   * Returns collision rectangles with the gap carved out.
   */
  getRects() {
    const out = [];
    const thickness = PLATFORM_THICKNESS;

    for (const r of this.rects) {
      if (this.gapInfo && r.type === this.gapInfo.type && r.index === this.gapInfo.index) {
        if (r.type === 'H') {
          // Split horizontal rect around [gapX, gapX + gapW]
          const leftW = Math.max(0, this.gapX - r.x);
          const rightW = Math.max(0, (r.x + r.w) - (this.gapX + this.gapW));
          if (leftW > 0) out.push({ x: r.x, y: r.y, w: leftW, h: r.h });
          if (rightW > 0) out.push({ x: this.gapX + this.gapW, y: r.y, w: rightW, h: r.h });
        } else {
          // Split vertical rect around [gapY, gapY + gapW]
          const topH = Math.max(0, this.gapY - r.y);
          const bottomH = Math.max(0, (r.y + r.h) - (this.gapY + this.gapW));
          if (topH > 0) out.push({ x: r.x, y: r.y, w: r.w, h: topH });
          if (bottomH > 0) out.push({ x: r.x, y: this.gapY + this.gapW, w: r.w, h: bottomH });
        }
      } else {
        out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
    return out;
  }

  draw(ctx, cameraY) {
    if (!this.active) return;

    // Platform color
    ctx.fillStyle = '#5aa2ff';
    const rects = this.getRects();

    for (const rect of rects) {
      if (rect.w > 0 && rect.h > 0) {
        ctx.fillRect(rect.x, rect.y - cameraY, rect.w, rect.h);
      }
    }

    // Gap indicators
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    if (this.gapInfo?.type === 'H') {
      // draw thin vertical marks at gap edges
      const gY = this.gapY;
      ctx.fillRect(this.gapX, gY - cameraY, 1, PLATFORM_THICKNESS);
      ctx.fillRect(this.gapX + this.gapW, gY - cameraY, 1, PLATFORM_THICKNESS);
    } else if (this.gapInfo?.type === 'V') {
      // draw thin horizontal marks at gap edges
      const gX = this.gapX;
      ctx.fillRect(gX, this.gapY - cameraY, PLATFORM_THICKNESS, 1);
      ctx.fillRect(gX, this.gapY + this.gapW - cameraY, PLATFORM_THICKNESS, 1);
    }
  }
}
