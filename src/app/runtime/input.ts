export interface InputAction {
  id: string;
  pressed: boolean;
  rawEvent: KeyboardEvent;
}

export class InputService {
  private readonly target: Window | null;
  private readonly keysDown = new Set<string>();
  private frameQueue: InputAction[] = [];

  constructor(target: Window | null = typeof window !== 'undefined' ? window : null) {
    this.target = target;
    if (!this.target) return;

    this.target.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keysDown.add(event.key);
      this.frameQueue.push({ id: event.key, pressed: true, rawEvent: event });
    });

    this.target.addEventListener('keyup', (event) => {
      this.keysDown.delete(event.key);
      this.frameQueue.push({ id: event.key, pressed: false, rawEvent: event });
    });
  }

  isPressed(key: string): boolean {
    return this.keysDown.has(key);
  }

  consumeFrameQueue(): InputAction[] {
    const queue = this.frameQueue;
    this.frameQueue = [];
    return queue;
  }
}
