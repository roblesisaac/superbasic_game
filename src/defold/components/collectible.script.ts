import type { DefoldScript } from '../../app/runtime/types';

interface CollectibleState {
  pulse: number;
  color: string;
}

function randomColor(): string {
  const palette = ['#f8d25b', '#f06292', '#64b5f6', '#81c784', '#ffb74d'];
  return palette[Math.floor(Math.random() * palette.length)];
}

export function createCollectibleScript(): DefoldScript<CollectibleState> {
  return {
    createState() {
      return { pulse: 0, color: randomColor() };
    },
    update(context, dt) {
      context.state.pulse = (context.state.pulse + dt * 4) % (Math.PI * 2);
    },
    onMessage(context, message) {
      if (message.messageId === 'collect') {
        context.engine.updateScore(1);
        context.state.color = randomColor();
        const { canvas } = context.engine;
        context.position.x = 16 + Math.random() * (canvas.width - 32);
        context.position.y = 16 + Math.random() * (canvas.height - 32);
      }
    },
    render(context, ctx) {
      const scale = 1 + Math.sin(context.state.pulse) * 0.15;
      const radius = (context.size.width / 2) * scale;
      ctx.save();
      ctx.translate(context.position.x, context.position.y);
      ctx.fillStyle = context.state.color;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(-radius * 0.2, -radius * 0.2, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
}
