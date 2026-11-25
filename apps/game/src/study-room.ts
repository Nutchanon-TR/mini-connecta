import { Room, ServerError, type Client } from '@colyseus/core';
import { MapSchema, schema, t } from '@colyseus/schema';
import { SPAWN } from '@mini-connecta/shared/layout';
import { walk, walkSpeed } from '@mini-connecta/shared/movement';
import { isWalkable } from '@mini-connecta/shared/navigation';
import { joinOptionsSchema, moveMessageSchema } from '@mini-connecta/shared/realtime';
import { logEvent } from '@mini-connecta/shared/server-config';
import { verifyTicket } from '@mini-connecta/shared/ticket';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { config } from './config';
import { players, reconnect, reservations, tick, voice } from './metrics';

const Player = schema({
  displayName: t.string(),
  preset: t.string(),
  x: t.float64(),
  z: t.float64(),
  heading: t.float64(),
  moving: t.boolean(),
  lastMoveSeq: t.float64(),
});
const State = schema({ players: t.map(Player) });
const rtc = new RoomServiceClient(
  config.LIVEKIT_INTERNAL_URL,
  config.LIVEKIT_API_KEY,
  config.LIVEKIT_API_SECRET,
  { requestTimeout: 3 },
);

type Accepted = Extract<ReturnType<typeof verifyTicket>, { kind: 'valid' }>['claims'];
type Member = {
  account: string;
  lastMove: number;
  refill: number;
  budget: number;
  voiceRequest: number;
};

export class StudyRoom extends Room<{ state: InstanceType<typeof State> }> {
  private members = new Map<string, Member>();
  private connected = new Set<string>();
  private cleanup = new Map<string, Promise<unknown>>();
  private reserved = new Map<string, { until: number; ticketId: string }>();
  private used = new Map<string, number>();

  onCreate() {
    this.autoDispose = false;
    this.maxClients = config.ROOM_CAPACITY;
    this.seatReservationTimeout = 10;
    this.state = new State({ players: new MapSchema() });
    this.onMessage('move', (client, raw: unknown) => this.move(client, raw));
    this.onMessage('voice.request', (client, raw: unknown) => {
      if (raw === undefined) void this.grantVoice(client);
    });
    this.setSimulationInterval(() => {
      const end = tick.startTimer();
      const now = Date.now();
      for (const [id, expires] of this.used) if (expires <= now) this.used.delete(id);
      for (const [account, pending] of this.reserved)
        if (pending.until <= now) this.reserved.delete(account);
      reservations.set(this.reserved.size);
      const mono = performance.now();
      for (const [id, member] of this.members) {
        const player = this.state.players.get(id);
        if (player?.moving && mono - member.lastMove > 200) player.moving = false;
      }
      end();
    }, 50);
  }

  private claims(raw: unknown) {
    const options = joinOptionsSchema.safeParse(raw);
    if (!options.success) throw new ServerError(525, 'ticket_invalid');
    const verified = verifyTicket(options.data.joinTicket, this.roomId, config.ROOM_JOIN_SECRET);
    if (verified.kind !== 'valid') throw new ServerError(525, verified.kind);
    return verified.claims;
  }

  async reserve<T>(raw: unknown, allocate: () => Promise<T>) {
    const claims = this.claims(raw);
    if (this.used.has(claims.jti)) throw new ServerError(525, 'ticket_invalid');
    if (
      this.reserved.has(claims.sub) ||
      [...this.members.values()].some((member) => member.account === claims.sub)
    ) {
      throw new ServerError(525, 'already_in_room');
    }
    if (this.locked) throw new ServerError(522, 'room_full');

    this.reserved.set(claims.sub, { until: Date.now() + 11_000, ticketId: claims.jti });
    this.used.set(claims.jti, claims.exp * 1_000);
    try {
      const seat = await allocate();
      logEvent('game', 'seat_reserved', { attemptId: claims.attemptId });
      return seat;
    } catch (error) {
      this.reserved.delete(claims.sub);
      this.used.delete(claims.jti);
      if (this.locked) throw new ServerError(522, 'room_full');
      throw error;
    }
  }

  override onAuth(_client: Client, raw: unknown) {
    const claims = this.claims(raw);
    if (this.reserved.get(claims.sub)?.ticketId !== claims.jti)
      throw new ServerError(525, 'ticket_invalid');
    return claims;
  }

  onJoin(client: Client, _options: unknown, claims: Accepted) {
    if (this.reserved.get(claims.sub)?.ticketId !== claims.jti)
      throw new ServerError(525, 'ticket_invalid');
    this.reserved.delete(claims.sub);
    const now = performance.now();
    const offset = ((this.members.size % 12) - 5) * 0.37;
    const point = { x: SPAWN.x + offset, z: SPAWN.z };
    this.members.set(client.sessionId, {
      account: claims.sub,
      lastMove: now,
      refill: now,
      budget: 0.24,
      voiceRequest: -Infinity,
    });
    this.connected.add(client.sessionId);
    this.state.players.set(
      client.sessionId,
      new Player({
        ...claims.avatar,
        ...(isWalkable(point) ? point : SPAWN),
        heading: 0,
        moving: false,
        lastMoveSeq: 0,
      }),
    );
    players.set(this.members.size);
    logEvent('game', 'game_joined', { attemptId: claims.attemptId });
  }

  onDrop(client: Client) {
    const id = client.sessionId;
    if (!this.members.has(id)) return;
    this.connected.delete(id);
    const player = this.state.players.get(id);
    if (player) player.moving = false;
    this.removeVoice(id);
    reconnect.inc({ outcome: 'started' });
    return this.allowReconnection(client, 20).catch(() => {
      reconnect.inc({ outcome: 'expired' });
    });
  }

  onReconnect(client: Client) {
    this.connected.add(client.sessionId);
    const member = this.members.get(client.sessionId);
    if (member) member.voiceRequest = -Infinity;
    reconnect.inc({ outcome: 'success' });
  }

  onLeave(client: Client) {
    const id = client.sessionId;
    this.connected.delete(id);
    if (this.members.delete(id)) {
      this.state.players.delete(id);
      players.set(this.members.size);
      this.removeVoice(id);
    }
  }

  private move(client: Client, raw: unknown) {
    const id = client.sessionId;
    const member = this.members.get(id);
    const player = this.state.players.get(id);
    if (!member || !player || !this.connected.has(id)) return;
    const parsed = moveMessageSchema.safeParse(raw);
    if (!parsed.success || parsed.data.seq <= player.lastMoveSeq) return;
    const now = performance.now();
    member.budget = Math.min(0.8, member.budget + ((now - member.refill) / 1_000) * walkSpeed);
    member.refill = now;
    const position = walk(player, parsed.data, member.budget);
    const dx = position.x - player.x;
    const dz = position.z - player.z;
    const distance = Math.hypot(dx, dz);
    member.budget -= distance;
    member.lastMove = now;
    if (distance > 0.0001) player.heading = Math.atan2(dx, dz);
    player.moving = distance > 0.0001;
    player.x = position.x;
    player.z = position.z;
    player.lastMoveSeq = parsed.data.seq;
  }

  private async grantVoice(client: Client) {
    const id = client.sessionId;
    const member = this.members.get(id);
    const now = performance.now();
    if (!this.connected.has(id) || !member || now - member.voiceRequest < 1_500) return;
    member.voiceRequest = now;
    try {
      await this.cleanup.get(id);
      const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
        identity: id,
        ttl: '2m',
      });
      token.addGrant({
        room: this.roomId,
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishSources: [TrackSource.MICROPHONE],
        canPublishData: false,
      });
      const jwt = await token.toJwt();
      if (!this.connected.has(id) || this.clients.getById(id) !== client) return;
      client.send('voice.granted', { url: config.LIVEKIT_PUBLIC_URL, token: jwt });
      voice.inc({ outcome: 'granted' });
    } catch {
      if (this.clients.getById(id) === client) client.send('voice.unavailable');
      voice.inc({ outcome: 'unavailable' });
    }
  }

  private removeVoice(id: string) {
    if (this.cleanup.has(id)) return;
    const result = rtc.removeParticipant(this.roomId, id).catch(() => undefined);
    this.cleanup.set(id, result);
    void result.then(() => this.cleanup.delete(id));
  }
}
