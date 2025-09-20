import { SPRITE_SIZE } from './constants.js';
import { canvasHeight, cameraY } from './globals.js';

export class Enemy {
  constructor(x, y, platform, speed = 80) {
    this.x = x;
    this.y = y;
    this.platform = platform; // The gate/platform this enemy moves on
    this.speed = speed;
    this.direction = 1; // 1 for right/down, -1 for left/up
    this.active = true;
    this.size = 16;
    
    // Find the platform segment this enemy starts on
    this.currentSegment = this.findCurrentSegment();
    this.segmentIndex = 0;
    
    // Movement bounds for current segment
    this.updateMovementBounds();
  }

  findCurrentSegment() {
    if (!this.platform) return null;
    
    const rects = this.platform.getRects ? this.platform.getRects() : [];
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      if (this.x >= rect.x && this.x <= rect.x + rect.w &&
          this.y >= rect.y && this.y <= rect.y + rect.h) {
        this.segmentIndex = i;
        return rect;
      }
    }
    
    // If not found, use the first rect
    if (rects.length > 0) {
      this.segmentIndex = 0;
      return rects[0];
    }
    
    return null;
  }

  updateMovementBounds() {
    if (!this.currentSegment) return;
    
    const rect = this.currentSegment;
    if (rect.w > rect.h) {
      // Horizontal segment
      this.minX = rect.x + this.size / 2;
      this.maxX = rect.x + rect.w - this.size / 2;
      this.minY = this.maxY = rect.y + rect.h / 2;
    } else {
      // Vertical segment
      this.minY = rect.y + this.size / 2;
      this.maxY = rect.y + rect.h - this.size / 2;
      this.minX = this.maxX = rect.x + rect.w / 2;
    }
  }

  update(dt, game) {
    if (!this.active || !this.platform) return;
    
    // Update current segment info
    const rects = this.platform.getRects ? this.platform.getRects() : [];
    if (this.segmentIndex < rects.length) {
      this.currentSegment = rects[this.segmentIndex];
      this.updateMovementBounds();
    }
    
    if (!this.currentSegment) {
      this.active = false;
      return;
    }

    // Move based on segment orientation
    const rect = this.currentSegment;
    if (rect.w > rect.h) {
      // Horizontal movement
      this.x += this.speed * this.direction * dt;
      
      // Check bounds and reverse direction
      if (this.x <= this.minX || this.x >= this.maxX) {
        this.direction *= -1;
        this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
        
        // Try to move to connected segment
        this.tryMoveToConnectedSegment();
      }
    } else {
      // Vertical movement
      this.y += this.speed * this.direction * dt;
      
      // Check bounds and reverse direction
      if (this.y <= this.minY || this.y >= this.maxY) {
        this.direction *= -1;
        this.y = Math.max(this.minY, Math.min(this.maxY, this.y));
        
        // Try to move to connected segment
        this.tryMoveToConnectedSegment();
      }
    }

    // Check collision with sprite
    if (game.sprite) {
      const dx = this.x - game.sprite.x;
      const dy = this.y - game.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < this.size / 2 + SPRITE_SIZE / 2) {
        // Check if sprite is jumping on enemy (sprite is above and moving down)
        if (game.sprite.y < this.y - this.size / 4 && game.sprite.vy > 0) {
          // Enemy is eliminated
          this.active = false;
          // Give sprite a small bounce
          game.sprite.vy = -300;
        } else {
          // Enemy damages sprite
          game.sprite.takeDamage();
        }
      }
    }
    
    // Remove if too far below camera
    if (this.y > cameraY + canvasHeight + 200) {
      this.active = false;
    }
  }

  tryMoveToConnectedSegment() {
    if (!this.platform) return;
    
    const rects = this.platform.getRects ? this.platform.getRects() : [];
    const currentRect = this.currentSegment;
    
    // Look for connected segments
    for (let i = 0; i < rects.length; i++) {
      if (i === this.segmentIndex) continue;
      
      const rect = rects[i];
      
      // Check if segments are connected (share an edge)
      const connected = this.areSegmentsConnected(currentRect, rect);
      if (connected) {
        // Move to the connected segment
        this.segmentIndex = i;
        this.currentSegment = rect;
        
        // Position enemy at the connection point
        if (currentRect.w > currentRect.h && rect.w <= rect.h) {
          // Moving from horizontal to vertical
          this.x = rect.x + rect.w / 2;
          this.y = rect.y + (this.direction > 0 ? rect.h / 4 : rect.h * 3 / 4);
        } else if (currentRect.w <= currentRect.h && rect.w > rect.h) {
          // Moving from vertical to horizontal
          this.x = rect.x + (this.direction > 0 ? rect.w / 4 : rect.w * 3 / 4);
          this.y = rect.y + rect.h / 2;
        }
        
        this.updateMovementBounds();
        break;
      }
    }
  }

  areSegmentsConnected(rect1, rect2) {
    const tolerance = 5;
    
    // Check if they share a vertical edge
    if (Math.abs(rect1.x + rect1.w - rect2.x) < tolerance || 
        Math.abs(rect2.x + rect2.w - rect1.x) < tolerance) {
      // Check if they overlap vertically
      return !(rect1.y + rect1.h < rect2.y - tolerance || 
               rect2.y + rect2.h < rect1.y - tolerance);
    }
    
    // Check if they share a horizontal edge
    if (Math.abs(rect1.y + rect1.h - rect2.y) < tolerance || 
        Math.abs(rect2.y + rect2.h - rect1.y) < tolerance) {
      // Check if they overlap horizontally
      return !(rect1.x + rect1.w < rect2.x - tolerance || 
               rect2.x + rect2.w < rect1.x - tolerance);
    }
    
    return false;
  }

  draw(ctx, cameraY, canvasHeight) {
    if (!this.active) return;
    
    const screenX = this.x;
    const screenY = this.y - cameraY;
    
    // Don't draw if off screen
    if (screenY < -50 || screenY > canvasHeight + 50) return;

    ctx.save();
    ctx.translate(screenX, screenY);

    // Draw enemy as a red spiky creature
    ctx.fillStyle = '#FF4444';
    ctx.strokeStyle = '#CC0000';
    ctx.lineWidth = 2;
    
    // Main body
    ctx.beginPath();
    ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spikes
    ctx.fillStyle = '#CC0000';
    const spikeCount = 6;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const x1 = Math.cos(angle) * (this.size / 2 - 2);
      const y1 = Math.sin(angle) * (this.size / 2 - 2);
      const x2 = Math.cos(angle) * (this.size / 2 + 3);
      const y2 = Math.sin(angle) * (this.size / 2 + 3);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-4, -3, 2, 2);
    ctx.fillRect(2, -3, 2, 2);
    
    // Pupils
    ctx.fillStyle = '#000000';
    ctx.fillRect(-3, -2, 1, 1);
    ctx.fillRect(3, -2, 1, 1);

    ctx.restore();
  }
}

export function updateEnemies(enemies, dt, game) {
  for (const enemy of enemies) {
    enemy.update(dt, game);
  }
}

export function pruneInactiveEnemies(enemies) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i].active) {
      enemies.splice(i, 1);
    }
  }
}

export function drawEnemies(ctx, enemies, cameraY, canvasHeight) {
  for (const enemy of enemies) {
    enemy.draw(ctx, cameraY, canvasHeight);
  }
}