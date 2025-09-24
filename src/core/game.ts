import {
  ctx,
  canvasWidth,
  canvasHeight,
  groundY,
  gameOverDiv,
  gameOverPanel,
  game,
  cameraY,
  cameraX,
  setCameraY,
  setCameraX,
  playfieldWidth,
  drawBackgroundGrid
} from './globals.js';
import { CAM_TOP, CAM_BOTTOM, PIXELS_PER_FOOT } from '../config/constants.js';
import { now } from '../utils/utils.js';
import { updateRides, pruneInactiveRides, drawRides, mergeCollidingRides } from '../entities/rides.js';
import { updateGates, pruneInactiveGates, drawGates } from '../entities/gates.js';
import { Sprite } from '../entities/sprite.js';
import { EnergyBar, Hearts } from '../ui/hud.js';
import { InputHandler } from './input.js';
import { showSettings, drawSettingsIcon, drawSettings } from '../systems/settings.js';
import { collectibles, gameStats, resetBudgetContainers } from '../systems/budget.js';
import {
  resetEnemies,
  updateEnemies,
  drawEnemies,
  pruneInactiveEnemies
} from '../entities/enemies.js';
import {
  initializeCardStack,
  updateCardStack as updateCardSystem
} from '../systems/cards.js';
import type { CardInstance } from '../systems/cards.js';

let currentCard: CardInstance | null = null;

function syncCardStack() {
  if (!game.sprite) return;
  const frame = updateCardSystem(game.sprite.y);
  currentCard = frame.currentCard;
  game.gates = frame.gates;
}

function updateCamera() {
  if (!game.sprite) return;
  const topLine = canvasHeight * CAM_TOP;
  const bottomLine = canvasHeight * CAM_BOTTOM;
  const screenY = game.sprite.y - cameraY;
  if (screenY < topLine) setCameraY(game.sprite.y - topLine);
  else if (screenY > bottomLine) setCameraY(game.sprite.y - bottomLine);
  // keep from panning below 0
  setCameraY(Math.min(cameraY, 0));

  const currentWidth = currentCard?.playfieldWidth ?? canvasWidth;
  if (currentWidth > canvasWidth) {
    const leftLine = canvasWidth * 0.35;
    const rightLine = canvasWidth * 0.65;
    const screenX = game.sprite.x - cameraX;
    let nextCameraX = cameraX;

    if (screenX < leftLine) {
      nextCameraX = game.sprite.x - leftLine;
    } else if (screenX > rightLine) {
      nextCameraX = game.sprite.x - rightLine;
    }

    const maxOffset = Math.max(0, currentWidth - canvasWidth);
    if (nextCameraX < 0) nextCameraX = 0;
    if (nextCameraX > maxOffset) nextCameraX = maxOffset;
    setCameraX(nextCameraX);
  } else {
    setCameraX(0);
  }
}

function lightenColor(hex: string, ratio = 0.5) {
  const normalized = hex.replace('#', '');
  if (!/^([0-9a-fA-F]{6})$/.test(normalized)) return '#4CAF50';
  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const blend = (channel: number) => Math.min(255, Math.round(channel + (255 - channel) * ratio));
  return `#${blend(r).toString(16).padStart(2, '0')}${blend(g).toString(16).padStart(2, '0')}${blend(b)
    .toString(16)
    .padStart(2, '0')}`;
}

function drawCurrentCardTitle() {
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

function drawHUD() {
  game.energyBar.draw(ctx);
  game.hearts.draw(ctx);
  drawCurrentCardTitle();
  drawSettingsIcon(ctx);

  const ft = Math.max(0, Math.round((groundY - game.sprite.y) / PIXELS_PER_FOOT));
  ctx.save();
  ctx.font = '12px LocalPressStart, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#eaeaea';
  ctx.fillText(`HEIGHT: ${ft} FT`, canvasWidth / 2, 10);
  ctx.restore();
}

function updateGameOverScreen() {
  let html = '<div style="color: white; font-family: Arial; font-size: 18px;"><h2>Final Budget Report</h2>';
  let totalNet = 0;

  for (const [title, stats] of Object.entries(gameStats)) {
    const isIncome = stats.target > 0;
    const percentage = Math.round((stats.collected / Math.abs(stats.target)) * 100);
    const color = isIncome ? '#4CAF50' : '#F44336';

    html += `<div style="margin: 10px 0; color: ${color};">`;
    html += `<strong>${title}:</strong> `;

    if (isIncome) {
      html += `Collected ${stats.collected} of ${stats.target} (${percentage}%)`;
      totalNet += stats.collected;
    } else {
      html += `Avoided ${stats.target - stats.collected} of ${Math.abs(stats.target)} expenses`;
      totalNet += stats.target + stats.collected;
    }
    html += '</div>';
  }

  const netColor = totalNet >= 0 ? '#4CAF50' : '#F44336';
  html += `<div style="margin: 20px 0; font-size: 24px; color: ${netColor}; border-top: 2px solid white; padding-top: 10px;">`;
  html += `<strong>Net Result: ${totalNet.toFixed(2)}</strong>`;
  html += '</div></div>';
  html += '<button id="tryAgainBtn" style="margin-top: 20px; padding: 10px 20px; font-size: 18px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>';

  gameOverPanel.innerHTML = html;
  const newTryAgainBtn = document.getElementById('tryAgainBtn');
  newTryAgainBtn.addEventListener('click', resetGame);
}

function triggerGameOver() {
  game.running = false;
  updateGameOverScreen();
  gameOverDiv.style.display = 'flex';
}

function startGame() {
  resetBudgetContainers();
  game.energyBar = new EnergyBar();
  game.hearts = new Hearts();
  game.rides = [];
  game.gates = [];
  resetEnemies();

  const startX = canvasWidth / 2;
  const startY = groundY - 8;
  game.sprite = new Sprite(startX, startY, {
    energyBar: game.energyBar,
    hearts: game.hearts,
    onGameOver: triggerGameOver,
    getRides: () => game.rides,
    getGates: () => game.gates
  });

  setCameraY(0);
  setCameraX(0);
  const frame = initializeCardStack(game.sprite.y);
  currentCard = frame.currentCard;
  game.gates = [...frame.gates];

  game.input = new InputHandler(game, resetGame);
  game.lastTime = now();
  game.running = true;
  gameOverDiv.style.display = 'none';
  requestAnimationFrame(loop);
}

export function resetGame() {
  gameOverDiv.style.display = 'none';
  game.running = true;

  resetBudgetContainers();

  game.rides = [];
  game.gates = [];
  resetEnemies();

  game.energyBar = new EnergyBar();
  game.hearts = new Hearts();

  const startX = canvasWidth / 2;
  const startY = groundY - 8;
  game.sprite = new Sprite(startX, startY, {
    energyBar: game.energyBar,
    hearts: game.hearts,
    onGameOver: triggerGameOver,
    getRides: () => game.rides,
    getGates: () => game.gates
  });

  setCameraY(0);
  setCameraX(0);
  const frame = initializeCardStack(game.sprite.y);
  currentCard = frame.currentCard;
  game.gates = [...frame.gates];
  game.lastTime = now();
  requestAnimationFrame(loop);
}

function loop() {
  if (!game.running) { drawFrame(); return; }
  const t = now();
  const dt = Math.min(0.04, (t - game.lastTime) / 1000);
  game.lastTime = t;

  if (!showSettings) {
    game.sprite.update(dt);
    syncCardStack();

    updateRides(game.rides, dt);
    updateGates(game.gates, dt);
    updateEnemies(game, dt);
    for (const c of collectibles) c.update(dt, game, gameStats);

    for (let i = collectibles.length - 1; i >= 0; i--) {
      if (!collectibles[i].active) collectibles.splice(i, 1);
    }
    pruneInactiveEnemies();
    pruneInactiveRides(game.rides);
    pruneInactiveGates(game.gates);

    while (mergeCollidingRides(game.rides, canvasWidth)) {}

    game.energyBar.update(dt);
    updateCamera();
  }

  drawFrame();
  if (game.running) requestAnimationFrame(loop);
}

function drawFrame() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // drawBackgroundGrid();

  // ground line
  ctx.save();
  ctx.translate(-cameraX, 0);

  const groundSpan = Math.max(canvasWidth, playfieldWidth, currentCard?.playfieldWidth ?? 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, groundY - cameraY);
  ctx.lineTo(groundSpan, groundY - cameraY);
  ctx.stroke();

  drawRides(ctx, game.rides, cameraY);
  drawGates(ctx, game.gates, cameraY);
  drawEnemies(ctx, cameraY);

  for (const c of collectibles) c.draw(ctx, cameraY, canvasHeight);

  if (!showSettings && game.sprite) game.sprite.draw(ctx, cameraY);

  ctx.restore();

  drawHUD();
  drawSettings();
}

// kick off
startGame();

// Restart game when budget changed via settings
window.addEventListener('budget-changed', () => {
  resetGame();
});

// Service Worker update alert
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
      if (window.confirm('A new version is available. Reload now?')) {
        window.location.reload();
      }
    }
  });
}