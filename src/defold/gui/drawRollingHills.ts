interface RollingHillsOptions {
  width: number;
  groundY: number;
  cameraY: number;
  baseOffset?: number;
  hillHeight?: number;
  baseThickness?: number;
  baseColor?: string;
  ridgeColor?: string;
}

const DEFAULTS = {
  baseOffset: 20,
  hillHeight: 58,
  baseThickness: 20,
  baseColor: '#050505',
  ridgeColor: '#050505',
} as const;

function isInView(
  baseY: number,
  hillHeight: number,
  baseThickness: number,
  canvasHeight: number
): boolean {
  const topY = baseY - hillHeight;
  const bottomY = baseY + baseThickness;
  return bottomY >= -64 && topY <= canvasHeight + 64;
}

export function drawRollingHills(
  ctx: CanvasRenderingContext2D,
  options: RollingHillsOptions
): void {
  const {
    width,
    groundY,
    cameraY,
    baseOffset = DEFAULTS.baseOffset,
    hillHeight = DEFAULTS.hillHeight,
    baseThickness = DEFAULTS.baseThickness,
    baseColor = DEFAULTS.baseColor,
    ridgeColor = DEFAULTS.ridgeColor,
  } = options;

  if (!Number.isFinite(width) || width <= 0) return;

  const canvasHeight = ctx.canvas?.height ?? 0;
  const screenGroundY = Math.round(groundY - cameraY);
  const baseY = screenGroundY - baseOffset;

  if (!Number.isFinite(baseY)) return;
  if (!isInView(baseY, hillHeight, baseThickness, canvasHeight)) return;

  const startX = -Math.max(40, width * 0.08);
  const endX = width + Math.max(40, width * 0.08);

  ctx.save();
  ctx.fillStyle = baseColor;

  ctx.beginPath();
  ctx.moveTo(startX, baseY + baseThickness);
  ctx.lineTo(startX, baseY);
  ctx.quadraticCurveTo(
    width * 0.18,
    baseY - hillHeight * 1,
    width * 0.36,
    baseY - hillHeight * 0.1
  );
  ctx.quadraticCurveTo(
    width * 0.55,
    baseY - hillHeight * 1,
    width * 0.72,
    baseY - hillHeight * 0.2
  );
  ctx.quadraticCurveTo(
    width * 1,
    baseY - hillHeight * 1,
    endX,
    baseY
  );
  ctx.lineTo(endX, baseY + baseThickness);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}
