import { GameCollection } from '../../app/runtime/collection';
import { GameObject } from '../../app/runtime/game-object';
import type { GameEngine } from '../../app/runtime/engine';
import type { Vector2 } from '../../app/runtime/types';
import { createBackgroundScript } from '../components/background.script';
import { createCollectibleScript } from '../components/collectible.script';
import { createEnemyScript } from '../components/enemy.script';
import { createPlayerScript } from '../components/player.script';
import { createHudGui } from '../gui/hud.gui';

class MainCollection extends GameCollection {
  constructor(engine: GameEngine) {
    super('main', engine);
  }

  override update(dt: number): void {
    super.update(dt);
    this.handleCollisions();
  }

  private handleCollisions(): void {
    const player = this.getObjectById('player');
    if (!player) return;

    for (const object of this.snapshot()) {
      if (object.id === player.id) continue;
      const category = object.properties.category;
      if (category === 'collectible') {
        if (this.overlaps(player, object, 4)) {
          object.handleMessage({
            targetId: object.id,
            messageId: 'collect',
            senderId: player.id
          });
        }
      } else if (category === 'enemy') {
        if (this.overlaps(player, object, 2)) {
          player.handleMessage({
            targetId: player.id,
            messageId: 'enemy_collision',
            senderId: object.id
          });
          object.handleMessage({
            targetId: object.id,
            messageId: 'hit_player',
            senderId: player.id
          });
        }
      }
    }
  }

  private overlaps(a: GameObject, b: GameObject, padding: number): boolean {
    const ax = a.position.x;
    const ay = a.position.y;
    const bx = b.position.x;
    const by = b.position.y;
    const dx = ax - bx;
    const dy = ay - by;
    const ar = Math.max(a.size.width, a.size.height) / 2;
    const br = Math.max(b.size.width, b.size.height) / 2;
    const radius = ar + br + padding;
    return dx * dx + dy * dy <= radius * radius;
  }
}

function randomPosition(engine: GameEngine, margin: number): Vector2 {
  return {
    x: margin + Math.random() * (engine.canvas.width - margin * 2),
    y: margin + Math.random() * (engine.canvas.height - margin * 2)
  };
}

export function createMainCollection(engine: GameEngine): GameCollection {
  const collection = new MainCollection(engine);

  collection.spawn(
    new GameObject({
      id: 'background',
      position: { x: 0, y: 0 },
      size: { width: engine.canvas.width, height: engine.canvas.height },
      script: createBackgroundScript(),
      properties: { category: 'background' }
    })
  );

  collection.spawn(
    new GameObject({
      id: 'player',
      position: { x: engine.canvas.width / 2, y: engine.canvas.height - 32 },
      size: { width: 14, height: 14 },
      script: createPlayerScript(),
      properties: { category: 'player' }
    })
  );

  for (let i = 0; i < 4; i += 1) {
    const position = randomPosition(engine, 24);
    collection.spawn(
      new GameObject({
        id: `collectible_${i}`,
        position,
        size: { width: 10, height: 10 },
        script: createCollectibleScript(),
        properties: { category: 'collectible' }
      })
    );
  }

  for (let i = 0; i < 3; i += 1) {
    const position = randomPosition(engine, 32);
    collection.spawn(
      new GameObject({
        id: `enemy_${i}`,
        position,
        size: { width: 18, height: 12 },
        script: createEnemyScript(),
        properties: { category: 'enemy' }
      })
    );
  }

  collection.spawn(
    new GameObject({
      id: 'hud',
      position: { x: 0, y: 0 },
      size: { width: engine.canvas.width, height: engine.canvas.height },
      script: createHudGui(),
      properties: { category: 'gui' }
    })
  );

  return collection;
}
