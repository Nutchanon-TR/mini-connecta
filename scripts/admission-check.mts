import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from '@colyseus/sdk';
import { localSessions, rest } from './fixtures.mjs';

const users = localSessions(3, 'seats');
for (const user of users) {
  assert.equal(
    (
      await rest(user, '/api/me/avatar', {
        method: 'PUT',
        body: { displayName: user.name, preset: 'matcha' },
      })
    ).status,
    200,
  );
}
async function getTicket(index: number) {
  const response = await rest(users[index], '/api/rooms/study-room/join', {
    method: 'POST',
    body: { attemptId: randomUUID() },
  });
  assert.equal(response.status, 200);
  return await response.json();
}
async function join(ticket: Awaited<ReturnType<typeof getTicket>>) {
  return new Client(ticket.gameWsUrl).joinById(ticket.gameRoomId, {
    joinTicket: ticket.joinTicket,
  });
}
const expired = await getTicket(2);
const first = await join(await getTicket(0));
const second = await join(await getTicket(1));
try {
  await assert.rejects(join(await getTicket(2)), { message: 'room_full' });
  await assert.rejects(join(await getTicket(0)), { message: 'already_in_room' });

  first.reconnection.minUptime = 0;
  const restored = new Promise<void>((resolve) => first.onReconnect.once(() => resolve()));
  void first.leave(false).catch(() => undefined);
  await Promise.race([
    restored,
    sleep(8_000, undefined, { ref: false }).then(() => {
      throw new Error('Reconnect timed out');
    }),
  ]);
  await second.leave();
  const third = await join(await getTicket(2));
  await third.leave();
  console.log('Room capacity, duplicate account, SDK reconnect and seat reuse passed.');
} finally {
  await Promise.allSettled([first.leave(), second.leave()]);
}
await sleep(Math.max(0, Date.parse(expired.expiresAt) - Date.now() + 100));
await assert.rejects(join(expired), { message: 'ticket_expired' });
console.log('Expired ticket rejected.');
