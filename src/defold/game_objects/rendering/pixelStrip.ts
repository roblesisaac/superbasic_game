export type PixelStripOrientation = "horizontal" | "vertical";

export interface PixelStripStyle {
  dotSize: number;
  spacing: number;
}

export interface PixelGlowStyle {
  multiplier: number;
  min: number;
  damagedMin?: number;
}

export interface PixelStripDrawOptions {
  ctx: CanvasRenderingContext2D;
  startX: number;
  startY: number;
  length: number;
  thickness: number;
  orientation: PixelStripOrientation;
  style?: Partial<PixelStripStyle>;
}

export interface PixelStripGlowOptions {
  damaged?: boolean;
  glow?: Partial<PixelGlowStyle>;
}

export interface PixelCircleDrawOptions {
  ctx: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  radius: number;
  lineWidth: number;
  startAngle?: number;
  endAngle?: number;
}

export interface PixelCircleDotsOptions {
  ctx: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  radius: number;
  dotSize: number;
  numDots: number;
  startAngle?: number;
  endAngle?: number;
  rotationOffset?: number;
}

export const PIXEL_STRIP_STYLE: PixelStripStyle = {
  dotSize: 3,
  spacing: 1,
};

export const PIXEL_GLOW_STYLE: PixelGlowStyle = {
  multiplier: 3,
  min: 12,
  damagedMin: 18,
};

const resolveStyle = (style?: Partial<PixelStripStyle>): PixelStripStyle => ({
  ...PIXEL_STRIP_STYLE,
  ...(style ?? {}),
});

const resolveGlowStyle = (
  glow?: Partial<PixelGlowStyle>,
): PixelGlowStyle => ({
  ...PIXEL_GLOW_STYLE,
  ...(glow ?? {}),
});

export function drawPixelStripDots({
  ctx,
  startX,
  startY,
  length,
  thickness,
  orientation,
  style,
}: PixelStripDrawOptions) {
  if (length <= 0 || thickness <= 0) return;

  const resolvedStyle = resolveStyle(style);
  const pixelSize = Math.max(
    1,
    Math.min(thickness, Math.round(resolvedStyle.dotSize)),
  );
  const spacingOffset = Math.max(1, Math.round(resolvedStyle.spacing));
  const step = Math.max(1, pixelSize + spacingOffset);

  if (orientation === "horizontal") {
    const start = Math.round(startX);
    const end = Math.round(startX + length);
    const rowY = Math.round(startY + thickness / 2 - pixelSize / 2);

    for (let px = start; px < end; px += step) {
      const remaining = end - px;
      const drawWidth = Math.min(pixelSize, remaining);
      if (drawWidth <= 0) break;
      ctx.fillRect(px, rowY, drawWidth, pixelSize);
    }
    return;
  }

  const start = Math.round(startY);
  const end = Math.round(startY + length);
  const columnX = Math.round(startX + thickness / 2 - pixelSize / 2);

  for (let py = start; py < end; py += step) {
    const remaining = end - py;
    const drawHeight = Math.min(pixelSize, remaining);
    if (drawHeight <= 0) break;
    ctx.fillRect(columnX, py, pixelSize, drawHeight);
  }
}

export function computePixelStripGlow(
  thickness: number,
  options?: PixelStripGlowOptions,
) {
  const resolvedGlow = resolveGlowStyle(options?.glow);
  const minBlur = options?.damaged
    ? Math.max(resolvedGlow.min, resolvedGlow.damagedMin ?? resolvedGlow.min)
    : resolvedGlow.min;
  return Math.max(thickness * resolvedGlow.multiplier, minBlur);
}

/**
 * Draw a circular arc with consistent pixel styling
 */
export function drawPixelCircleArc({
  ctx,
  centerX,
  centerY,
  radius,
  lineWidth,
  startAngle = 0,
  endAngle = Math.PI * 2,
}: PixelCircleDrawOptions) {
  if (radius <= 0 || lineWidth <= 0) return;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Draw pixel dots around a circle or circular arc
 */
export function drawPixelCircleDots({
  ctx,
  centerX,
  centerY,
  radius,
  dotSize,
  numDots,
  startAngle = 0,
  endAngle = Math.PI * 2,
  rotationOffset = 0,
}: PixelCircleDotsOptions) {
  if (radius <= 0 || dotSize <= 0 || numDots <= 0) return;

  const angleRange = endAngle - startAngle;
  const isFullCircle = Math.abs(angleRange - Math.PI * 2) < 0.01;

  // For full circles, render exactly numDots
  // For partial arcs, calculate proportional number of dots
  const completionRatio = angleRange / (Math.PI * 2);
  const dotsToRender = isFullCircle
    ? numDots
    : Math.max(1, Math.floor(numDots * completionRatio) + 1);

  for (let i = 0; i < dotsToRender; i++) {
    // For full circles, space dots evenly around the circle
    // For partial arcs, space dots evenly along the arc
    const t = isFullCircle ? i / numDots : i / (dotsToRender - 1);
    const angle = startAngle + t * angleRange + rotationOffset;
    const dotX = Math.round(centerX + Math.cos(angle) * radius);
    const dotY = Math.round(centerY + Math.sin(angle) * radius);
    const roundedSize = Math.round(dotSize);
    ctx.fillRect(
      dotX - Math.floor(roundedSize / 2),
      dotY - Math.floor(roundedSize / 2),
      roundedSize,
      roundedSize
    );
  }
}
