import { describe, expect, it } from 'vitest';
import { BOUNDS } from './layout';
import { walk, voiceVolume } from './movement';
import { findPath, isWalkable } from './navigation';

describe('Library movement and voice range', () => {
  it('bounds movement and clips a fast straight line at the desk', () => {
    expect(walk({ x: 0, z: 5 }, { x: 3, z: 5 }, 0.4).x).toBeCloseTo(0.4);
    const beforeDesk = walk({ x: 0, z: 5.2 }, { x: 0, z: -6 }, 12);
    expect(beforeDesk.z).toBeGreaterThan(2.1);
    expect(isWalkable(beforeDesk)).toBe(true);
    expect(walk({ x: 0, z: 5.2 }, { x: 50, z: 5.2 }, 100).x).toBeLessThanOrEqual(BOUNDS.maxX);
  });

  it('finds a walkable route around furniture', () => {
    const path = findPath({ x: 0, z: 5.2 }, { x: 0, z: -5.2 });
    expect(path.length).toBeGreaterThan(1);
    expect(path.every(isWalkable)).toBe(true);
  });

  it('attenuates audio smoothly to zero', () => {
    expect(voiceVolume(0)).toBe(1);
    expect(voiceVolume(3)).toBeCloseTo(2 / 3);
    expect(voiceVolume(6)).toBe(0);
    expect(voiceVolume(12)).toBe(0);
  });
});
