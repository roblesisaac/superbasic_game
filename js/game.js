import { ctx, canvas, canvasWidth, canvasHeight, groundY, gameOverDiv, gameOverPanel, game, cameraY, setCameraY, drawBackgroundGrid, resize } from './globals.js';
import {
  CAM_TOP, CAM_BOTTOM, PIXELS_PER_FOOT, GATE_EVERY_FEET, GATE_GAP_WIDTH
} from './constants.js';
import { clamp, now, rectsIntersect } from './utils.js';
import { Platform, SegmentedGatePlatform } from './platforms.js';
import { Sprite } from './sprite.js';
import { EnergyBar, Hearts } from './hud.js';
import { InputHandler } from './input.js';
import { showSettings, drawSettingsIcon, drawSettings, hideSettings } from './settings.js';
import {
  budgetData, budgetSections, collectibles, gameStats,
  calculateBudgetSections, preloadSectionCollectibles,
  preloadedSections, createdGates, resetBudgetContainers
} from './budget.js';

let currentSection = 0;
// Track the last gate's segment count so we can avoid repeats.
let lastGateSegmentCount = 0;

function ensurePreloadedCollectibles() {
  const currentFeet = Math.max(0, Math.floor((groundY - game.sprite.y) / PIXELS_PER_FOOT));
  const currentSectionIndex = Math.floor(currentFeet / 100);
  for (let i = 0; i < 3; i++) preloadSectionCollectibles(currentSectionIndex + i);
}

/**
 * Create a gate at the specified "feet" height.
 * Uses SegmentedGatePlatform with 1–3 segments and prevents the same count twice in a row.
 * The gap can appear on either a horizontal span or a vertical connector.
 */
function createGateAtFeet(feet) {
  if (createdGates.has(feet)) return;
  const y = groundY - feet * PIXELS_PER_FOOT;

  // choose 1–3 segments, not equal to lastGateSegmentCount
  let segCount = Math.floor(Math.random() * 3) + 1; // 1..3
  if (lastGateSegmentCount !== 0) {
    while (segCount === lastGateSegmentCount) {
      segCount = Math.floor(Math.random() * 3) + 1;
    }
  }
  lastGateSegmentCount = segCount;

  const gate = new SegmentedGatePlatform(y, canvasWidth, GATE_GAP_WIDTH, segCount);
  game.platforms.push(gate);
  createdGates.add(feet);
}

function ensurePreloadedGates() {
  const currentFeet = Math.max(0, Math.floor((groundY - game.sprite.y) / PIXELS_PER_FOOT));
  const idx = Math.floor(currentFeet / GATE_EVERY_FEET);
  const thisFeet = Math.max(GATE_EVERY_FEET, idx * GATE_EVERY_FEET);
  const nextFeet = (idx + 1) * GATE_EVERY_FEET;
  createGateAtFeet(thisFeet);
  createGateAtFeet(nextFeet);
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

function mergePlatforms(i, j) {
  const A = game.platforms[i], B = game.platforms[j];
  if (!A || !B || !A.active || !B.active) return;

  // Don't merge gate platforms
  if ((A instanceof SegmentedGatePlatform) || (B instanceof SegmentedGatePlatform)) return;

  const ra = A.getRect(), rb = B.getRect();
  const left = Math.max(ra.x, rb.x);
  const right = Math.min(ra.x + ra.w, rb.x + rb.w);
  const top = Math.max(ra.y, rb.y);
  const bottom = Math.min(ra.y + ra.h, rb.y + rb.h);

  const cx = left + (right - left) / 2;
  const cy = top + (bottom - top) / 2;

  const newWidth = 0.5 * (A.width + B.width);
  const newX = cx - newWidth / 2;
  const newY = cy + 20 / 2;

  const M = new Platform(newX, newY, newWidth, 0, 0);
  M.startFloating();

  const hi = Math.max(i, j), lo = Math.min(i, j);
  game.platforms.splice(hi, 1);
  game.platforms.splice(lo, 1);
  game.platforms.push(M);
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
  calculateBudgetSections();
  game.energyBar = new EnergyBar();
  game.hearts = new Hearts();
  game.platforms = [];
  resetBudgetContainers();

  const startX = canvasWidth / 2;
  const startY = groundY - 8;
  game.sprite = new Sprite(startX, startY, {
    energyBar: game.energyBar,
    hearts: game.hearts,
    onGameOver: triggerGameOver,
    getPlatforms: () => game.platforms
  });

  setCameraY(0);
  currentSection = 0;
  lastGateSegmentCount = 0;

  ensurePreloadedGates();
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
  game.platforms = [];
  resetBudgetContainers();

  calculateBudgetSections();
  game.energyBar = new EnergyBar();
  game.hearts = new Hearts();

  const startX = canvasWidth / 2;
  const startY = groundY - 8;
  game.sprite = new Sprite(startX, startY, {
    energyBar: game.energyBar,
    hearts: game.hearts,
    onGameOver: triggerGameOver,
    getPlatforms: () => game.platforms
  });

  setCameraY(0);
  currentSection = 0;
  lastGateSegmentCount = 0;

  ensurePreloadedGates();
  ensurePreloadedCollectibles();
  game.lastTime = now();
  requestAnimationFrame(loop);
}

function loop() {
  if (!game.running) { drawFrame(0); return; }
  const t = now();
  const dt = Math.min(0.04, (t - game.lastTime) / 1000);
  game.lastTime = t;

  if (!showSettings) {
    game.sprite.update(dt);
    ensurePreloadedGates();
    ensurePreloadedCollectibles();

    for (const p of game.platforms) p.update(dt);
    for (const c of collectibles) c.update(dt, game, gameStats);

    // cull
    for (let i = collectibles.length - 1; i >= 0; i--) if (!collectibles[i].active) collectibles.splice(i, 1);
    for (let i = game.platforms.length - 1; i >= 0; i--) if (game.platforms[i].active === false) game.platforms.splice(i, 1);

    // merge collisions - exclude segmented gate platforms from merging
    for (let i = 0; i < game.platforms.length; i++) {
      for (let j = i + 1; j < game.platforms.length; j++) {
        const A = game.platforms[i], B = game.platforms[j];
        if (!A || !B) continue;
        if ((A instanceof SegmentedGatePlatform) || (B instanceof SegmentedGatePlatform)) continue;
        if (!A.active || !B.active) continue;
        if (A.floating || B.floating) continue;
        if (rectsIntersect(A.getRect(), B.getRect())) {
          mergePlatforms(i, j);
          i = game.platforms.length;
          break;
        }
      }
    }

    game.energyBar.update(dt);
    updateCamera();
  }

  drawFrame(dt);
  if (game.running) requestAnimationFrame(loop);
}

function drawFrame() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  drawBackgroundGrid();

  // ground line
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, groundY - cameraY);
  ctx.lineTo(canvasWidth, groundY - cameraY);
  ctx.stroke();

  for (const p of game.platforms) {
    if ('getRects' in p) p.draw(ctx, cameraY, canvasWidth);
    else p.draw(ctx, cameraY);
  }
  for (const c of collectibles) c.draw(ctx, cameraY, canvasHeight);

  if (!showSettings) game.sprite.draw(ctx, cameraY);
  if (game.input && !showSettings) game.input.draw(ctx);

  drawHUD();
  drawSettings(resetGame);
}

// kick off
startGame();