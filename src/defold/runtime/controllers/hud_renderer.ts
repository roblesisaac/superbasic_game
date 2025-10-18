import { PIXELS_PER_FOOT } from '../../../config/constants.js';
import { ctx, canvasWidth, canvasHeight, groundY } from '../state/rendering_state.js';
import { gameWorld } from '../state/game_state.js';
import { drawSettingsIcon } from '../../gui/settings_overlay.js';
import { getCurrentCard } from './card_controller.js';

function lightenColor(hex: string, ratio = 0.5): string {
  const normalized = hex.replace('#', '');
  if (!/^([0-9a-fA-F]{6})$/.test(normalized)) return '#4CAF50';
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const blend = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * ratio));
  return `#${blend(r).toString(16).padStart(2, '0')}${blend(g)
    .toString(16)
    .padStart(2, '0')}${blend(b).toString(16).padStart(2, '0')}`;
}

function drawCurrentCardTitle(): void {
  const currentCard = getCurrentCard();
  if (!currentCard) return;

  const accentBase = currentCard.definition.theme?.bgColor ?? '#4CAF50';
  const accent = lightenColor(accentBase, 0.45);
  const totalEnemies = currentCard.definition.enemies.reduce(
    (sum, spec) => sum + Math.max(0, Math.floor(spec.count ?? 0)),
    0
  );

  ctx.save();
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = accent;
  ctx.fillText(`${currentCard.definition.title}`, 12, 55);

  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  // ctx.fillText(`Enemies queued: ${totalEnemies}`, 12, 75);
  ctx.restore();
}

export function drawHUD(): void {
  const { sprite, energyBar, hearts } = gameWorld;
  if (!sprite || !energyBar || !hearts) return;

  energyBar.draw(ctx);
  drawOxygenBar(sprite, energyBar);
  hearts.draw(ctx, gameWorld.lastTime);
  // drawCurrentCardTitle();
  drawSettingsIcon(ctx);

  const ft = Math.max(0, Math.round((groundY - sprite.y) / PIXELS_PER_FOOT));
  ctx.save();
  ctx.font = '12px LocalPressStart, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#eaeaea';
  ctx.fillText(`${ft} FT`, canvasWidth / 2, 10);
  ctx.restore();

  if (sprite.inWater) {
    const depthMeters = Math.max(0, Math.round(sprite.waterDepthMeters));
    const label = 'DEPTH';
    const text = `${depthMeters.toString().padStart(2, '0')} M`;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = '10px LocalPressStart, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const baseX = 12;
    const baseY = canvasHeight - 28;
    ctx.fillText(label, baseX, baseY - 20);
    ctx.font = '16px LocalPressStart, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, baseX, baseY);
    ctx.restore();
  }
}

function drawOxygenBar(sprite: typeof gameWorld.sprite, energyBar: typeof gameWorld.energyBar) {
  if (!sprite || !energyBar) return;
  const bounds = energyBar.getBounds();
  const barPadding = 6;
  const barHeight = 8;
  const barX = bounds.x;
  const barY = bounds.y + bounds.height + barPadding;
  const ratio = sprite.maxOxygen > 0 ? Math.min(Math.max(sprite.oxygen / sprite.maxOxygen, 0), 1) : 0;
  const barWidth = bounds.width;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  if (ratio > 0) {
    ctx.fillStyle = '#6fd6ff';
    ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
  }

  ctx.font = '9px LocalPressStart, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('O2', barX + barWidth + 8, barY + barHeight);
  ctx.restore();
}
