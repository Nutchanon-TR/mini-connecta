'use client';

import { useEffect, useRef, useState } from 'react';
import { startRoomAttempt } from './attempt';
import type { ActiveGame } from './game-connection';
import { connectVoice, type RoomVoice } from './voice-connection';

export type MicStatus = 'connecting' | 'off' | 'on' | 'blocked' | 'unavailable';

type VoiceAttempt = {
  signal: AbortSignal;
  controller: AbortController;
  voice: Promise<RoomVoice>;
  toggling: boolean;
};

export function useRoomVoice(game: ActiveGame | null) {
  const active = useRef<VoiceAttempt | null>(null);
  const [result, setResult] = useState<{ game: ActiveGame; mic: MicStatus } | null>(null);
  const mic = result?.game === game ? result.mic : 'connecting';
  const [pendingGame, setPendingGame] = useState<ActiveGame | null>(null);
  const pending = game !== null && pendingGame === game;
  const [blockedGame, setBlockedGame] = useState<ActiveGame | null>(null);

  useEffect(() => {
    if (!game) return;
    const attempt = startVoice(
      game,
      () => {
        setResult({ game, mic: 'unavailable' });
        setBlockedGame(null);
      },
      (blocked) => setBlockedGame(blocked ? game : null),
    );
    active.current = attempt;
    void attempt.voice.then(
      () => {
        if (!attempt.signal.aborted) setResult({ game, mic: 'off' });
      },
      () => {
        if (!attempt.signal.aborted) setResult({ game, mic: 'unavailable' });
      },
    );
    return () => active.current?.controller.abort();
  }, [game]);

  async function toggleMic(scenario: string) {
    if (!game || !active.current || active.current.toggling || mic === 'connecting') return;
    let attempt = active.current;
    if (attempt.signal.aborted) return;

    if (scenario === 'mic-denied' || scenario === 'voice-error') {
      setResult({ game, mic: scenario === 'mic-denied' ? 'blocked' : 'unavailable' });
      return;
    }
    if (mic === 'unavailable') {
      attempt.controller.abort();
      attempt = startVoice(
        game,
        () => {
          if (active.current === attempt) setResult({ game, mic: 'unavailable' });
        },
        (blocked) => setBlockedGame(blocked ? game : null),
      );
      active.current = attempt;
    }

    attempt.toggling = true;
    setPendingGame(game);
    const enabled = mic !== 'on';
    try {
      const voice = await attempt.voice;
      await voice.setMic(enabled);
      if (!attempt.signal.aborted) setResult({ game, mic: enabled ? 'on' : 'off' });
    } catch (error) {
      if (!attempt.signal.aborted) {
        const blocked =
          error instanceof Error &&
          (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');
        setResult({ game, mic: blocked ? 'blocked' : 'unavailable' });
      }
    } finally {
      attempt.toggling = false;
      if (!attempt.signal.aborted) setPendingGame(null);
    }
  }

  async function enableAudio() {
    try {
      await (await active.current?.voice)?.enableAudio();
    } catch {
      /* Retry on the next user gesture. */
    }
  }

  return {
    mic,
    pending,
    toggleMic,
    audioBlocked: game !== null && blockedGame === game,
    enableAudio,
  };
}

function startVoice(
  game: ActiveGame,
  onDisconnect: () => void,
  onAudioBlocked: (blocked: boolean) => void,
): VoiceAttempt {
  const controller = new AbortController();
  const signal = AbortSignal.any([game.inputSignal, controller.signal]);
  const connection = startRoomAttempt('voice_connect');
  const cancel = () => connection.finish('cancelled');
  signal.addEventListener('abort', cancel, { once: true });
  const voice = connectVoice(game, signal, onDisconnect, onAudioBlocked).then(
    (connected) => {
      signal.removeEventListener('abort', cancel);
      connection.finish(signal.aborted ? 'cancelled' : 'success');
      return connected;
    },
    (error) => {
      signal.removeEventListener('abort', cancel);
      connection.finish(signal.aborted ? 'cancelled' : 'failed');
      throw error;
    },
  );
  return { controller, signal, voice, toggling: false };
}
