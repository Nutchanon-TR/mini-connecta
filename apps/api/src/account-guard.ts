import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { Runtime } from './runtime';

export type AccountRequest = Request & {
  account?: { userId: string; sessionId: string; isGuest: boolean };
};

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) {
  return new HttpException({ error: { code, message, ...(fields && { fields }) } }, status);
}

@Injectable()
export class AccountGuard implements CanActivate {
  constructor(@Inject(Runtime) private readonly runtime: Runtime) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    if (request.method !== 'GET' && request.headers.origin !== this.runtime.env.APP_ORIGIN) {
      throw apiError(400, 'validation_error', 'Request origin is invalid.');
    }
    let session;
    try {
      session = await this.runtime.auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });
    } catch {
      throw apiError(503, 'service_unavailable', 'Couldn’t load your account. Try again.');
    }
    if (!session) throw apiError(401, 'unauthorized', 'Sign in to continue.');
    request.account = {
      userId: session.user.id,
      sessionId: session.session.id,
      isGuest: session.user.isAnonymous === true,
    };
    return true;
  }
}

@Injectable()
export class SessionThrottle extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
  ) {
    super(options, storage, reflector);
  }

  protected override async getTracker(request: AccountRequest): Promise<string> {
    return request.account?.sessionId ?? request.ip ?? 'anonymous';
  }

  protected override async throwThrottlingException(): Promise<never> {
    throw apiError(429, 'rate_limited', 'Too many requests. Wait and try again.');
  }
}
