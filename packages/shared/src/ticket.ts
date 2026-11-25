import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const avatarSchema = z.strictObject({
  displayName: z
    .string()
    .trim()
    .refine((value) => {
      const length = Array.from(value).length;
      return length >= 1 && length <= 16 && !/\p{Cc}/u.test(value);
    }, 'Enter a display name (1–16 characters).'),
  preset: z.enum(['strawberry', 'matcha']),
});

const claimsSchema = z.strictObject({
  iss: z.literal('mini-api'),
  aud: z.literal('mini-game'),
  roomId: z.literal('study-room'),
  gameRoomId: z.string().min(1),
  attemptId: z.uuid(),
  sub: z.string().min(1),
  jti: z.uuid(),
  exp: z.int(),
  avatar: avatarSchema,
});

type Claims = z.infer<typeof claimsSchema>;
type Admission = Pick<Claims, 'gameRoomId' | 'attemptId' | 'sub' | 'avatar'>;

function signature(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest();
}

export function issueTicket(admission: Admission, secret: string, now = Date.now()) {
  const exp = Math.floor(now / 1_000) + 45;
  const claims: Claims = {
    ...admission,
    iss: 'mini-api',
    aud: 'mini-game',
    roomId: 'study-room',
    exp,
    jti: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return {
    joinTicket: payload + '.' + signature(payload, secret).toString('base64url'),
    expiresAt: new Date(exp * 1_000).toISOString(),
  };
}

export function verifyTicket(
  ticket: string,
  gameRoomId: string,
  secret: string,
  now = Date.now(),
): { kind: 'valid'; claims: Claims } | { kind: 'ticket_invalid' | 'ticket_expired' } {
  if (!/^[\w-]+\.[\w-]{43}$/.test(ticket) || ticket.length > 2_048)
    return { kind: 'ticket_invalid' };
  const [payload, mac] = ticket.split('.');
  const provided = Buffer.from(mac, 'base64url');
  const expected = signature(payload, secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
    return { kind: 'ticket_invalid' };

  try {
    const parsed = claimsSchema.safeParse(
      JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
    );
    if (!parsed.success || parsed.data.gameRoomId !== gameRoomId) return { kind: 'ticket_invalid' };
    if (parsed.data.exp * 1_000 <= now) return { kind: 'ticket_expired' };
    return { kind: 'valid', claims: parsed.data };
  } catch {
    return { kind: 'ticket_invalid' };
  }
}
