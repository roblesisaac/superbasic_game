import type { DefoldScript } from '../../app/runtime/types';

interface HudState {
  blinkTimer: number;
}

export function createHudGui(): DefoldScript<HudState> {
  return {
    createState() {
      return { blinkTimer: 0 };
    },
    update(context, dt) {
      context.state.blinkTimer = (context.state.blinkTimer + dt) % 1;
    },
    render(context, ctx) {
      const { state, engine } = context;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`SCORE: ${engine.state.score}`, 8, 8);
      ctx.fillText(`LIVES: ${engine.state.lives}`, 8, 22);

      ctx.textAlign = 'center';
      ctx.fillText('ARROWS / WASD TO MOVE', engine.canvas.width / 2, engine.canvas.height - 18);

      if (engine.state.lives <= 0 && state.blinkTimer < 0.5) {
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffb3b3';
        ctx.fillText('GAME OVER', engine.canvas.width / 2, engine.canvas.height / 2 - 8);
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText('REFRESH TO RESTART', engine.canvas.width / 2, engine.canvas.height / 2 + 8);
      }

      ctx.restore();
    }
  };
}
