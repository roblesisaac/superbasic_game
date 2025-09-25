// Visual effects system for game interactions

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

interface SwipeTrail {
  points: { x: number; y: number; time: number }[];
  startTime: number;
  duration: number;
  color: string;
  maxWidth: number;
}

class EffectsSystem {
  particles: Particle[] = [];
  swipeTrails: SwipeTrail[] = [];
  sparkleEmitters: { x: number; y: number; time: number }[] = [];

  // Create a magic wand swipe effect
  createSwipeEffect(startX: number, startY: number, endX: number, endY: number) {
    // Create trail
    const trail: SwipeTrail = {
      points: [
        { x: startX, y: startY, time: Date.now() },
        { x: endX, y: endY, time: Date.now() + 50 }
      ],
      startTime: Date.now(),
      duration: 800, // Trail lasts 800ms
      color: '#ffeb3b',
      maxWidth: 8
    };
    this.swipeTrails.push(trail);

    // Create sparkles along the swipe path
    const steps = 15;
    const dx = endX - startX;
    const dy = endY - startY;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startX + dx * t;
      const y = startY + dy * t;
      
      // Add delay for trail animation
      setTimeout(() => {
        this.createSparkles(x, y, 8);
      }, i * 20);
    }

    // Create extra sparkles at the end point for emphasis
    this.createSparkles(endX, endY, 15);
    
    // Add a sparkle emitter at the end
    this.sparkleEmitters.push({
      x: endX,
      y: endY,
      time: Date.now()
    });
  }

  // Create sparkle particles
  createSparkles(x: number, y: number, count: number) {
    const colors = ['#fff59d', '#ffeb3b', '#ffc107', '#ff9800', '#ffffff'];
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 50 + Math.random() * 100;
      const size = 2 + Math.random() * 4;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }
  }

  // Create star burst effect
  createStarBurst(x: number, y: number) {
    const starCount = 20;
    for (let i = 0; i < starCount; i++) {
      const angle = (Math.PI * 2 * i) / starCount;
      const speed = 150 + Math.random() * 50;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 4 + Math.random() * 3,
        color: '#ffeb3b',
        rotation: 0,
        rotationSpeed: 0
      });
    }
  }

  update(dt: number) {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Update physics
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt; // Gravity
      p.vx *= 0.98; // Friction
      p.vy *= 0.98;
      p.rotation += p.rotationSpeed * dt;
      
      // Update life
      p.life -= dt * 2; // Fade out
      
      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update swipe trails
    const now = Date.now();
    for (let i = this.swipeTrails.length - 1; i >= 0; i--) {
      const trail = this.swipeTrails[i];
      if (now - trail.startTime > trail.duration) {
        this.swipeTrails.splice(i, 1);
      }
    }

    // Update sparkle emitters
    for (let i = this.sparkleEmitters.length - 1; i >= 0; i--) {
      const emitter = this.sparkleEmitters[i];
      const age = now - emitter.time;
      
      // Emit sparkles for 300ms
      if (age < 300) {
        if (Math.random() < 0.3) { // 30% chance per frame
          this.createSparkles(
            emitter.x + (Math.random() - 0.5) * 20,
            emitter.y + (Math.random() - 0.5) * 20,
            2
          );
        }
      } else {
        this.sparkleEmitters.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    ctx.save();
    
    // Draw swipe trails
    for (const trail of this.swipeTrails) {
      const age = Date.now() - trail.startTime;
      const progress = age / trail.duration;
      const opacity = Math.max(0, 1 - progress);
      
      if (trail.points.length < 2) continue;
      
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = trail.color;
      ctx.lineWidth = trail.maxWidth * (1 - progress * 0.5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Add glow effect
      ctx.shadowColor = trail.color;
      ctx.shadowBlur = 10 + (1 - progress) * 20;
      
      ctx.beginPath();
      for (let i = 0; i < trail.points.length; i++) {
        const point = trail.points[i];
        const screenX = point.x - cameraX;
        const screenY = point.y - cameraY;
        
        if (i === 0) {
          ctx.moveTo(screenX, screenY);
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;
    }
    
    // Draw particles
    for (const p of this.particles) {
      const screenX = p.x - cameraX;
      const screenY = p.y - cameraY;
      
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      
      // Draw star shape
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(p.rotation);
      
      const size = p.size * p.life;
      
      // Simple 4-pointed star
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.3, -size * 0.3);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.3, size * 0.3);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.3, size * 0.3);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.3, -size * 0.3);
      ctx.closePath();
      
      // Add glow
      ctx.shadowColor = p.color;
      ctx.shadowBlur = size;
      ctx.fill();
      
      ctx.restore();
    }
    
    ctx.restore();
  }

  clear() {
    this.particles = [];
    this.swipeTrails = [];
    this.sparkleEmitters = [];
  }
}

// Singleton instance
export const effectsSystem = new EffectsSystem();

export function createSwipeEffect(startX: number, startY: number, endX: number, endY: number) {
  effectsSystem.createSwipeEffect(startX, startY, endX, endY);
}

export function createStarBurst(x: number, y: number) {
  effectsSystem.createStarBurst(x, y);
}

export function updateEffects(dt: number) {
  effectsSystem.update(dt);
}

export function drawEffects(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
  effectsSystem.draw(ctx, cameraX, cameraY);
}

export function clearEffects() {
  effectsSystem.clear();
}
