import type { Vector2 } from '../app/runtime/types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(vec: Vector2, scalar: number): Vector2 {
  return { x: vec.x * scalar, y: vec.y * scalar };
}

export function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function withinRadius(a: Vector2, b: Vector2, radius: number): boolean {
  return distance(a, b) <= radius;
}
