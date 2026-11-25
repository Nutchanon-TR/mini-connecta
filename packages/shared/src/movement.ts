import { isWalkable, type Point } from './navigation';

export const walkSpeed = 4;
export const moveInterval = 65;
export const voiceRange = 6;

export function voiceVolume(distance: number) {
  return Math.max(0, Math.min(1, 1 - (distance - 1.5) / (voiceRange - 1.5)));
}

export function walk(from: Point, to: Point, budget: number): Point {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.0001) return from;
  const length = Math.min(distance, budget);
  const steps = Math.ceil(length / 0.1);
  let x = from.x;
  let z = from.z;
  for (let i = 0; i < steps; i++) {
    const nextX = x + ((dx / distance) * length) / steps;
    const nextZ = z + ((dz / distance) * length) / steps;
    if (isWalkable({ x: nextX, z: nextZ })) {
      x = nextX;
      z = nextZ;
    } else {
      if (isWalkable({ x: nextX, z })) x = nextX;
      if (isWalkable({ x, z: nextZ })) z = nextZ;
    }
  }
  return { x, z };
}
