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

const resolveGlowStyle = (glow?: Partial<PixelGlowStyle>): PixelGlowStyle => ({
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
