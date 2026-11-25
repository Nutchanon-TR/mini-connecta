import {
  joinOptionsSchema,
  roomJoinErrorSchema,
  roomSnapshotSchema,
  serverMessageSchemas,
  type MoveMessage,
  type RoomSnapshot,
} from '@mini-connecta/shared/realtime';
import type { StudyRoomTicket } from '@/features/discover/api';
import { isMockApi } from '@/lib/api-mode';

export type VoiceGrant = ReturnType<(typeof serverMessageSchemas)['voice.granted']['parse']>;

export type ActiveGame = {
  inputSignal: AbortSignal;
  sessionId: string;
  readSnapshot: () => RoomSnapshot;
  subscribe: (listener: () => void) => () => void;
  sendMove: (move: MoveMessage) => void;
  requestVoice: (signal: AbortSignal) => Promise<VoiceGrant | null>;
};

type GameEvents = {
  ready: (game: ActiveGame) => void;
  reconnecting: () => void;
  disconnected: () => void;
};

const joinErrorMessages = {
  room_full: 'Study Room is full. Wait for a spot to open, then try again.',
  already_in_room: 'You’re already in the Study Room. Leave the other tab and try again.',
  ticket_invalid: 'This room ticket is invalid. Try connecting again.',
  ticket_expired: 'This room ticket expired. Try connecting again.',
  room_unavailable: 'Study Room is unavailable. Try connecting again.',
};

export function readJoinError(error: unknown) {
  const result = roomJoinErrorSchema.safeParse(error instanceof Error ? error.message : error);
  return result.success ? result.data : 'room_unavailable';
}

export function joinErrorMessage(error: unknown) {
  return joinErrorMessages[readJoinError(error)];
}

function stateValue(state: unknown): unknown {
  if (
    state &&
    typeof state === 'object' &&
    'toJSON' in state &&
    typeof state.toJSON === 'function'
  ) {
    return state.toJSON();
  }
  return state;
}

export async function connectGame(
  ticket: StudyRoomTicket,
  signal: AbortSignal,
  events: GameEvents,
) {
  const options = joinOptionsSchema.parse({ joinTicket: ticket.joinTicket });
  signal.throwIfAborted();

  if (isMockApi) {
    // The preview exercises the same ownership and input cleanup without a socket.
    const snapshot: RoomSnapshot = { players: {} };
    events.ready({
      inputSignal: signal,
      sessionId: 'preview',
      requestVoice: async () => null,
      readSnapshot: () => snapshot,
      subscribe: () => () => undefined,
      sendMove: () => undefined,
    });
    return;
  }

  const { Client } = await import('@colyseus/sdk');
  signal.throwIfAborted();
  const timeout = AbortSignal.timeout(15_000);
  const matchmaking = AbortSignal.any([signal, timeout]);
  const client = new Client(ticket.gameWsUrl, {
    fetchFn: (url, init) => fetch(url, { ...init, credentials: 'omit', signal: matchmaking }),
  });

  const joining = client.joinById<unknown>(ticket.gameRoomId, options);
  // The SDK cannot cancel the seat WebSocket mid-handshake. Release any room that arrives late.
  void joining.then(
    (room) => {
      if (matchmaking.aborted) void room.leave().catch(() => undefined);
    },
    () => undefined,
  );

  const room = await new Promise<Awaited<typeof joining>>((resolve, reject) => {
    function abort() {
      reject(matchmaking.reason);
    }
    matchmaking.addEventListener('abort', abort, { once: true });
    void joining
      .then(resolve, reject)
      .finally(() => matchmaking.removeEventListener('abort', abort));
  });
  if (matchmaking.aborted) {
    void room.leave().catch(() => undefined);
    matchmaking.throwIfAborted();
  }

  let input: AbortController | null = null;
  let stateTimeout: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  let waitingForState = true;
  let latest: RoomSnapshot = { players: {} };
  const listeners = new Set<() => void>();

  function requestVoice(voiceSignal: AbortSignal) {
    const activeSignal = AbortSignal.any([voiceSignal, AbortSignal.timeout(5_000)]);
    activeSignal.throwIfAborted();
    return new Promise<VoiceGrant | null>((resolve, reject) => {
      function finish(grant: VoiceGrant | null) {
        unsubscribeGranted();
        unsubscribeUnavailable();
        activeSignal.removeEventListener('abort', abort);
        resolve(grant);
      }
      function abort() {
        finish(null);
      }
      const unsubscribeGranted = room.onMessage<unknown>('voice.granted', (payload) => {
        const grant = serverMessageSchemas['voice.granted'].safeParse(payload);
        finish(grant.success ? grant.data : null);
      });
      const unsubscribeUnavailable = room.onMessage('voice.unavailable', abort);
      activeSignal.addEventListener('abort', abort, { once: true });
      try {
        room.send('voice.request');
      } catch (error) {
        reject(error);
        finish(null);
      }
    });
  }

  function onState(state: unknown) {
    if (!room.connection?.isOpen || (!waitingForState && !input)) return;
    const snapshot = roomSnapshotSchema.safeParse(stateValue(state));
    if (!snapshot.success || !Object.hasOwn(snapshot.data.players, room.sessionId)) return;

    latest = snapshot.data;
    if (input) {
      listeners.forEach((listener) => listener());
      return;
    }
    waitingForState = false;
    clearTimeout(stateTimeout);
    input = new AbortController();
    const inputSignal = input.signal;
    events.ready({
      inputSignal,
      requestVoice,
      sessionId: room.sessionId,
      readSnapshot: () => latest,
      subscribe(listener) {
        if (inputSignal.aborted) return () => undefined;
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      sendMove(move) {
        if (!inputSignal.aborted && room.connection.isOpen) room.send('move', move);
      },
    });
  }

  function resetInput() {
    input?.abort();
    input = null;
    listeners.clear();
    clearTimeout(stateTimeout);
    clearTimeout(reconnectTimeout);
  }

  function dispose() {
    waitingForState = false;
    resetInput();
    signal.removeEventListener('abort', close);
    window.removeEventListener('pagehide', close);
    room.onStateChange.remove(onState);
    room.onDrop.remove(onDrop);
    room.onReconnect.remove(onReconnect);
    room.onLeave.remove(onLeave);
  }

  function close() {
    dispose();
    void room.leave().catch(() => undefined);
  }

  function onLeave() {
    dispose();
    events.disconnected();
  }

  function timeoutRoom() {
    close();
    events.disconnected();
  }

  function onDrop() {
    waitingForState = false;
    resetInput();
    reconnectTimeout = setTimeout(timeoutRoom, 20_000);
    events.reconnecting();
  }

  function onReconnect() {
    clearTimeout(reconnectTimeout);
    waitingForState = true;
    stateTimeout = setTimeout(timeoutRoom, 5_000);
  }

  room.reconnection.minUptime = 0;
  room.onDrop(onDrop);
  room.onReconnect(onReconnect);
  room.onLeave(onLeave);
  room.onStateChange(onState);
  signal.addEventListener('abort', close, { once: true });
  window.addEventListener('pagehide', close, { once: true });
  stateTimeout = setTimeout(timeoutRoom, 5_000);
  if (room.serializerId !== 'none') onState(room.state);
}
