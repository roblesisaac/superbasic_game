import { now } from '../shared/utils.js';
import { drawBackgroundGrid } from './environment/background_renderer.js';
import { drawHUD } from './controllers/hud_renderer.js';
import { updateCameraForSprite, resetCameraController } from './controllers/camera_controller.js';
import { bootstrapCards, syncCards, resetCardController } from './controllers/card_controller.js';
import { presentGameOverScreen, hideGameOverScreen } from './controllers/game_over_controller.js';
import { HeartEffectSystem } from './controllers/heart_effects.js';
import { ensureSettingsOverlay, showSettings } from '../gui/settings_overlay.js';
import { EnergyBar, Hearts } from '../gui/hud.js';
import { InputHandler } from './input.js';
import { Sprite } from '../game_objects/sprite.js';
import { HeartPickup } from '../game_objects/heartPickup.js';
import { drawPixelatedHeart, computeHeartBobOffset } from '../gui/drawPixelatedHeart.js';
import {
  updateRides,
  pruneInactiveRides,
  drawRides,
  mergeCollidingRides
} from '../game_objects/rides.js';
import { updateGates, pruneInactiveGates, drawGates } from '../game_objects/gates.js';
import {
  resetEnemies,
  updateEnemies,
  drawEnemies,
  pruneInactiveEnemies
} from '../game_objects/enemies.js';
import { collectibles, gameStats, resetBudgetContainers } from '../modules/budget.js';
import {
  ctx,
  canvasWidth,
  canvasHeight,
  groundY
} from './state/rendering_state.js';
import { cameraY } from './state/camera_state.js';
import { gameWorld } from './state/game_state.js';

const MAX_DELTA_SECONDS = 0.04;
let animationHandle: number | null = null;

function buildSprite(): Sprite {
  const energyBar = gameWorld.energyBar;
  const hearts = gameWorld.hearts;

  if (!energyBar || !hearts) {
    throw new Error('UI elements must be prepared before creating the sprite.');
  }

  const onGameOver = () => {
    gameWorld.running = false;
    presentGameOverScreen(resetGame);
  };

  const sprite = new Sprite(canvasWidth / 2, groundY - 8, {
    energyBar,
    hearts,
    onGameOver,
    getRides: () => gameWorld.rides,
    getGates: () => gameWorld.gates,
    getHeartPickups: () => gameWorld.heartPickups
  });

  return sprite;
}

function spawnGroundHeart(): void {
  const pixelSize = 3;
  const { width, height } = HeartPickup.getDimensions(pixelSize);
  const heart = new HeartPickup({
    x: canvasWidth - width - 20,
    y: groundY - height - 120,
    pixelSize,
    respawns: false,
  });
  gameWorld.heartPickups.push(heart);
}

function initializeGameState(): void {
  resetBudgetContainers();
  resetEnemies();
  resetCardController();
  resetCameraController();
  hideGameOverScreen();
  ensureSettingsOverlay();
  gameWorld.heartEffects?.dispose();

  gameWorld.energyBar = new EnergyBar();
  gameWorld.hearts = new Hearts();
  gameWorld.rides = [];
  gameWorld.gates = [];
  gameWorld.heartPickups = [];
  gameWorld.heartEffects = new HeartEffectSystem();
  gameWorld.sprite = buildSprite();

  const cardFrame = bootstrapCards(gameWorld.sprite.y);
  gameWorld.gates = [...cardFrame.gates];
  spawnGroundHeart();

  if (!gameWorld.input) {
    gameWorld.input = new InputHandler(gameWorld, resetGame);
  }

  gameWorld.lastTime = now();
  gameWorld.running = true;
}

function resetGame(): void {
  initializeGameState();
  startLoop();
}

function updateCollectibles(dt: number): void {
  for (const collectible of collectibles) {
    collectible.update(dt, gameWorld, gameStats);
  }

  for (let i = collectibles.length - 1; i >= 0; i--) {
    if (!collectibles[i].active) collectibles.splice(i, 1);
  }
}

function updateHeartPickups(dt: number): void {
  for (const heart of gameWorld.heartPickups) {
    heart.update(dt);
  }
}

function drawHeartPickups(): void {
  const timeMs = Number.isFinite(gameWorld.lastTime) ? gameWorld.lastTime : now();
  for (const heart of gameWorld.heartPickups) {
    if (!heart.isActive()) continue;
    const bounds = heart.getBounds();
    const bob = computeHeartBobOffset(timeMs, heart.pixelSize, heart.x + heart.y);
    drawPixelatedHeart(ctx, bounds.x, bounds.y - cameraY + bob, heart.pixelSize, '#ff5b6e');
  }
}

function updateWorld(dt: number): void {
  const sprite = gameWorld.sprite;
  if (!sprite) return;

  if (showSettings) {
    ensureSettingsOverlay();
    return;
  }

  sprite.update(dt);

  const cardFrame = syncCards(sprite.y);
  gameWorld.gates = [...cardFrame.gates];

  updateRides(gameWorld.rides, dt);
  updateGates(gameWorld.gates, dt);
  updateHeartPickups(dt);
  gameWorld.heartEffects?.update(dt);
  updateEnemies(gameWorld, dt);
  updateCollectibles(dt);

  pruneInactiveEnemies();
  pruneInactiveRides(gameWorld.rides);
  pruneInactiveGates(gameWorld.gates);

  while (mergeCollidingRides(gameWorld.rides, canvasWidth)) {
    // Continue merging until all overlapping rides are resolved
  }

  gameWorld.energyBar?.update(dt, sprite.isStationary);

  updateCameraForSprite(sprite);
  ensureSettingsOverlay();
}

function drawWorld(): void {
  const timeMs = Number.isFinite(gameWorld.lastTime) ? gameWorld.lastTime : now();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  drawBackgroundGrid(cameraY, timeMs);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, groundY - cameraY);
  ctx.lineTo(canvasWidth, groundY - cameraY);
  ctx.stroke();

  drawRides(ctx, gameWorld.rides, cameraY);
  drawGates(ctx, gameWorld.gates, cameraY, gameWorld.lastTime);
  drawHeartPickups();
  gameWorld.heartEffects?.draw(ctx, cameraY);
  drawEnemies(ctx, cameraY);

  for (const collectible of collectibles) {
    collectible.draw(ctx, cameraY, canvasHeight);
  }

  if (!showSettings) {
    gameWorld.sprite?.draw(ctx, cameraY);
  }

  gameWorld.input?.drawJoystick(ctx);
  drawHUD();
}

function loop(): void {
  if (!gameWorld.running) {
    drawWorld();
    return;
  }

  const timestamp = now();
  const dt = Math.min(MAX_DELTA_SECONDS, (timestamp - gameWorld.lastTime) / 1000);
  gameWorld.lastTime = timestamp;

  updateWorld(dt);
  drawWorld();

  if (gameWorld.running) {
    animationHandle = requestAnimationFrame(loop);
  }
}

function startLoop(): void {
  if (animationHandle !== null) {
    cancelAnimationFrame(animationHandle);
  }
  animationHandle = requestAnimationFrame(loop);
}

initializeGameState();
startLoop();

window.addEventListener('budget-changed', () => {
  resetGame();
});

if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
      if (window.confirm('A new version is available. Reload now?')) {
        window.location.reload();
      }
    }
  });
}
