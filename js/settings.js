import { canvasWidth } from './globals.js';
import { budgetData } from './budget.js';

export let showSettings = false;
export function toggleSettings() { showSettings = !showSettings; }
export function hideSettings() { showSettings = false; }

let overlay = null;

export function drawSettingsIcon(ctx) {
  const iconSize = 20;
  const iconX = canvasWidth - 30;
  const iconY = 30;

  ctx.fillStyle = showSettings ? '#4CAF50' : 'rgba(255,255,255,0.7)';
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(iconX, iconY, iconSize / 4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSettings(onPlay) {
  if (!showSettings) {
    if (overlay) {
      document.body.removeChild(overlay);
      overlay = null;
    }
    return;
  }

  if (overlay) return;

  overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.8)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  const panel = document.createElement('div');
  panel.style.background = '#2a2a2a';
  panel.style.border = '1px solid #555';
  panel.style.width = '80%';
  panel.style.maxWidth = '400px';
  panel.style.height = '80%';
  panel.style.maxHeight = '500px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';

  const title = document.createElement('h3');
  title.textContent = 'Budget Settings';
  title.style.color = '#fff';
  title.style.fontFamily = 'Arial';
  title.style.margin = '10px 0';
  title.style.textAlign = 'center';

  const textarea = document.createElement('textarea');
  textarea.style.flex = '1';
  textarea.style.margin = '10px';
  textarea.value = JSON.stringify(budgetData, null, 2);

  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.style.margin = '10px auto';
  playButton.style.padding = '8px 16px';
  playButton.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(textarea.value);
      if (Array.isArray(parsed)) {
        budgetData.length = 0;
        budgetData.push(...parsed);
      }
    } catch (e) {
      console.error('Invalid budget data', e);
    }
    hideSettings();
    if (typeof onPlay === 'function') onPlay();
  });

  panel.appendChild(title);
  panel.appendChild(textarea);
  panel.appendChild(playButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
