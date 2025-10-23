import { canvasWidth } from '../runtime/state/rendering_state.js';
import {
  getBudgetData,
  hideSettings,
  showSettings,
  toggleSettings
} from '../runtime/state/settings_state.js';

let overlay: HTMLDivElement | null = null;

export function drawSettingsIcon(ctx: CanvasRenderingContext2D): void {
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

export function ensureSettingsOverlay(): void {
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
  overlay.style.background = '#000';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '5';

  const panel = document.createElement('div');
  panel.style.background = '#000';
  panel.style.border = '2px solid #fff';
  panel.style.boxShadow = '0 0 24px rgba(255,255,255,0.12), inset 0 0 24px rgba(255,255,255,0.06)';
  panel.style.width = '86%';
  panel.style.maxWidth = '520px';
  panel.style.minHeight = '240px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.padding = '16px';
  panel.style.position = 'relative';
  panel.style.fontFamily = 'LocalPressStart, monospace';
  panel.style.color = '#fff';
  panel.style.letterSpacing = '0.5px';

  const scan = document.createElement('div');
  scan.style.position = 'absolute';
  scan.style.inset = '0';
  scan.style.pointerEvents = 'none';
  scan.style.backgroundImage = 'linear-gradient(rgba(0,0,0,0.15) 50%, rgba(0,0,0,0) 50%)';
  scan.style.backgroundSize = '100% 4px';
  panel.appendChild(scan);

  const title = document.createElement('h3');
  title.textContent = 'TERMINAL SETTINGS';
  title.style.color = '#fff';
  title.style.margin = '4px 0 12px 0';
  title.style.textAlign = 'center';
  title.style.textShadow = '0 0 6px rgba(255,255,255,0.25)';

  const budgetLabel = document.createElement('div');
  budgetLabel.textContent = 'BUDGET ARRAY (JSON)';
  budgetLabel.style.fontSize = '12px';
  budgetLabel.style.opacity = '0.9';
  budgetLabel.style.marginTop = '4px';

  const textarea = document.createElement('textarea');
  textarea.style.flex = '1';
  textarea.style.margin = '6px 0 0 0';
  textarea.style.minHeight = '160px';
  textarea.style.background = '#000';
  textarea.style.color = '#fff';
  textarea.style.border = '1px solid #fff';
  textarea.style.padding = '10px';
  textarea.style.fontFamily = 'monospace';
  textarea.style.fontSize = '12px';
  textarea.value = JSON.stringify(getBudgetData(), null, 2);
  const initialBudgetJSON = JSON.stringify(getBudgetData());

  const resumeButton = document.createElement('button');
  resumeButton.textContent = 'RESUME';
  resumeButton.style.margin = '8px auto 2px auto';
  resumeButton.style.padding = '10px 16px';
  resumeButton.style.fontFamily = 'LocalPressStart, monospace';
  resumeButton.style.fontSize = '12px';
  resumeButton.style.color = '#fff';
  resumeButton.style.background = 'transparent';
  resumeButton.style.border = '2px solid #fff';
  resumeButton.style.cursor = 'pointer';
  resumeButton.style.boxShadow = 'none';
  resumeButton.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(textarea.value);
      if (Array.isArray(parsed)) {
        const newJSON = JSON.stringify(parsed);
        const changed = newJSON !== initialBudgetJSON;
        const data = getBudgetData();
        data.length = 0;
        data.push(...parsed);
        if (changed) {
          try {
            window.dispatchEvent(new Event('budget-changed'));
          } catch (error) {
            console.error('Unable to dispatch budget change event', error);
          }
        }
      }
    } catch (error) {
      console.error('Invalid budget data', error);
    }
    hideSettings();
    ensureSettingsOverlay();
  });

  panel.appendChild(title);
  panel.appendChild(budgetLabel);
  panel.appendChild(textarea);
  panel.appendChild(resumeButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

export { toggleSettings, hideSettings, showSettings };
