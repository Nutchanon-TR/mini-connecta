import { voiceVolume } from '@mini-connecta/shared/movement';
import { isMockApi } from '@/lib/api-mode';
import { startRoomAttempt } from './attempt';
import type { ActiveGame } from './game-connection';

export type RoomVoice = {
  setMic: (enabled: boolean) => Promise<void>;
  enableAudio: () => Promise<void>;
};

export async function connectVoice(
  game: ActiveGame,
  signal: AbortSignal,
  onDisconnect: () => void,
  onAudioBlocked: (blocked: boolean) => void,
): Promise<RoomVoice> {
  if (isMockApi)
    return { setMic: async () => signal.throwIfAborted(), enableAudio: async () => undefined };

  const grant = await game.requestVoice(signal);
  signal.throwIfAborted();
  if (!grant) throw new Error('Voice unavailable');

  const { Room, RoomEvent, Track, createLocalAudioTrack } = await import('livekit-client');
  type RemoteTrack = import('livekit-client').RemoteTrack;
  type LocalAudioTrack = import('livekit-client').LocalAudioTrack;
  signal.throwIfAborted();

  const room = new Room();
  const audio = new Map<RemoteTrack, { identity: string; element: HTMLMediaElement }>();
  let microphone: LocalAudioTrack | null = null;
  let closed = false;

  function updateVolume() {
    const snapshot = game.readSnapshot();
    const local = snapshot.players[game.sessionId];
    for (const { element, identity } of audio.values()) {
      const peer = snapshot.players[identity];
      element.volume =
        local && peer ? voiceVolume(Math.hypot(local.x - peer.x, local.z - peer.z)) : 0;
    }
  }

  function detach(track: RemoteTrack) {
    const entry = audio.get(track);
    if (!entry) return;
    track.detach(entry.element);
    entry.element.remove();
    audio.delete(track);
  }

  function attach(
    track: RemoteTrack,
    publication: import('livekit-client').RemoteTrackPublication,
    participant: import('livekit-client').RemoteParticipant,
  ) {
    if (closed || publication.source !== Track.Source.Microphone || track.kind !== Track.Kind.Audio)
      return;
    const element = document.createElement('audio');
    element.setAttribute('data-room-audio', participant.identity);
    element.volume = 0;
    document.body.append(element);
    audio.set(track, { element, identity: participant.identity });
    updateVolume();
    track.attach(element);
  }

  function playbackChanged() {
    if (!closed) onAudioBlocked(!room.canPlaybackAudio);
  }

  const unsubscribe = game.subscribe(updateVolume);
  function close() {
    if (closed) return;
    closed = true;
    unsubscribe();
    for (const track of audio.keys()) detach(track);
    microphone?.stop();
    microphone = null;
    room.off(RoomEvent.TrackSubscribed, attach);
    room.off(RoomEvent.TrackUnsubscribed, detach);
    room.off(RoomEvent.AudioPlaybackStatusChanged, playbackChanged);
    room.off(RoomEvent.Disconnected, disconnected);
    room.off(RoomEvent.Reconnecting, disconnected);
    signal.removeEventListener('abort', close);
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

  room.on(RoomEvent.TrackSubscribed, attach);
  room.on(RoomEvent.TrackUnsubscribed, detach);
  room.on(RoomEvent.AudioPlaybackStatusChanged, playbackChanged);
  room.on(RoomEvent.Disconnected, disconnected);
  room.on(RoomEvent.Reconnecting, disconnected);
  signal.addEventListener('abort', close, { once: true });

  try {
    await room.connect(grant.url, grant.token, {
      autoSubscribe: true,
      maxRetries: 0,
      peerConnectionTimeout: 8_000,
      websocketTimeout: 8_000,
    });
    ensureOpen();
    playbackChanged();
  } catch (error) {
    close();
    throw error;
  }

  return {
    async enableAudio() {
      ensureOpen();
      await room.startAudio();
      playbackChanged();
    },
    async setMic(enabled) {
      ensureOpen();
      if (!enabled) {
        if (microphone) {
          microphone.stop();
          const previous = microphone;
          microphone = null;
          await room.localParticipant.unpublishTrack(previous);
        }
        return;
      }
      const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true });
      const attempt = startRoomAttempt('voice');
      try {
        ensureOpen();
        microphone = track;
        await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
        ensureOpen();
        attempt.finish('success');
      } catch (error) {
        track.stop();
        if (microphone === track) microphone = null;
        attempt.finish(signal.aborted ? 'cancelled' : 'failed');
        throw error;
      }
    },
  };
}
