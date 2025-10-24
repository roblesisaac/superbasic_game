interface RollingHillsOptions {
  width: number;
  groundY: number;
  cameraY: number;
  baseOffset?: number;
  hillHeight?: number;
  baseThickness?: number;
  baseColor?: string;
  pixelSize?: number;
}

const DEFAULTS = {
  baseOffset: 20,
  hillHeight: 88,
  baseThickness: 20,
  baseColor: "#050505",
  pixelSize: 4,
} as const;

type Canvas2DContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

function createPixelCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement | null {
  if (width <= 0 || height <= 0) return null;

  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  return null;
}

function isInView(
  baseY: number,
  hillHeight: number,
  baseThickness: number,
  canvasHeight: number,
): boolean {
  const topY = baseY - hillHeight;
  const bottomY = baseY + baseThickness;
  return bottomY >= -64 && topY <= canvasHeight + 64;
}

export function drawRollingHills(
  ctx: CanvasRenderingContext2D,
  options: RollingHillsOptions,
): void {
  const {
    width,
    groundY,
    cameraY,
    baseOffset = DEFAULTS.baseOffset,
    hillHeight = DEFAULTS.hillHeight,
    baseThickness = DEFAULTS.baseThickness,
    baseColor = DEFAULTS.baseColor,
    pixelSize = DEFAULTS.pixelSize,
  } = options;

  if (!Number.isFinite(width) || width <= 0) return;

  const canvasHeight = ctx.canvas?.height ?? 0;
  const screenGroundY = Math.round(groundY - cameraY);
  const baseY = screenGroundY - baseOffset;

  if (!Number.isFinite(baseY)) return;
  if (!isInView(baseY, hillHeight, baseThickness, canvasHeight)) return;

  const startX = -Math.max(40, width * 0.08);
  const endX = width + Math.max(40, width * 0.08);
  const topY = baseY - hillHeight;
  const bottomY = baseY + baseThickness;
  const normalizedPixelSize = Number.isFinite(pixelSize)
    ? Math.max(1, Math.round(pixelSize))
    : DEFAULTS.pixelSize;

  ctx.save();
  ctx.fillStyle = baseColor;

  const drawPath = (
    target: Canvas2DContext,
    mapX: (value: number) => number,
    mapY: (value: number) => number,
  ) => {
    target.beginPath();
    target.moveTo(mapX(startX), mapY(baseY + baseThickness));
    target.lineTo(mapX(startX), mapY(baseY));
    target.quadraticCurveTo(
      mapX(width * 0.18),
      mapY(baseY - hillHeight * 1),
      mapX(width * 0.36),
      mapY(baseY - hillHeight * 0.1),
    );
    target.quadraticCurveTo(
      mapX(width * 0.55),
      mapY(baseY - hillHeight * 1),
      mapX(width * 0.82),
      mapY(baseY - hillHeight * 0.2),
    );
    target.quadraticCurveTo(
      mapX(width * 1),
      mapY(baseY - hillHeight * 1),
      mapX(endX),
      mapY(baseY),
    );
    target.lineTo(mapX(endX), mapY(baseY + baseThickness));
    target.closePath();
  };

  if (normalizedPixelSize > 1) {
    const alignedStartX =
      Math.floor(startX / normalizedPixelSize) * normalizedPixelSize;
    const alignedEndX =
      Math.ceil(endX / normalizedPixelSize) * normalizedPixelSize;
    const alignedTopY =
      Math.floor(topY / normalizedPixelSize) * normalizedPixelSize;
    const alignedBottomY =
      Math.ceil(bottomY / normalizedPixelSize) * normalizedPixelSize;

    const widthSpan = alignedEndX - alignedStartX;
    const heightSpan = alignedBottomY - alignedTopY;

    if (widthSpan > 0 && heightSpan > 0) {
      const offscreenWidth = Math.max(
        1,
        Math.ceil(widthSpan / normalizedPixelSize),
      );
      const offscreenHeight = Math.max(
        1,
        Math.ceil(heightSpan / normalizedPixelSize),
      );
      const canvas = createPixelCanvas(offscreenWidth, offscreenHeight);
      const offscreenCtx =
        canvas && "getContext" in canvas
          ? (canvas.getContext("2d") as Canvas2DContext | null)
          : null;

      if (offscreenCtx) {
        // Downsample curve into a coarse buffer for a blocky silhouette.
        offscreenCtx.imageSmoothingEnabled = false;
        offscreenCtx.fillStyle = baseColor;
        drawPath(
          offscreenCtx,
          (value) => (value - alignedStartX) / normalizedPixelSize,
          (value) => (value - alignedTopY) / normalizedPixelSize,
        );
        offscreenCtx.fill();

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          canvas as unknown as CanvasImageSource,
          alignedStartX,
          alignedTopY,
          offscreenWidth * normalizedPixelSize,
          offscreenHeight * normalizedPixelSize,
        );
      } else {
        drawPath(
          ctx,
          (value) => value,
          (value) => value,
        );
        ctx.fill();
      }
    } else {
      drawPath(
        ctx,
        (value) => value,
        (value) => value,
      );
      ctx.fill();
    }
  } else {
    drawPath(
      ctx,
      (value) => value,
      (value) => value,
    );
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
