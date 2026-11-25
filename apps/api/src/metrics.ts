import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';
import { z } from 'zod';

const identity = { attemptId: z.uuid() };
const finish = {
  ...identity,
  phase: z.literal('finish'),
  durationMs: z.number().min(0).max(120_000),
};
const attemptKinds = ['join', 'voice', 'voice_connect'] as const;
const voiceKinds = ['voice', 'voice_connect'] as const;
const voiceOutcomes = ['success', 'cancelled', 'timeout', 'failed'] as const;
const joinOutcomes = [
  ...voiceOutcomes,
  'room_full',
  'already_in_room',
  'auth_required',
  'avatar_required',
] as const;
export const attemptSchema = z.union([
  z.strictObject({ ...identity, phase: z.literal('start'), kind: z.enum(attemptKinds) }),
  z.strictObject({ ...finish, kind: z.enum(voiceKinds), outcome: z.enum(voiceOutcomes) }),
  z.strictObject({
    ...finish,
    kind: z.literal('join'),
    outcome: z.enum(joinOutcomes),
  }),
]);

type Attempt = z.infer<typeof attemptSchema>;
type Recorded = { received: number; kind: Attempt['kind']; done: boolean };
const retention = 600_000;
const maxTracked = 20_000;

@Injectable()
export class Metrics implements OnModuleDestroy {
  readonly registry = new Registry();
  readonly http = new Counter({
    name: 'mini_http_requests_total',
    help: 'Requests by app route and response status',
    labelNames: ['route', 'method', 'status'],
    registers: [this.registry],
  });
  readonly latency = new Histogram({
    name: 'mini_http_request_duration_seconds',
    help: 'App HTTP latency',
    labelNames: ['route', 'method', 'status'],
    buckets: [0.025, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });
  private readonly results = new Counter({
    name: 'mini_room_attempts_total',
    help: 'Terminal attempts by stage and outcome',
    labelNames: ['kind', 'outcome'],
    registers: [this.registry],
  });
  private readonly duration = new Histogram({
    name: 'mini_room_attempt_duration_seconds',
    help: 'Browser attempt duration',
    labelNames: ['kind', 'outcome'],
    buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 15],
    registers: [this.registry],
  });
  private readonly events = new Map<string, Recorded>();
  private readonly timer = setInterval(() => this.prune(), 1_000).unref();

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: 'mini_api_' });
    // Give Prometheus a zero baseline so the first room attempt can show up in increase().
    for (const kind of attemptKinds) {
      const outcomes = kind === 'join' ? joinOutcomes : voiceOutcomes;
      for (const outcome of [...outcomes, 'missing_result']) this.results.inc({ kind, outcome }, 0);
      this.duration.zero({ kind, outcome: 'success' });
    }
  }

  record(sessionId: string, event: Attempt, now = Date.now()) {
    const key = JSON.stringify([sessionId, event.kind, event.attemptId]);
    const previous = this.events.get(key);
    if (previous?.done) return;
    if (!previous && this.events.size >= maxTracked) return false;
    if (event.phase === 'start') {
      if (!previous) this.events.set(key, { received: now, kind: event.kind, done: false });
      return;
    }
    this.events.set(key, { received: now, kind: event.kind, done: true });
    this.results.inc({ kind: event.kind, outcome: event.outcome });
    this.duration.observe({ kind: event.kind, outcome: event.outcome }, event.durationMs / 1_000);
  }

  prune(now = Date.now()) {
    for (const [key, event] of this.events) {
      if (now - event.received >= retention) this.events.delete(key);
      else if (!event.done && now - event.received >= 30_000) {
        this.results.inc({ kind: event.kind, outcome: 'missing_result' });
        event.done = true;
      }
    }
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }
}
