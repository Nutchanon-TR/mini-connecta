import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { connectDatabase } from '@mini-connecta/db';
import {
  httpUrl,
  origin,
  readConfig,
  secret,
  websocketUrl,
} from '@mini-connecta/shared/server-config';
import { z } from 'zod';
import { createAuth } from './auth';

const schema = z
  .object({
    APP_ORIGIN: origin,
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: secret,
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    ROOM_JOIN_SECRET: secret,
    GAME_INTERNAL_URL: httpUrl,
    GAME_WS_URL: websocketUrl,
    API_PORT: z.coerce.number().int().min(1).max(65535).default(2568),
  })
  .refine((config) => config.APP_ORIGIN === config.BETTER_AUTH_URL, { path: ['BETTER_AUTH_URL'] })
  .refine((config) => Boolean(config.GOOGLE_CLIENT_ID) === Boolean(config.GOOGLE_CLIENT_SECRET), {
    path: ['GOOGLE_CLIENT_ID'],
  })
  .refine((config) => config.BETTER_AUTH_SECRET !== config.ROOM_JOIN_SECRET, {
    path: ['ROOM_JOIN_SECRET'],
  });

@Injectable()
export class Runtime implements OnModuleDestroy {
  readonly env = readConfig(schema);
  readonly db = connectDatabase(this.env.DATABASE_URL);
  readonly auth = createAuth(this.db, {
    origin: this.env.APP_ORIGIN,
    secret: this.env.BETTER_AUTH_SECRET,
    googleId: this.env.GOOGLE_CLIENT_ID,
    googleSecret: this.env.GOOGLE_CLIENT_SECRET,
  });

  async onModuleDestroy() {
    await this.db.$disconnect();
  }
}
