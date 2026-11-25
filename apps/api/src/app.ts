import 'reflect-metadata';
import { HttpException, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { logEvent } from '@mini-connecta/shared/server-config';
import { toNodeHandler } from 'better-auth/node';
import express, { type ErrorRequestHandler } from 'express';
import { AccountGuard, SessionThrottle } from './account-guard';
import { AppController, OperationsController } from './app.controller';
import { Metrics } from './metrics';
import { buildOpenApi } from './openapi';
import { Runtime } from './runtime';

@Module({
  imports: [
    TerminusModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
  ],
  controllers: [AppController, OperationsController],
  providers: [Runtime, AccountGuard, SessionThrottle, Metrics],
})
class AppModule {}

const joinRoute = '/api/rooms/study-room/join';
const malformed: ErrorRequestHandler = (_error, _req, res, _next) => {
  res.status(400).json({ error: { code: 'validation_error', message: 'Invalid JSON body.' } });
};

export async function createApp() {
  const server = express();
  server.disable('x-powered-by');
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: false,
    abortOnError: false,
  });
  const runtime = app.get(Runtime);
  const metrics = app.get(Metrics);

  server.use((req, res, next) => {
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (req.path === joinRoute && req.method === 'POST') {
      const start = performance.now();
      res.once('finish', () => {
        const labels = { route: joinRoute, method: req.method, status: String(res.statusCode) };
        metrics.http.inc(labels);
        metrics.latency.observe(labels, (performance.now() - start) / 1_000);
        logEvent('api', 'http_response', labels);
      });
    }
    next();
  });
  server.all('/api/auth/*splat', toNodeHandler(runtime.auth));
  server.use(express.json({ limit: '8kb' }));
  server.use(malformed);
  app.useGlobalFilters({
    catch(error: unknown, host: import('@nestjs/common').ArgumentsHost) {
      const response = host.switchToHttp().getResponse<express.Response>();
      if (error instanceof HttpException) {
        response.status(error.getStatus()).json(error.getResponse());
      } else {
        logEvent('api', 'unhandled_error');
        response
          .status(503)
          .json({ error: { code: 'service_unavailable', message: 'Try again shortly.' } });
      }
    },
  });
  await app.init();
  return { app, runtime, openapi: buildOpenApi(app) };
}
