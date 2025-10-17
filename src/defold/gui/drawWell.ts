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
  const shaftDepth = Math.max(1, Math.round(openingDepth));
  const shaftBottom = Math.round(rimBottomY + shaftHeight);
  const interiorWidth = Math.max(1, Math.round(openingWidth));
  const interiorHeight = Math.max(1, shaftBottom - openingTop);

  ctx.fillStyle = '#191934';
  ctx.fillRect(openingLeft, openingTop, interiorWidth, interiorHeight);

  const lipHeight = Math.min(shaftDepth, interiorHeight);
  ctx.fillStyle = '#303057';
  ctx.fillRect(openingLeft, openingTop, interiorWidth, lipHeight);

  const sideEdgeWidth = Math.max(1, Math.round(interiorWidth * 0.08));
  const shaftStartY = openingTop + lipHeight;
  const shaftBodyHeight = Math.max(0, interiorHeight - lipHeight);

  if (shaftBodyHeight > 0) {
    ctx.fillStyle = '#121228';
    ctx.fillRect(openingLeft, shaftStartY, sideEdgeWidth, shaftBodyHeight);
    ctx.fillRect(openingLeft + interiorWidth - sideEdgeWidth, shaftStartY, sideEdgeWidth, shaftBodyHeight);

    const centerWidth = Math.max(0, interiorWidth - sideEdgeWidth * 2);
    if (centerWidth > 0) {
      ctx.fillStyle = '#1f1f3f';
      ctx.fillRect(openingLeft + sideEdgeWidth, shaftStartY, centerWidth, shaftBodyHeight);

      ctx.fillStyle = '#101022';
      const bottomShadeHeight = Math.max(2, Math.round(shaftBodyHeight * 0.18));
      const clampedShadeHeight = Math.min(bottomShadeHeight, shaftBodyHeight);
      ctx.fillRect(
        openingLeft + sideEdgeWidth,
        shaftBottom - clampedShadeHeight,
        centerWidth,
        clampedShadeHeight
      );
    }
  }

  const highlightWidth = Math.max(1, Math.round(interiorWidth * 0.06));
  const minInset = Math.max(1, sideEdgeWidth);
  const maxInset = Math.floor((interiorWidth - highlightWidth) / 2);

  if (maxInset >= minInset) {
    const preferredInset = Math.max(minInset, Math.round(interiorWidth * 0.14));
    const highlightInset = Math.min(preferredInset, maxInset);
    const highlightTop = shaftStartY + 1;
    const highlightHeight = Math.max(0, shaftBottom - highlightTop - 1);

    if (highlightHeight > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(openingLeft + highlightInset, highlightTop, highlightWidth, highlightHeight);
      ctx.fillRect(
        openingLeft + interiorWidth - highlightInset - highlightWidth,
        highlightTop,
        highlightWidth,
        highlightHeight
      );
    }
  }
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
  drawShaft(
    ctx,
    normalized.x,
    rimBottom,
    normalized.openingWidth,
    normalized.openingDepth,
    normalized.shaftHeight
  );
  drawRim(ctx, normalized.x, rimTop, normalized.rimWidth, normalized.rimThickness);
}
