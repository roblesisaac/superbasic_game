import { canvasWidth } from '../core/globals.js';
import { budgetData } from './budget.js';

export let showSettings = false;
export function toggleSettings() { showSettings = !showSettings; }
export function hideSettings() { showSettings = false; }

// ASCII art rendering setting (default: on)
export let asciiArtEnabled = true;
export function setAsciiArtEnabled(v) { asciiArtEnabled = !!v; }

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

export function drawSettings() {
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

  // subtle scanlines overlay
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

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '12px';
  list.style.margin = '8px 0 12px 0';

  // ASCII Art toggle row
  const asciiRow = document.createElement('div');
  asciiRow.style.display = 'flex';
  asciiRow.style.alignItems = 'center';
  asciiRow.style.justifyContent = 'space-between';
  asciiRow.style.border = '1px solid #fff';
  asciiRow.style.padding = '10px 12px';
  asciiRow.style.background = 'rgba(255,255,255,0.05)';

  const asciiLabel = document.createElement('div');
  asciiLabel.textContent = 'ASCII ART';
  asciiLabel.style.fontSize = '12px';

  const asciiToggle = document.createElement('button');
  asciiToggle.style.fontFamily = 'LocalPressStart, monospace';
  asciiToggle.style.fontSize = '12px';
  asciiToggle.style.color = '#fff';
  asciiToggle.style.background = 'transparent';
  asciiToggle.style.border = '2px solid #fff';
  asciiToggle.style.padding = '6px 10px';
  asciiToggle.style.cursor = 'pointer';
  asciiToggle.style.boxShadow = 'none';
  function updateAsciiButton() {
    asciiToggle.textContent = asciiArtEnabled ? 'ON' : 'OFF';
    asciiToggle.style.opacity = asciiArtEnabled ? '1' : '0.7';
  }
  updateAsciiButton();
  asciiToggle.addEventListener('click', () => {
    setAsciiArtEnabled(!asciiArtEnabled);
    updateAsciiButton();
  });
  asciiRow.appendChild(asciiLabel);
  asciiRow.appendChild(asciiToggle);

  list.appendChild(asciiRow);

  // Budget editor
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
  textarea.value = JSON.stringify(budgetData, null, 2);
  const initialBudgetJSON = JSON.stringify(budgetData);

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
    // Try apply edited budget JSON
    try {
      const parsed = JSON.parse(textarea.value);
      if (Array.isArray(parsed)) {
        const newJSON = JSON.stringify(parsed);
        const changed = newJSON !== initialBudgetJSON;
        budgetData.length = 0;
        budgetData.push(...parsed);
        if (changed) {
          try {
            window.dispatchEvent(new Event('budget-changed'));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Invalid budget data', e);
    }
    hideSettings();
  });

  panel.appendChild(title);
  panel.appendChild(list);
  panel.appendChild(budgetLabel);
  panel.appendChild(textarea);
  panel.appendChild(resumeButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
