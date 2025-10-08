import type { DefoldScript, ScriptContext } from '../../app/runtime/types';

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
}

interface BackgroundState {
  stars: Star[];
  offset: number;
}

function createStars(context: ScriptContext<BackgroundState>, count: number): Star[] {
  const { canvas } = context.engine;
  return Array.from({ length: count }).map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    speed: 15 + Math.random() * 35,
    size: 1 + Math.random() * 2
  }));
}

export function createBackgroundScript(): DefoldScript<BackgroundState> {
  return {
    createState() {
      return { stars: [], offset: 0 };
    },
    init(context) {
      context.state.stars = createStars(context, 48);
    },
    update(context, dt) {
      const { canvas } = context.engine;
      context.state.offset = (context.state.offset + dt * 10) % canvas.height;
      for (const star of context.state.stars) {
        star.y += star.speed * dt;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      }
    },
    render(context, ctx) {
      const { canvas } = context.engine;
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#101035');
      gradient.addColorStop(1, '#04040d');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#9aa2ff';
      for (const star of context.state.stars) {
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      }
    }
  };
}
