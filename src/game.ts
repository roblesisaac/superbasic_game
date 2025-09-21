import {
  ctx,
  canvasWidth,
  canvasHeight,
  groundY,
  gameOverDiv,
  gameOverPanel,
  game,
  cameraY,
  setCameraY,
  drawBackgroundGrid
} from './globals.js';
import {
  CAM_TOP, CAM_BOTTOM, PIXELS_PER_FOOT
} from './constants.js';
import { now } from './utils.js';
import { updateRides, pruneInactiveRides, drawRides, mergeCollidingRides } from './rides.js';
import { updateGates, pruneInactiveGates, drawGates } from './gates.js';
import { Sprite } from './sprite.js';
import { EnergyBar, Hearts } from './hud.js';
import { InputHandler } from './input.js';
import { showSettings, drawSettingsIcon, drawSettings, hideSettings } from './settings.js';
import {
  budgetSections, collectibles, gameStats,
  calculateBudgetSections, preloadSectionCollectibles,
  resetBudgetContainers,
  getSectionIndexForY
} from './budget.js';
import { sectionManager } from './sections.js';
import {
  resetEnemies,
  updateEnemies,
  drawEnemies,
  pruneInactiveEnemies,
  spawnEnemiesForGate
} from './enemies.js';

function ensurePreloadedCollectibles() {
  if (!game.sprite) return;
  const currentIndex = sectionManager.getSectionIndexForY(game.sprite.y, groundY);
  const startIndex = currentIndex === -1 ? 0 : currentIndex;
  for (let i = 0; i < 3; i++) preloadSectionCollectibles(startIndex + i);
}

function ensureGatesForCurrentHeight() {
  if (!game.sprite) return;

  const { newlyActivated } = sectionManager.ensureActiveSections({
    spriteY: game.sprite.y,
    groundY,
    canvasWidth,
  });

  game.gates = sectionManager.getActiveGates();

  for (const section of newlyActivated) {
    preloadSectionCollectibles(section.index);
    for (const gate of section.gates) {
      spawnGateEnemies(gate);
    }
  }
}

function spawnGateEnemies(gate) {
  if (!gate) return;

  const sectionIndex = getSectionIndexForY(gate.y);
  if (sectionIndex === -1) return;

  preloadSectionCollectibles(sectionIndex);
  const section = budgetSections[sectionIndex];
  if (!section || section.amount >= 0) return;

  const pending = section.pendingEnemies || 0;
  if (pending <= 0) return;

  const spawned = spawnEnemiesForGate(gate, {
    count: pending,
    title: section.title,
    value: section.amount,
    sectionIndex
  });

  if (spawned > 0) {
    section.spawned += spawned;
    section.pendingEnemies = Math.max(0, (section.pendingEnemies || 0) - spawned);
  }
}

function updateCamera() {
  const topLine = canvasHeight * CAM_TOP;
  const bottomLine = canvasHeight * CAM_BOTTOM;
  const screenY = game.sprite.y - cameraY;
  if (screenY < topLine) setCameraY(game.sprite.y - topLine);
  else if (screenY > bottomLine) setCameraY(game.sprite.y - bottomLine);
  // keep from panning below 0
  setCameraY(Math.min(cameraY, 0));
}

function drawCurrentSectionTitle() {
  const currentFeet = Math.max(0, Math.floor((groundY - game.sprite.y) / PIXELS_PER_FOOT));
  const section = budgetSections.find(s => currentFeet >= s.startFeet && currentFeet < s.endFeet);
  if (!section) return;

  ctx.save();
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = section.amount > 0 ? '#4CAF50' : '#F44336';
  ctx.fillText(`${section.title}: ${section.amount}`, 12, 55);

  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`Items in section: ${section.itemCount}`, 12, 75);
  ctx.restore();
}

function drawHUD() {
  game.energyBar.draw(ctx);
  game.hearts.draw(ctx);
  drawCurrentSectionTitle();
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
  calculateBudgetSections();
  game.energyBar = new EnergyBar();
  game.hearts = new Hearts();
  game.rides = [];
  game.gates = [];
  resetEnemies();
  sectionManager.reset();

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
  ensureGatesForCurrentHeight();
  ensurePreloadedCollectibles();

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
  calculateBudgetSections();

  game.rides = [];
  game.gates = [];
  resetEnemies();
  sectionManager.reset();

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
  ensureGatesForCurrentHeight();
  ensurePreloadedCollectibles();
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
    ensureGatesForCurrentHeight();
    ensurePreloadedCollectibles();

    updateRides(game.rides, dt);
    updateGates(game.gates, dt);
    updateEnemies(game, dt, gameStats);
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
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, groundY - cameraY);
  ctx.lineTo(canvasWidth, groundY - cameraY);
  ctx.stroke();

  drawRides(ctx, game.rides, cameraY);
  drawGates(ctx, game.gates, cameraY);
  drawEnemies(ctx, cameraY);

  for (const c of collectibles) c.draw(ctx, cameraY, canvasHeight);

  if (!showSettings) game.sprite.draw(ctx, cameraY);

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