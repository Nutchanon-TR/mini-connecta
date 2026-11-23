import type { ActiveGame } from './game-connection';
import { isMockApi } from '@/lib/api-mode';

export type RoomVoice = {
  setMic: (enabled: boolean) => Promise<void>;
};

export async function connectVoice(
  game: ActiveGame,
  signal: AbortSignal,
  onDisconnect: () => void,
): Promise<RoomVoice> {
  if (isMockApi) return { setMic: async () => signal.throwIfAborted() };

  const grant = await game.requestVoice(signal);
  signal.throwIfAborted();
  if (!grant) throw new Error('Voice unavailable');

  const { Room, RoomEvent, Track } = await import('livekit-client');
  signal.throwIfAborted();

  const room = new Room({ publishDefaults: { stopMicTrackOnMute: true } });
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    room.off(RoomEvent.Disconnected, disconnected);
    room.off(RoomEvent.Reconnecting, disconnected);
    signal.removeEventListener('abort', close);
    // LiveKit owns the published track and stops it when the room disconnects.
    void room.disconnect(true).catch(() => undefined);
  }

  function disconnected() {
    close();
    onDisconnect();
  }

  function ensureOpen() {
    signal.throwIfAborted();
    if (closed) throw new Error('Voice unavailable');
  }

  room.on(RoomEvent.Disconnected, disconnected);
  // An independent voice drop should go through a fresh, muted connection.
  room.on(RoomEvent.Reconnecting, disconnected);
  signal.addEventListener('abort', close, { once: true });
  try {
    // The proximity renderer will select which remote tracks to subscribe to in step 4.
    await room.connect(grant.url, grant.token, {
      autoSubscribe: false,
      maxRetries: 0,
      peerConnectionTimeout: 8_000,
      websocketTimeout: 8_000,
    });
    ensureOpen();
  } catch (error) {
    close();
    throw error;
  }

  return {
    async setMic(enabled) {
      ensureOpen();
      try {
        await room.localParticipant.setMicrophoneEnabled(enabled);
      } finally {
        // A pending permission prompt can finish after leaving the voice room.
        if (closed) {
          room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.stop();
        }
      }
      ensureOpen();
    },
  };
}
