import { ITEM_SIZE } from './constants.js';
import { SPRITE_SIZE } from './constants.js';
import { canvasHeight, cameraY } from './globals.js';

export class Collectible {
  constructor(x, y, value, title, type) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.title = title;
    this.type = type; // 'income' | 'expense'
    this.active = true;
    this.collected = false;
    this.size = ITEM_SIZE;
  }

  update(dt, game, gameStats) {
    if (this.active && !this.collected) {
      const dx = this.x - game.sprite.x;
      const dy = this.y - game.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < this.size + SPRITE_SIZE / 2) {
        this.collected = true;
        this.active = false;
        if (this.type === 'income') {
          gameStats[this.title].collected += Math.abs(this.value);
        } else {
          game.sprite.takeDamage();
          gameStats[this.title].collected += Math.abs(this.value);
        }
      }
    }
    if (this.y > cameraY + canvasHeight + 200) this.active = false;
  }

  draw(ctx, cameraY, canvasHeight) {
    if (!this.active) return;
    const screenX = this.x;
    const screenY = this.y - cameraY;
    if (screenY < -50 || screenY > canvasHeight + 50) return;

    ctx.save();
    ctx.translate(screenX, screenY);

    if (this.type === 'income') {
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#FFA500';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#B8860B';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
    } else {
      ctx.fillStyle = '#FF4444';
      ctx.strokeStyle = '#CC0000';
      ctx.lineWidth = 2;
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
      ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-3, -3, 2, 2);
      ctx.fillRect(1, -3, 2, 2);
      ctx.fillRect(-2, 1, 4, 1);
    }

    ctx.restore();
  }
}
