/**
 * Library room layout, shared by the client (rendering, collisions) and the
 * server (bounds, seat validation). Units are metres; +z faces the camera.
 */

export interface Seat {
  id: string;
  /** Desk chairs come with a laptop; the sofa is just for lounging. */
  kind: 'chair' | 'sofa';
  /** Seats sharing a group see each other's screen shares (a table, or the sofa). */
  tableId: string;
  x: number;
  z: number;
  /** Facing angle (radians, atan2(dx, dz) convention) when seated. */
  yaw: number;
  /** Where you end up when you stand up. */
  out: { x: number; z: number };
}

export interface Table {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
}

export type Obstacle =
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
  | { kind: 'circle'; x: number; z: number; r: number };

export const ROOM = { width: 20, depth: 14 } as const;

export const BOUNDS = {
  minX: -ROOM.width / 2 + 0.4,
  maxX: ROOM.width / 2 - 0.4,
  minZ: -ROOM.depth / 2 + 0.4,
  maxZ: ROOM.depth / 2 - 0.4,
} as const;

export const SPAWN = { x: 0, z: 5.2 } as const;

const TABLE_W = 2.4;
const TABLE_D = 1.2;

/** Six study tables in two rows, four seats each (24 seats for 20 people). */
export const TABLES: Table[] = [-5, 0, 5].flatMap((x, col) =>
  [-2.2, 1.6].map((z, row) => ({ id: `t${row}${col}`, x, z, width: TABLE_W, depth: TABLE_D })),
);

/** Stand up by stepping half a metre back, away from the direction the seat faces. */
const STAND_BACK = 0.5;

const CHAIRS: Seat[] = TABLES.flatMap((t) =>
  [-0.6, 0.6].flatMap((dx, i) => [
    // Back side faces +z (toward the table), front side faces -z
    {
      id: `${t.id}-b${i}`,
      kind: 'chair' as const,
      tableId: t.id,
      x: t.x + dx,
      z: t.z - 0.95,
      yaw: 0,
      out: { x: t.x + dx, z: t.z - 0.95 - STAND_BACK },
    },
    {
      id: `${t.id}-f${i}`,
      kind: 'chair' as const,
      tableId: t.id,
      x: t.x + dx,
      z: t.z + 0.95,
      yaw: Math.PI,
      out: { x: t.x + dx, z: t.z + 0.95 + STAND_BACK },
    },
  ]),
);

/** The reading-nook sofa against the left wall: three spots facing into the room (+x). You stand up forward, off the sofa. */
export const SOFA = { minX: -9.8, maxX: -8.6, minZ: 2.6, maxZ: 5.6, seatY: 0.45 } as const;
export const DESK_SEATS: Seat[] = CHAIRS;

/** Round coffee table in the reading nook, far enough out to leave room to stand up from the sofa. */
export const COFFEE_TABLE = { x: -7.2, z: 4.1, r: 0.5 } as const;

/** Fixed furniture footprints the player cannot walk through. */
export const OBSTACLES: Obstacle[] = [
  ...TABLES.map((t) => ({
    kind: 'box' as const,
    minX: t.x - t.width / 2,
    maxX: t.x + t.width / 2,
    minZ: t.z - t.depth / 2,
    maxZ: t.z + t.depth / 2,
  })),
  // Bookshelves along the back wall
  { kind: 'box', minX: -9.6, maxX: -3.4, minZ: -7, maxZ: -6.3 },
  { kind: 'box', minX: 3.4, maxX: 9.6, minZ: -7, maxZ: -6.3 },
  // Reading nook: sofa and coffee table, front-left
  { kind: 'box', minX: SOFA.minX, maxX: SOFA.maxX, minZ: SOFA.minZ, maxZ: SOFA.maxZ },
  { kind: 'circle', x: COFFEE_TABLE.x, z: COFFEE_TABLE.z, r: COFFEE_TABLE.r },

  // Plants
  { kind: 'circle', x: 9.3, z: 6.2, r: 0.35 },
  { kind: 'circle', x: -9.3, z: -5.6, r: 0.35 },
  { kind: 'circle', x: 9.3, z: -5.6, r: 0.35 },
];
