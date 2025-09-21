import { canvasWidth, canvasHeight } from './globals.js';

export let showSettings = false;
export function toggleSettings() { showSettings = !showSettings; }
export function hideSettings() { showSettings = false; }

export function drawSettingsIcon(ctx: CanvasRenderingContext2D) {
  const iconSize = 20;
  const iconX = canvasWidth - 30;
  const iconY = 30;

  ctx.fillStyle = showSettings ? '#4CAF50' : 'rgba(255,255,255,0.7)';
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;

  ctx.beginPath(); ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(iconX, iconY, iconSize / 4, 0, Math.PI * 2); ctx.fill();
}

export function drawSettings(ctx: CanvasRenderingContext2D, budgetData: ReadonlyArray<readonly [string, number]>) {
  if (!showSettings) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const panelWidth = Math.min(400, canvasWidth - 40);
  const panelHeight = Math.min(500, canvasHeight - 40);
  const panelX = (canvasWidth - panelWidth) / 2;
  const panelY = (canvasHeight - panelHeight) / 2;

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = '#555';
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  ctx.fillStyle = '#fff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Budget Settings', panelX + panelWidth/2, panelY + 30);

  ctx.font = '12px Arial';
  ctx.fillText('Click to close and restart game', panelX + panelWidth/2, panelY + 50);

  ctx.textAlign = 'left';
  ctx.font = '10px Arial';
  let yOffset = 80;

  budgetData.forEach(([title, amount]) => {
    const color = amount > 0 ? '#4CAF50' : '#F44336';
    ctx.fillStyle = color;
    ctx.fillText(`${title}: $${amount}`, panelX + 20, panelY + yOffset);
    yOffset += 25;
  });
}