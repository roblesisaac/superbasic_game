import { PIXELS_PER_FOOT } from '../../../config/constants.js';
import { ctx, canvasWidth, groundY } from '../state/rendering_state.js';
import { gameWorld } from '../state/game_state.js';
import { drawSettingsIcon } from '../../gui/settings_overlay.js';
import { getCurrentCard } from './card_controller.js';
import { getWellState } from '../../game_objects/well.js';

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

  const well = getWellState();
  if (well.occupant.inWell) {
    const meterWidth = 118;
    const meterHeight = 10;
    const meterX = 12;
    const meterY = 46;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
    const ratio = Math.max(0, Math.min(1, well.occupant.oxygen / 30));
    if (ratio > 0.5) ctx.fillStyle = '#ffffff';
    else if (ratio > 0.25) ctx.fillStyle = '#ffe066';
    else ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(meterX, meterY, meterWidth * ratio, meterHeight);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);

    ctx.font = '9px LocalPressStart, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#eaeaea';
    ctx.fillText('OXYGEN', meterX, meterY - 2);

    const depthMeters = Math.max(0, Math.floor(well.occupant.depth / 10));
    const depthLabel = `DEPTH ${depthMeters}M`;
    const labelY = meterY + meterHeight + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(meterX - 2, labelY - 1, ctx.measureText(depthLabel).width + 4, 11);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(depthLabel, meterX, labelY);
    ctx.restore();
  }
}
