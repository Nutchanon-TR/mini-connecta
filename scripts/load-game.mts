import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from '@colyseus/sdk';
import { roomSnapshotSchema } from '../packages/shared/src/realtime.ts';
import { localSessions, rest } from './fixtures.mjs';

const count = Number(process.argv[2] ?? 5);
const seconds = Number(process.argv[3] ?? 10);
assert(Number.isInteger(count) && count >= 2 && count <= 30 && seconds > 0 && seconds <= 120);
const users = localSessions(count, 'bots');
const joins: number[] = [];
const acknowledgements: number[] = [];
const bots: Awaited<ReturnType<Client['joinById']>>[] = [];
let unexpectedLeave = 0;
let dropped = 0;

function state(raw: unknown) {
  const value =
    raw && typeof raw === 'object' && 'toJSON' in raw && typeof raw.toJSON === 'function'
      ? raw.toJSON()
      : raw;
  const result = roomSnapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}

try {
  const joined = await Promise.allSettled(
    users.map(async (user) => {
      const saved = await rest(user, '/api/me/avatar', {
        method: 'PUT',
        body: { displayName: user.name, preset: 'matcha' },
      });
      assert.equal(saved.status, 200);
      const start = performance.now();
      const result = await rest(user, '/api/rooms/study-room/join', {
        method: 'POST',
        body: { attemptId: randomUUID() },
      });
      assert.equal(result.status, 200);
      const ticket = await result.json();
      const client = new Client(ticket.gameWsUrl);
      const room = await client.joinById(ticket.gameRoomId, { joinTicket: ticket.joinTicket });
      bots.push(room);
      room.onDrop(() => {
        dropped++;
      });
      room.onLeave((code) => {
        if (code !== 4000) unexpectedLeave++;
      });
      for (let i = 0; i < 100 && !state(room.state)?.players[room.sessionId]; i++) {
        await sleep(20);
      }
      assert(state(room.state)?.players[room.sessionId]);
      joins.push(performance.now() - start);
      return room;
    }),
  );
  for (const result of joined) if (result.status === 'rejected') throw result.reason;
  const stopAt = performance.now() + seconds * 1000;
  await Promise.all(
    bots.map(async (room, i) => {
      let seq = 0;
      const queued = new Map<number, number>();
      room.onStateChange((raw) => {
        const me = state(raw)?.players[room.sessionId];
        if (!me) return;
        const sent = queued.get(me.lastMoveSeq);
        if (sent !== undefined) acknowledgements.push(performance.now() - sent);
        for (const num of queued.keys()) if (num <= me.lastMoveSeq) queued.delete(num);
      });
      while (performance.now() < stopAt) {
        const me = state(room.state)?.players[room.sessionId];
        if (me) {
          queued.set(++seq, performance.now());
          room.send('move', {
            seq,
            x: me.x + Math.sin(seq / 36 + i) * 0.24,
            z: me.z + Math.cos(seq / 31 + i) * 0.24,
          });
        }
        await sleep(70);
      }
    }),
  );
} finally {
  await Promise.allSettled(bots.map((room) => room.leave()));
}

function percentile(samples: number[]) {
  const sorted = samples.toSorted((a, b) => a - b);
  return Math.round((sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0) * 10) / 10;
}
assert.equal(joins.length, count);
assert(acknowledgements.length > count);
console.log(
  JSON.stringify({
    users: count,
    seconds,
    joinSamples: joins.length,
    joinP95Ms: percentile(joins),
    movementSamples: acknowledgements.length,
    movementAckP95Ms: percentile(acknowledgements),
    dropped,
    unexpectedLeave,
  }),
);
