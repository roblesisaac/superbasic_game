export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const now = () => performance.now();

export function rectsIntersect(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}