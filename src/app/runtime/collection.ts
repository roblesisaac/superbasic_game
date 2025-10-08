import type { GameEngine } from './engine';
import type { InputAction } from './input';
import { GameObject } from './game-object';
import type { ScriptMessage } from './types';

export class GameCollection {
  readonly id: string;
  protected readonly engine: GameEngine;
  private readonly objects: GameObject[] = [];
  private readonly pendingObjects: GameObject[] = [];
  private readonly messageQueue: ScriptMessage[] = [];

  constructor(id: string, engine: GameEngine) {
    this.id = id;
    this.engine = engine;
  }

  spawn(object: GameObject): void {
    this.pendingObjects.push(object);
  }

  postMessage(message: ScriptMessage): void {
    this.messageQueue.push(message);
  }

  update(dt: number): void {
    if (this.pendingObjects.length > 0) {
      for (const object of this.pendingObjects.splice(0)) {
        object.attach(this, this.engine);
        this.objects.push(object);
      }
    }

    for (const object of this.objects) {
      object.update(dt);
    }

    this.processMessages();
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const object of this.objects) {
      object.render(ctx);
    }
  }

  handleInput(action: InputAction): void {
    for (const object of this.objects) {
      object.handleInput(action);
    }
  }

  getObjectById(id: string): GameObject | undefined {
    return this.objects.find((object) => object.id === id);
  }

  forEach(callback: (object: GameObject) => void): void {
    for (const object of this.objects) {
      callback(object);
    }
  }

  snapshot(): readonly GameObject[] {
    return [...this.objects];
  }

  private processMessages(): void {
    if (this.messageQueue.length === 0) return;
    const messages = this.messageQueue.splice(0);
    for (const message of messages) {
      if (message.targetId === '*') {
        for (const object of this.objects) {
          object.handleMessage(message);
        }
        continue;
      }

      const target = this.getObjectById(message.targetId);
      if (target) {
        target.handleMessage(message);
      }
    }
  }
}
