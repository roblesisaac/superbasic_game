import { PIXELS_PER_FOOT } from "../../config/constants.js";
import {
  ctx,
  canvasWidth,
  canvasHeight,
  groundY,
} from "../state/rendering_state.js";
import { gameWorld } from "../state/game_state.js";
import { drawSettingsIcon } from "../../../web/ui/settings_overlay.js";
import { getCurrentCard } from "./card_controller.js";

function lightenColor(hex: string, ratio = 0.5): string {
  const normalized = hex.replace("#", "");
  if (!/^([0-9a-fA-F]{6})$/.test(normalized)) return "#4CAF50";
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const blend = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * ratio));
  return `#${blend(r).toString(16).padStart(2, "0")}${blend(g)
    .toString(16)
    .padStart(2, "0")}${blend(b).toString(16).padStart(2, "0")}`;
}

function drawCurrentCardTitle(): void {
  const currentCard = getCurrentCard();
  if (!currentCard) return;

  const accentBase = currentCard.definition.theme?.bgColor ?? "#4CAF50";
  const accent = lightenColor(accentBase, 0.45);
  const totalEnemies = currentCard.definition.enemies.reduce(
    (sum, spec) => sum + Math.max(0, Math.floor(spec.count ?? 0)),
    0,
  );

  ctx.save();
  ctx.font = "14px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = accent;
  ctx.fillText(`${currentCard.definition.title}`, 12, 55);

  ctx.font = "10px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  // ctx.fillText(`Enemies queued: ${totalEnemies}`, 12, 75);
  ctx.restore();
}

export function drawHUD(): void {
  const { sprite, energyBar, hearts } = gameWorld;
  if (!sprite || !energyBar || !hearts) return;

  energyBar.draw(ctx);
  hearts.draw(ctx, gameWorld.lastTime);
  // drawCurrentCardTitle();
  drawSettingsIcon(ctx);

  const ft = Math.max(0, Math.round((groundY - sprite.y) / PIXELS_PER_FOOT));
  ctx.save();
  ctx.font = '16px "Tiny5", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#eaeaea";
  ctx.fillText(`${ft} FT`, canvasWidth / 2, 10);
  ctx.restore();

  if (sprite.inWater) {
    drawDepthAndOxygenMeters(sprite, energyBar);
  }
}

function drawDepthAndOxygenMeters(
  sprite: typeof gameWorld.sprite,
  energyBar: typeof gameWorld.energyBar,
) {
  if (!sprite || !energyBar) return;

  const depthMeters = Math.max(0, Math.round(sprite.waterDepthMeters));
  const depthLabel = "DEPTH";
  const depthText = `${depthMeters.toString().padStart(2, "0")} M`;
  const anchorX = 12;
  const depthLabelY = canvasHeight - 96;
  const depthValueY = depthLabelY + 18;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = '10px "Tiny5", sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(depthLabel, anchorX, depthLabelY);

  ctx.font = '16px "Tiny5", sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(depthText, anchorX, depthValueY);
  ctx.restore();

  const bounds = energyBar.getBounds();
  const oxygenTop = depthValueY + 26;
  drawOxygenMeter(sprite, anchorX, oxygenTop, bounds.width);
}

function drawOxygenMeter(
  sprite: typeof gameWorld.sprite,
  x: number,
  top: number,
  width: number,
) {
  const barHeight = 8;
  const ratio =
    sprite.maxOxygen > 0
      ? Math.min(Math.max(sprite.oxygen / sprite.maxOxygen, 0), 1)
      : 0;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x, top, width, barHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.strokeRect(x, top, width, barHeight);

  if (ratio > 0) {
    ctx.fillStyle = "#6fd6ff";
    ctx.fillRect(x, top, width * ratio, barHeight);
  }

  ctx.font = '9px "Tiny5", sans-serif';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("O2", x, top + barHeight + 4);
  ctx.restore();
}
