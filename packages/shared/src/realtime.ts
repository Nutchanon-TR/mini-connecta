import { z } from 'zod';

export const studyRoomId = 'study-room';

const presetSchema = z.enum(['strawberry', 'matcha']);
const sequenceSchema = z.int().nonnegative();
const coordinateSchema = z.number();

export const joinOptionsSchema = z.strictObject({
  joinTicket: z.string().min(1),
});

export const moveMessageSchema = z.strictObject({
  seq: sequenceSchema,
  x: coordinateSchema,
  z: coordinateSchema,
});

export const playerStateSchema = z.strictObject({
  displayName: z.string().min(1),
  preset: presetSchema,
  x: coordinateSchema,
  z: coordinateSchema,
  heading: z.number(),
  moving: z.boolean(),
  lastMoveSeq: sequenceSchema,
});

export const roomSnapshotSchema = z.strictObject({
  players: z.record(z.string().min(1), playerStateSchema),
});

export const clientMessageSchemas = {
  move: moveMessageSchema,
  'voice.request': z.undefined(),
};

export const serverMessageSchemas = {
  'voice.granted': z.strictObject({
    url: z.url({ protocol: /^wss?$/ }),
    token: z.string().min(1),
  }),
  'voice.unavailable': z.undefined(),
};

export const roomJoinErrorSchema = z.enum([
  'room_full',
  'already_in_room',
  'ticket_invalid',
  'ticket_expired',
  'room_unavailable',
]);

export type MoveMessage = z.infer<typeof moveMessageSchema>;
export type PlayerState = z.infer<typeof playerStateSchema>;
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
export type RoomJoinError = z.infer<typeof roomJoinErrorSchema>;
