interface DrawWellOptions {
  x: number;
  groundY: number;
  cameraY: number;
  scale?: number;
  rimWidth?: number;
  rimThickness?: number;
  openingWidth?: number;
  openingDepth?: number;
  shaftHeight?: number;
}

type DrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const DEFAULT_WELL: Required<Omit<DrawWellOptions, 'x' | 'groundY' | 'cameraY'>> = {
  scale: 1,
  rimWidth: 60,
  rimThickness: 6,
  openingWidth: 36,
  openingDepth: 6,
  shaftHeight: 64
};

function getNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeOptions(options: DrawWellOptions): Required<DrawWellOptions> {
  const scale = Math.max(0.5, getNumber(options.scale, DEFAULT_WELL.scale));
  const rimWidth = Math.max(24, getNumber(options.rimWidth, DEFAULT_WELL.rimWidth) * scale);
  const rimThickness = Math.max(4, getNumber(options.rimThickness, DEFAULT_WELL.rimThickness) * scale);
  const openingWidth = Math.max(16, getNumber(options.openingWidth, DEFAULT_WELL.openingWidth) * scale);
  const openingDepth = Math.max(4, getNumber(options.openingDepth, DEFAULT_WELL.openingDepth) * scale);
  const shaftHeight = Math.max(24, getNumber(options.shaftHeight, DEFAULT_WELL.shaftHeight) * scale);

  return {
    x: options.x,
    groundY: options.groundY,
    cameraY: options.cameraY,
    scale,
    rimWidth,
    rimThickness,
    openingWidth,
    openingDepth,
    shaftHeight
  };
}

function drawRim(ctx: DrawContext, x: number, topY: number, rimWidth: number, rimThickness: number): void {
  const rimLeft = Math.round(x - rimWidth / 2);
  const rimTop = Math.round(topY);
  const rimHeight = Math.round(rimThickness);

  ctx.fillStyle = '#8b7d6b';
  ctx.fillRect(rimLeft, rimTop, Math.round(rimWidth), rimHeight);

  ctx.fillStyle = '#a69782';
  ctx.fillRect(rimLeft + 1, rimTop + 1, Math.max(0, Math.round(rimWidth) - 2), Math.max(0, rimHeight - 2));
}

function drawShaft(
  ctx: DrawContext,
  x: number,
  rimBottomY: number,
  openingWidth: number,
  openingDepth: number,
  shaftHeight: number
): void {
  const openingLeft = Math.round(x - openingWidth / 2);
  const openingTop = Math.round(rimBottomY);
  const shaftDepth = Math.round(openingDepth);
  const shaftBottom = Math.round(rimBottomY + shaftHeight);

  ctx.fillStyle = '#21213d';
  ctx.fillRect(openingLeft, openingTop, Math.round(openingWidth), shaftBottom - openingTop);

  const sideInset = Math.max(1, Math.round(openingWidth * 0.04));
  const sideWidth = Math.max(1, Math.round(openingWidth * 0.08));
  const sideHeight = Math.max(0, shaftBottom - openingTop - 4);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(openingLeft + sideInset, openingTop + 2, sideWidth, sideHeight);
  ctx.fillRect(openingLeft + openingWidth - sideInset - sideWidth, openingTop + 2, sideWidth, sideHeight);

  ctx.fillStyle = '#35355d';
  ctx.fillRect(openingLeft, openingTop, Math.round(openingWidth), shaftDepth);
}

function drawSupport(ctx: DrawContext, x: number, groundY: number, rimWidth: number, shaftHeight: number): void {
  const legHeight = Math.round(shaftHeight * 0.6);
  const legWidth = 4;
  const legOffset = Math.round(rimWidth / 2 - legWidth);
  const baseY = Math.round(groundY - legHeight);

  ctx.fillStyle = '#56483a';
  ctx.fillRect(Math.round(x - legOffset - legWidth), baseY, legWidth, legHeight);
  ctx.fillRect(Math.round(x + legOffset), baseY, legWidth, legHeight);
}

export function drawWell(ctx: DrawContext, options: DrawWellOptions): void {
  const normalized = normalizeOptions(options);
  const screenGroundY = Math.round(normalized.groundY - normalized.cameraY);
  const rimTop = Math.round(
    screenGroundY - normalized.shaftHeight - normalized.openingDepth - normalized.rimThickness
  );
  const rimBottom = rimTop + normalized.rimThickness;

  drawSupport(ctx, normalized.x, screenGroundY, normalized.rimWidth, normalized.shaftHeight);
  drawRim(ctx, normalized.x, rimTop, normalized.rimWidth, normalized.rimThickness);
  drawShaft(
    ctx,
    normalized.x,
    rimBottom,
    normalized.openingWidth,
    normalized.openingDepth,
    normalized.shaftHeight
  );
}
