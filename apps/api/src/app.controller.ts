import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { Throttle } from '@nestjs/throttler';
import { logEvent } from '@mini-connecta/shared/server-config';
import { avatarSchema, issueTicket } from '@mini-connecta/shared/ticket';
import type { Response } from 'express';
import { z } from 'zod';
import { AccountGuard, apiError, SessionThrottle, type AccountRequest } from './account-guard';
import { attemptSchema, Metrics } from './metrics';
import { operation } from './openapi';
import { Runtime } from './runtime';

const joinBody = z.strictObject({ attemptId: z.uuid() });
const roomRegistry = z.strictObject({ gameRoomId: z.string().min(1) });
const avatarFields = { displayName: true, preset: true } as const;

@Controller('/api')
@UseGuards(AccountGuard)
export class AppController {
  constructor(
    @Inject(Runtime) private runtime: Runtime,
    @Inject(Metrics) private metrics: Metrics,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @operation('/api/me', 'get')
  async me(@Req() req: AccountRequest) {
    const id = this.user(req);
    const user = { id, ...(req.account?.isGuest && { isGuest: true }) };
    return { user, avatar: await this.avatar(id) };
  }

  @Put('me/avatar')
  @Header('Cache-Control', 'no-store')
  @operation('/api/me/avatar', 'put')
  async saveAvatar(@Req() req: AccountRequest, @Body() raw: unknown) {
    const body = avatarSchema.safeParse(raw);
    if (!body.success) {
      const fields: Record<string, string> = {};
      for (const issue of body.error.issues) {
        if (issue.path[0] === 'displayName') fields.displayName = 'length';
        if (issue.path[0] === 'preset') fields.preset = 'invalid';
      }
      throw apiError(
        400,
        'validation_error',
        body.error.issues[0].path[0] === 'displayName'
          ? 'Enter a display name (1–16 characters).'
          : 'Choose a valid character preset.',
        fields,
      );
    }
    const userId = this.user(req);
    try {
      // One SQL statement preserves the original timestamps on a repeated identical save.
      await this.runtime.db.$executeRaw`
        INSERT INTO "avatars" ("user_id", "display_name", "preset", "updated_at")
        VALUES (${userId}, ${body.data.displayName}, ${body.data.preset}, now())
        ON CONFLICT ("user_id") DO UPDATE
        SET "display_name" = EXCLUDED."display_name", "preset" = EXCLUDED."preset", "updated_at" = now()
        WHERE ("avatars"."display_name", "avatars"."preset")
          IS DISTINCT FROM (EXCLUDED."display_name", EXCLUDED."preset")
      `;
      return body.data;
    } catch {
      throw apiError(503, 'service_unavailable', 'Couldn’t save your character. Try again.');
    }
  }

  @Post('rooms/study-room/join')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(SessionThrottle)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @operation('/api/rooms/study-room/join', 'post')
  async join(@Req() req: AccountRequest, @Body() raw: unknown) {
    const body = joinBody.safeParse(raw);
    if (!body.success) throw apiError(400, 'validation_error', 'Invalid join attempt.');
    const sub = this.user(req);
    const avatar = await this.avatar(sub);
    if (!avatar) throw apiError(409, 'avatar_required', 'Create a character before joining.');
    const env = this.runtime.env;
    let data;
    try {
      const response = await fetch(new URL('/internal/room', env.GAME_INTERNAL_URL), {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error('Room is unavailable');
      data = roomRegistry.parse(await response.json());
    } catch {
      throw apiError(503, 'room_unavailable', 'Couldn’t connect to the Study Room. Try again.');
    }
    const attemptId = body.data.attemptId;
    logEvent('api', 'join_ticket_issued', { attemptId });
    return {
      roomId: 'study-room',
      ...data,
      gameWsUrl: env.GAME_WS_URL,
      ...issueTicket({ ...data, attemptId, sub, avatar }, env.ROOM_JOIN_SECRET),
    };
  }

  @Post('telemetry/room-attempts')
  @HttpCode(204)
  @UseGuards(SessionThrottle)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @operation('/api/telemetry/room-attempts', 'post')
  record(@Req() req: AccountRequest, @Body() raw: unknown) {
    const body = attemptSchema.safeParse(raw);
    if (!body.success) throw apiError(400, 'validation_error', 'Invalid room event.');
    if (req.account && this.metrics.record(req.account.sessionId, body.data) === false) {
      throw apiError(429, 'rate_limited', 'Too many requests. Wait and try again.');
    }
  }

  private user(req: AccountRequest) {
    if (!req.account) throw apiError(401, 'unauthorized', 'Sign in to continue.');
    return req.account.userId;
  }

  private async avatar(userId: string) {
    try {
      const row = await this.runtime.db.avatar.findUnique({
        where: { userId },
        select: avatarFields,
      });
      return row && avatarSchema.parse(row);
    } catch {
      throw apiError(503, 'service_unavailable', 'Couldn’t load your character. Try again.');
    }
  }
}

@Controller()
export class OperationsController {
  constructor(
    @Inject(Runtime) private runtime: Runtime,
    @Inject(Metrics) private metrics: Metrics,
    @Inject(HealthCheckService) private health: HealthCheckService,
    @Inject(HealthIndicatorService) private indicator: HealthIndicatorService,
  ) {}

  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      async () => {
        const db = this.indicator.check('postgres');
        try {
          await this.runtime.db.$queryRaw`SELECT 1 FROM "avatars" LIMIT 1`;
          return db.up();
        } catch {
          return db.down();
        }
      },
    ]);
  }

  @Get('metrics')
  async scrape(@Res() res: Response) {
    res.type(this.metrics.registry.contentType).send(await this.metrics.registry.metrics());
  }
}
