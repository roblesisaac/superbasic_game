import type { DefoldScript } from '../../app/runtime/types';

interface EnemyState {
  direction: number;
  baseY: number;
  speed: number;
  phase: number;
}

export function createEnemyScript(): DefoldScript<EnemyState> {
  return {
    createState() {
      return {
        direction: Math.random() > 0.5 ? 1 : -1,
        baseY: 0,
        speed: 36 + Math.random() * 32,
        phase: Math.random() * Math.PI * 2
      };
    },
    init(context) {
      context.state.baseY = context.position.y;
    },
    update(context, dt) {
      context.position.x += context.state.speed * context.state.direction * dt;
      const { canvas } = context.engine;
      if (context.position.x < 16 || context.position.x > canvas.width - 16) {
        context.state.direction *= -1;
        context.position.x = Math.max(16, Math.min(canvas.width - 16, context.position.x));
      }

      context.state.phase = (context.state.phase + dt * 2) % (Math.PI * 2);
      context.position.y = context.state.baseY + Math.sin(context.state.phase) * 10;
    },
    onMessage(context, message) {
      if (message.messageId === 'hit_player') {
        const { canvas } = context.engine;
        context.position.x = 32 + Math.random() * (canvas.width - 64);
        context.state.baseY = 32 + Math.random() * (canvas.height / 2);
        context.position.y = context.state.baseY;
      }
    },
    render(context, ctx) {
      ctx.save();
      ctx.translate(context.position.x, context.position.y);
      ctx.fillStyle = '#ff6f61';
      ctx.beginPath();
      ctx.ellipse(0, 0, context.size.width / 2, context.size.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
}
