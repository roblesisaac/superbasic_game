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
import { CAM_TOP, CAM_BOTTOM, PIXELS_PER_FOOT } from '../config/constants.js';
import { now } from '../utils/utils.js';
import { updateRides, pruneInactiveRides, drawRides, mergeCollidingRides } from '../entities/rides.js';
import { updateGates, pruneInactiveGates, drawGates } from '../entities/gates.js';
import { Sprite } from '../entities/sprite.js';
import { EnergyBar, Hearts } from '../ui/hud.js';
import { InputHandler } from './input.js';
import { showSettings, drawSettingsIcon, drawSettings } from '../systems/settings.js';
import { initializeCardStack, updateCardWindow, type ActiveCard } from '../systems/cards.js';
import {
  resetEnemies,
  updateEnemies,
  drawEnemies,
  pruneInactiveEnemies,
  spawnEnemiesForGate
} from '../entities/enemies.js';

let currentCard: ActiveCard | null = null;
let cardsCleared = 0;
let maxCardOrder = 0;

function spawnCardEnemies(card: ActiveCard | null) {
  if (!card || card.hasSpawnedEnemies) return;
  const gate = card.gates.top;
  if (!gate) {
    card.hasSpawnedEnemies = true;
    return;
  }

  const planned = card.definition.enemies.reduce((sum, enemy) => {
    const count = Number.isFinite(enemy.count) ? enemy.count : 0;
    return sum + Math.max(0, Math.min(5, Math.round(count)));
  }, 0);

  const count = Math.max(0, Math.min(5, planned));
  if (count <= 0) {
    card.hasSpawnedEnemies = true;
    return;
  }

  spawnEnemiesForGate(gate, count);
  card.hasSpawnedEnemies = true;
}

function setupCardStack() {
  cardsCleared = 0;
  maxCardOrder = 0;
  const cards = initializeCardStack({
    canvasWidth,
    canvasHeight,
    groundY,
  });

  currentCard = cards[0] ?? null;

  for (const card of cards) {
    if (card.gates.top) game.gates.push(card.gates.top);
    spawnCardEnemies(card);
    maxCardOrder = Math.max(maxCardOrder, card.order);
  }
}

function syncCardStack() {
  if (!game.sprite) return;

  const { added, removed, currentCard: active } = updateCardWindow(game.sprite.y, {
    canvasWidth,
    canvasHeight,
  });

  for (const card of removed) {
    if (card.gates.top) card.gates.top.active = false;
    cardsCleared += 1;
  }

  for (const card of added) {
    if (card.gates.top) game.gates.push(card.gates.top);
    spawnCardEnemies(card);
    maxCardOrder = Math.max(maxCardOrder, card.order);
  }

  if (active) {
    currentCard = active;
    maxCardOrder = Math.max(maxCardOrder, active.order);
    spawnCardEnemies(active);
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

function drawCurrentCardInfo() {
  if (!currentCard) return;

  const enemyTotal = currentCard.definition.enemies.reduce((sum, enemy) => {
    const count = Number.isFinite(enemy.count) ? enemy.count : 0;
    return sum + Math.max(0, Math.round(count));
  }, 0);

  const label = currentCard.isProcedural ? 'Procedural' : 'Deck Card';

  ctx.save();
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = currentCard.isProcedural ? '#5aa2ff' : '#4CAF50';
  ctx.fillText(`CARD ${currentCard.order + 1}: ${currentCard.definition.title}`, 12, 55);

  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(
    `Enemies: ${Math.max(0, enemyTotal)}  |  Cleared: ${cardsCleared}  |  ${label}`,
    12,
    75
  );
  ctx.restore();
}

function drawHUD() {
  game.energyBar.draw(ctx);
  game.hearts.draw(ctx);
  drawCurrentCardInfo();
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
  const ft = Math.max(0, Math.round((groundY - (game.sprite?.y ?? groundY)) / PIXELS_PER_FOOT));
  const highestCardReached = Math.max(0, maxCardOrder + 1);
  const lastCardTitle = currentCard?.definition.title ?? 'Unknown Sector';

  let html = '<div style="color: white; font-family: Arial; font-size: 18px;">';
  html += '<h2>Flight Report</h2>';
  html += `<div style="margin: 10px 0;">Cards cleared: <strong>${cardsCleared}</strong></div>`;
  html += `<div style="margin: 10px 0;">Highest card reached: <strong>${highestCardReached}</strong></div>`;
  html += `<div style="margin: 10px 0;">Final card: <strong>${lastCardTitle}</strong></div>`;
  html += `<div style="margin: 20px 0; font-size: 24px; color: #5aa2ff; border-top: 2px solid white; padding-top: 10px;">`;
  html += `<strong>Peak Height: ${ft} FT</strong>`;
  html += '</div>';
  html += '<button id="tryAgainBtn" style="margin-top: 20px; padding: 10px 20px; font-size: 18px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>';
  html += '</div>';

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
  currentCard = null;
  setupCardStack();

  game.input = new InputHandler(game, resetGame);
  game.lastTime = now();
  game.running = true;
  gameOverDiv.style.display = 'none';
  requestAnimationFrame(loop);
}

export function resetGame() {
  gameOverDiv.style.display = 'none';
  game.running = true;

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
  currentCard = null;
  setupCardStack();
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

  if (!showSettings) game.sprite.draw(ctx, cameraY);

  drawHUD();
  drawSettings();
}

// kick off
startGame();

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