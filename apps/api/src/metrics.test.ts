import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { attemptSchema, Metrics } from './metrics';

it('deduplicates terminal events and keeps abandoned starts in the result count', async () => {
  const metrics = new Metrics();
  try {
    const event = {
      kind: 'join',
      phase: 'finish',
      attemptId: randomUUID(),
      outcome: 'success',
      durationMs: 100,
    } as const;
    metrics.record('session', event, 0);
    metrics.record('session', { ...event, phase: 'start' }, 0);
    metrics.record('session', event, 0);
    const start = { kind: 'join', phase: 'start', attemptId: randomUUID() } as const;
    metrics.record('session', start, 0);
    metrics.prune(30_000);
    metrics.record('session', { ...event, attemptId: start.attemptId }, 31_000);
    const output = await metrics.registry.metrics();
    expect(output).toContain('mini_room_attempts_total{kind="join",outcome="success"} 1');
    expect(output).toContain('mini_room_attempts_total{kind="join",outcome="missing_result"} 1');
  } finally {
    metrics.onModuleDestroy();
  }
});

it('accepts and records a voice connection independently of mic publishing', async () => {
  const metrics = new Metrics();
  try {
    const identity = { kind: 'voice_connect', attemptId: randomUUID() } as const;
    const start = attemptSchema.parse({ ...identity, phase: 'start' });
    const finish = attemptSchema.parse({
      ...identity,
      phase: 'finish',
      outcome: 'success',
      durationMs: 340,
    });
    metrics.record('session', start, 0);
    metrics.record('session', finish, 340);
    metrics.record('session', finish, 341);
    const output = await metrics.registry.metrics();
    expect(output).toContain('mini_room_attempts_total{kind="voice_connect",outcome="success"} 1');
    expect(output).toContain('mini_room_attempts_total{kind="voice",outcome="success"} 0');
  } finally {
    metrics.onModuleDestroy();
  }
});
