import { canvasWidth } from './globals.js';
import { budgetData } from './budget.js';

export let showSettings = false;
export function toggleSettings() { showSettings = !showSettings; }
export function hideSettings() { showSettings = false; }

let overlay = null;

let joystickEnabled = true;
export function isJoystickEnabled() { return joystickEnabled; }
export function setJoystickEnabled(value) {
  joystickEnabled = Boolean(value);
}

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

function createJoystickToggle(onChange) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'space-between';
  container.style.margin = '10px';
  container.style.padding = '8px 12px';
  container.style.border = '2px solid #fff';
  container.style.background = '#000';

  const label = document.createElement('span');
  label.textContent = 'Joystick Spawn';
  label.style.fontFamily = 'LocalPressStart, monospace';
  label.style.fontSize = '10px';
  label.style.letterSpacing = '1px';
  label.style.color = '#fff';

  const toggle = document.createElement('button');
  toggle.textContent = joystickEnabled ? 'ON' : 'OFF';
  toggle.style.fontFamily = 'LocalPressStart, monospace';
  toggle.style.fontSize = '10px';
  toggle.style.padding = '6px 12px';
  toggle.style.border = '2px solid #fff';
  toggle.style.background = joystickEnabled ? '#1a1a1a' : '#000';
  toggle.style.color = '#fff';
  toggle.style.cursor = 'pointer';

  toggle.addEventListener('click', () => {
    joystickEnabled = !joystickEnabled;
    toggle.textContent = joystickEnabled ? 'ON' : 'OFF';
    toggle.style.background = joystickEnabled ? '#1a1a1a' : '#000';
    if (typeof onChange === 'function') onChange(joystickEnabled);
  });

  container.appendChild(label);
  container.appendChild(toggle);
  return container;
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
  overlay.style.background = 'rgba(0,0,0,0.88)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';

  const panel = document.createElement('div');
  panel.style.background = '#000';
  panel.style.border = '3px solid #fff';
  panel.style.width = '80%';
  panel.style.maxWidth = '420px';
  panel.style.height = '80%';
  panel.style.maxHeight = '520px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.boxShadow = '0 0 18px rgba(255,255,255,0.15)';

  const title = document.createElement('h3');
  title.textContent = 'Budget Settings';
  title.style.color = '#fff';
  title.style.fontFamily = 'LocalPressStart, monospace';
  title.style.fontSize = '12px';
  title.style.letterSpacing = '1px';
  title.style.margin = '12px 0 4px';
  title.style.textAlign = 'center';

  const joystickRow = createJoystickToggle();

  const textareaLabel = document.createElement('span');
  textareaLabel.textContent = 'Budget JSON';
  textareaLabel.style.fontFamily = 'LocalPressStart, monospace';
  textareaLabel.style.fontSize = '10px';
  textareaLabel.style.color = '#fff';
  textareaLabel.style.margin = '0 10px';

  const textarea = document.createElement('textarea');
  textarea.style.flex = '1';
  textarea.style.margin = '10px';
  textarea.style.padding = '10px';
  textarea.style.background = '#050505';
  textarea.style.color = '#fff';
  textarea.style.border = '2px solid #fff';
  textarea.style.fontFamily = 'LocalPressStart, monospace';
  textarea.style.fontSize = '10px';
  textarea.style.lineHeight = '1.4';
  textarea.value = JSON.stringify(budgetData, null, 2);

  const playButton = document.createElement('button');
  playButton.textContent = 'PLAY';
  playButton.style.margin = '12px auto 16px';
  playButton.style.padding = '10px 18px';
  playButton.style.border = '3px solid #fff';
  playButton.style.background = '#000';
  playButton.style.color = '#fff';
  playButton.style.fontFamily = 'LocalPressStart, monospace';
  playButton.style.fontSize = '12px';
  playButton.style.cursor = 'pointer';
  playButton.style.textTransform = 'uppercase';

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
  panel.appendChild(joystickRow);
  panel.appendChild(textareaLabel);
  panel.appendChild(textarea);
  panel.appendChild(playButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
