export interface SwipeEffectPoint {
  x: number;
  y: number;
}

interface SwipeEffectSparkle {
  x: number;
  y: number;
  radius: number;
  delay: number;
  duration: number;
  age: number;
}

export interface SwipeEffect {
  points: SwipeEffectPoint[];
  lifetime: number;
  age: number;
  sparkles: SwipeEffectSparkle[];
  dynamic: boolean;
}

const BASE_LIFETIME = 0.55;
const RANDOM_LIFETIME = 0.35;

function simplifyPoints(points: SwipeEffectPoint[], minDistance = 4) {
  if (points.length <= 2) return points.slice();

  const simplified: SwipeEffectPoint[] = [];
  let last = points[0];
  simplified.push(last);

  for (let i = 1; i < points.length; i++) {
    const next = points[i];
    const dx = next.x - last.x;
    const dy = next.y - last.y;
    if (dx * dx + dy * dy >= minDistance * minDistance) {
      simplified.push(next);
      last = next;
    }
  }

  if (simplified.length === 1) simplified.push(points[points.length - 1]);
  return simplified;
}

function buildSparkles(points: SwipeEffectPoint[]) {
  const count = Math.min(18, Math.max(5, Math.floor(points.length * 0.8)));
  const sparkles: SwipeEffectSparkle[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * (points.length - 1));
    const base = points[idx];
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetRadius = 6 + Math.random() * 10;
    sparkles.push({
      x: base.x + Math.cos(offsetAngle) * offsetRadius,
      y: base.y + Math.sin(offsetAngle) * offsetRadius,
      radius: 1.5 + Math.random() * 2.5,
      delay: (i / count) * 0.12,
      duration: 0.2 + Math.random() * 0.25,
      age: 0,
    });
  }
  return sparkles;
}

export function createSwipeEffect(points: SwipeEffectPoint[]): SwipeEffect | null {
  if (points.length < 2) return null;
  const simplified = simplifyPoints(points);
  if (simplified.length < 2) return null;

  return {
    points: simplified,
    lifetime: BASE_LIFETIME + Math.random() * RANDOM_LIFETIME,
    age: 0,
    sparkles: buildSparkles(simplified),
    dynamic: false,
  };
}

export function createSwipeEffectSeed(point: SwipeEffectPoint): SwipeEffect {
  return {
    points: [{ ...point }],
    lifetime: BASE_LIFETIME + Math.random() * RANDOM_LIFETIME,
    age: 0,
    sparkles: [],
    dynamic: true,
  };
}

function appendSparkle(effect: SwipeEffect, base: SwipeEffectPoint) {
  if (effect.sparkles.length > 48) return;
  effect.sparkles.push({
    x: base.x + (Math.random() - 0.5) * 10,
    y: base.y + (Math.random() - 0.5) * 10,
    radius: 1 + Math.random() * 2,
    delay: 0,
    duration: 0.15 + Math.random() * 0.2,
    age: 0,
  });
}

export function appendSwipeEffectPoint(
  effect: SwipeEffect,
  point: SwipeEffectPoint,
  minDistance = 3
) {
  const last = effect.points[effect.points.length - 1];
  if (!last) {
    effect.points.push({ ...point });
    appendSparkle(effect, point);
    return;
  }

  const dx = point.x - last.x;
  const dy = point.y - last.y;
  if (dx * dx + dy * dy < minDistance * minDistance) return;

  effect.points.push({ ...point });
  effect.dynamic = true;
  if (Math.random() < 0.7) appendSparkle(effect, point);
}

export function finalizeSwipeEffectPath(
  effect: SwipeEffect,
  points: SwipeEffectPoint[]
) {
  if (points.length === 0) return;
  const simplified = simplifyPoints(points);
  effect.points = simplified.length > 0 ? simplified : [points[0]];
  effect.sparkles = buildSparkles(effect.points);
  effect.lifetime = Math.max(effect.lifetime, BASE_LIFETIME + Math.random() * RANDOM_LIFETIME);
  effect.age = Math.min(effect.age, effect.lifetime * 0.2);
  effect.dynamic = false;
}

export function updateSwipeEffects(effects: SwipeEffect[], dt: number) {
  for (const effect of effects) {
    effect.age += dt;
    for (const sparkle of effect.sparkles) {
      sparkle.age += dt;
    }
  }
}

export function pruneSwipeEffects(effects: SwipeEffect[]) {
  for (let i = effects.length - 1; i >= 0; i--) {
    if (effects[i].age >= effects[i].lifetime) effects.splice(i, 1);
  }
}

export function drawSwipeEffects(
  ctx: CanvasRenderingContext2D,
  effects: SwipeEffect[]
) {
  for (const effect of effects) {
    const remaining = Math.max(0, 1 - effect.age / effect.lifetime);
    if (remaining <= 0) continue;
    const pts = effect.points;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (pts.length < 2) {
      const p = pts[0];
      const radius = 10 * remaining + 6;
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.8 * remaining})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.4 * remaining})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, radius), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.restore();
      continue;
    }

    const baseRadius = 16 * remaining + 6;
    const dustAlpha = 0.32 * remaining + 0.16;

    const drawDust = (x: number, y: number, strength: number) => {
      const radius = Math.max(2.5, baseRadius * strength);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${dustAlpha})`);
      gradient.addColorStop(0.6, `rgba(255, 255, 255, ${dustAlpha * 0.55})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const len = pts.length;
    for (let i = 0; i < len; i++) {
      const p = pts[i];
      const progression = len > 1 ? i / (len - 1) : 0;
      drawDust(p.x, p.y, 0.75 + 0.25 * (1 - progression));

      if (i === 0) continue;
      const prev = pts[i - 1];
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / 12));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = prev.x + dx * t;
        const y = prev.y + dy * t;
        drawDust(x, y, 0.6 + 0.25 * (1 - t));
      }
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * remaining})`;

    for (const sparkle of effect.sparkles) {
      const localLife = sparkle.age - sparkle.delay;
      if (localLife <= 0 || localLife >= sparkle.duration) continue;
      const sparkleProgress = 1 - localLife / sparkle.duration;
      const radius = sparkle.radius * sparkleProgress;
      ctx.globalAlpha = sparkleProgress * remaining;
      ctx.beginPath();
      ctx.arc(sparkle.x, sparkle.y, Math.max(0.5, radius), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
