import { PIXELS_PER_FOOT } from '../../../config/constants.js';
import { ctx, canvasWidth, groundY } from '../state/rendering_state.js';
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
  ctx.fillText(`CARD ${currentCard.index + 1}: ${currentCard.definition.title}`, 12, 55);

  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(`Enemies queued: ${totalEnemies}`, 12, 75);
  ctx.restore();
}

export function drawHUD(): void {
  const { sprite, energyBar, hearts } = gameWorld;
  if (!sprite || !energyBar || !hearts) return;

  energyBar.draw(ctx);
  hearts.draw(ctx);
  drawCurrentCardTitle();
  drawSettingsIcon(ctx);

  const ft = Math.max(0, Math.round((groundY - sprite.y) / PIXELS_PER_FOOT));
  ctx.save();
  ctx.font = '12px LocalPressStart, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#eaeaea';
  ctx.fillText(`HEIGHT: ${ft} FT`, canvasWidth / 2, 10);
  ctx.restore();
}
