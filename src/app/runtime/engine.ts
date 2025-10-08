import { GameCollection } from './collection';
import { InputService } from './input';
import type { InputAction } from './input';
import type { Vector2 } from './types';

export interface GameState {
  score: number;
  lives: number;
  elapsed: number;
}

export interface EngineOptions {
  logicalSize?: Vector2;
  clearColor?: string;
}

export type CollectionFactory = (engine: GameEngine) => GameCollection;

export class GameEngine {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input: InputService;
  readonly state: GameState = { score: 0, lives: 3, elapsed: 0 };

  private clearColor: string;
  private running = false;
  private collection: GameCollection | null = null;
  private lastTimestamp: number | null = null;

  constructor(canvas: HTMLCanvasElement, options: EngineOptions = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to acquire 2D canvas context');
    this.canvas = canvas;
    this.ctx = ctx;
    this.clearColor = options.clearColor ?? '#0f0f23';
    this.input = new InputService();

    if (options.logicalSize) {
      this.resize(options.logicalSize);
    } else {
      this.resize({ x: canvas.width || 320, y: canvas.height || 180 });
    }
  }

  resize(size: Vector2): void {
    this.canvas.width = size.x;
    this.canvas.height = size.y;
  }

  loadCollection(factory: CollectionFactory): void {
    this.collection = factory(this);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = null;
    requestAnimationFrame((ts) => this.step(ts));
  }

  stop(): void {
    this.running = false;
  }

  updateScore(amount: number): void {
    this.state.score += amount;
  }

  loseLife(): void {
    this.state.lives = Math.max(0, this.state.lives - 1);
  }

  private step(timestamp: number): void {
    if (!this.running) return;

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
    }
    const deltaMs = timestamp - this.lastTimestamp;
    const dt = Math.min(deltaMs, 100) / 1000;
    this.lastTimestamp = timestamp;
    this.state.elapsed += dt;

    const actions: InputAction[] = this.input.consumeFrameQueue();
    if (this.collection) {
      for (const action of actions) {
        this.collection.handleInput(action);
      }
      this.collection.update(dt);
    }

    this.render();

    requestAnimationFrame((ts) => this.step(ts));
  }

  private render(): void {
    this.ctx.save();
    this.ctx.fillStyle = this.clearColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    if (this.collection) {
      this.collection.render(this.ctx);
    }
  }
}
