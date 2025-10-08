import type { GameCollection } from './collection';
import type { GameEngine } from './engine';
import type { InputAction } from './input';
import type { Bounds, DefoldScript, ScriptMessage, ScriptContext, Vector2 } from './types';

export interface GameObjectConfig<State> {
  id: string;
  position?: Vector2;
  size?: Bounds;
  script: DefoldScript<State>;
  properties?: Record<string, unknown>;
}

export class GameObject<State = Record<string, unknown>> {
  readonly id: string;
  readonly script: DefoldScript<State>;
  readonly state: State;
  readonly position: Vector2;
  readonly size: Bounds;
  readonly properties: Record<string, unknown>;

  private collection: GameCollection | null = null;
  private engine: GameEngine | null = null;
  private context: ScriptContext<State> | null = null;

  constructor(config: GameObjectConfig<State>) {
    this.id = config.id;
    this.script = config.script;
    this.state = this.script.createState();
    this.position = config.position ? { ...config.position } : { x: 0, y: 0 };
    this.size = config.size ? { ...config.size } : { width: 16, height: 16 };
    this.properties = config.properties ? { ...config.properties } : {};
  }

  attach(collection: GameCollection, engine: GameEngine): void {
    this.collection = collection;
    this.engine = engine;
    this.context = {
      id: this.id,
      engine,
      collection,
      object: this,
      position: this.position,
      size: this.size,
      state: this.state,
      properties: this.properties,
      sendMessage: (message: ScriptMessage) => {
        collection.postMessage({ ...message, senderId: message.senderId ?? this.id });
      },
      spawn: (object: GameObject) => {
        collection.spawn(object);
      }
    } satisfies ScriptContext<State>;
    this.script.init(this.context);
  }

  update(dt: number): void {
    if (!this.context) return;
    this.script.update(this.context, dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.context || !this.script.render) return;
    this.script.render(this.context, ctx);
  }

  handleMessage(message: ScriptMessage): void {
    if (!this.context || !this.script.onMessage) return;
    this.script.onMessage(this.context, message);
  }

  handleInput(action: InputAction): void {
    if (!this.context || !this.script.onInput) return;
    this.script.onInput(this.context, action);
  }

  dispose(): void {
    if (!this.context || !this.script.onFinal) return;
    this.script.onFinal(this.context);
  }
}
