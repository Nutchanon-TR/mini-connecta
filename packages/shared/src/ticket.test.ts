import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { issueTicket, verifyTicket } from './ticket';

const secret = 'local test key used only in the unit test';
const data = {
  sub: 'fixture',
  gameRoomId: 'r1',
  attemptId: randomUUID(),
  avatar: { displayName: 'Player', preset: 'matcha' as const },
};

describe('join ticket admission', () => {
  it('verifies the issuing room, signer and expiry', () => {
    const now = 2_000_000_000_000;
    const { joinTicket } = issueTicket(data, secret, now);
    expect(verifyTicket(joinTicket, 'r1', secret, now)).toMatchObject({
      kind: 'valid',
      claims: data,
    });
    expect(verifyTicket(joinTicket, 'r2', secret, now)).toEqual({ kind: 'ticket_invalid' });
    expect(verifyTicket(joinTicket, 'r1', 'other local test key', now)).toEqual({
      kind: 'ticket_invalid',
    });
    expect(verifyTicket(joinTicket, 'r1', secret, now + 45_000)).toEqual({
      kind: 'ticket_expired',
    });
  });
});
