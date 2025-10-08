import type { DefoldScript } from '../../app/runtime/types';
import { clamp } from '../../shared/math';

interface PlayerState {
  velocity: { x: number; y: number };
  moveLeft: boolean;
  moveRight: boolean;
  moveUp: boolean;
  moveDown: boolean;
  hitTimer: number;
}

export function createPlayerScript(): DefoldScript<PlayerState> {
  const speed = 72;

  return {
    createState() {
      return {
        velocity: { x: 0, y: 0 },
        moveLeft: false,
        moveRight: false,
        moveUp: false,
        moveDown: false,
        hitTimer: 0
      };
    },
    init(context) {
      context.position.x = context.position.x || context.engine.canvas.width / 2;
      context.position.y = context.position.y || context.engine.canvas.height / 2;
    },
    onInput(context, action) {
      const isPressed = action.pressed;
      switch (action.id) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          context.state.moveLeft = isPressed;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          context.state.moveRight = isPressed;
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          context.state.moveUp = isPressed;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          context.state.moveDown = isPressed;
          break;
      }
    },
    update(context, dt) {
      const { moveLeft, moveRight, moveUp, moveDown } = context.state;
      let inputX = 0;
      let inputY = 0;
      if (moveLeft) inputX -= 1;
      if (moveRight) inputX += 1;
      if (moveUp) inputY -= 1;
      if (moveDown) inputY += 1;

      if (inputX !== 0 && inputY !== 0) {
        const inv = 1 / Math.sqrt(2);
        inputX *= inv;
        inputY *= inv;
      }

      context.state.velocity.x = inputX * speed;
      context.state.velocity.y = inputY * speed;

      context.position.x += context.state.velocity.x * dt;
      context.position.y += context.state.velocity.y * dt;

      const { canvas } = context.engine;
      context.position.x = clamp(context.position.x, 8, canvas.width - 8);
      context.position.y = clamp(context.position.y, 8, canvas.height - 8);

      if (context.state.hitTimer > 0) {
        context.state.hitTimer = Math.max(0, context.state.hitTimer - dt);
      }
    },
    onMessage(context, message) {
      if (message.messageId === 'enemy_collision') {
        if (context.state.hitTimer <= 0) {
          context.state.hitTimer = 0.5;
          context.engine.loseLife();
        }
      }
    },
    render(context, ctx) {
      const { position } = context;
      const color = context.state.hitTimer > 0 ? '#ff8181' : '#6fe8ff';
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(6, 6);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };
}
