import {
  httpUrl,
  origin,
  readConfig,
  secret,
  websocketUrl,
} from '@mini-connecta/shared/server-config';
import { z } from 'zod';

export const config = readConfig(
  z
    .object({
      APP_ORIGIN: origin,
      ROOM_JOIN_SECRET: secret,
      ROOM_CAPACITY: z.coerce.number().int().min(2).max(60).default(20),
      GAME_PORT: z.coerce.number().int().min(1).max(65535).default(2567),
      GAME_INTERNAL_PORT: z.coerce.number().int().min(1).max(65535).default(2569),
      LIVEKIT_API_KEY: z.string().min(1),
      LIVEKIT_API_SECRET: secret,
      LIVEKIT_INTERNAL_URL: httpUrl,
      LIVEKIT_PUBLIC_URL: websocketUrl,
    })
    .refine((env) => env.ROOM_JOIN_SECRET !== env.LIVEKIT_API_SECRET, {
      path: ['ROOM_JOIN_SECRET'],
    }),
);
