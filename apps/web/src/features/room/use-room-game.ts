'use client';

import { useEffect, useRef, useState } from 'react';
import { requestStudyRoomTicket } from '@/features/discover/api';
import { connectGame, joinErrorMessage, readJoinError, type ActiveGame } from './game-connection';
import { startRoomAttempt } from './attempt';
import { leavePreviewRoom, takeRoomTicket } from './preview-room';

type GameStatus =
  | { kind: 'connecting' | 'reconnecting' }
  | { kind: 'ready'; game: ActiveGame; sceneReady: () => void }
  | { kind: 'disconnected'; message: string };

export function useRoomGame({ onAccountChanged }: { onAccountChanged: () => void }) {
  const [status, setStatus] = useState<GameStatus>({ kind: 'connecting' });
  const [revision, setRevision] = useState(0);
  const current = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    current.current = controller;

    function disconnected(message: string) {
      if (!signal.aborted) setStatus({ kind: 'disconnected', message });
    }

    async function connect() {
      // Let route cleanup run before consuming a one-use handoff on a discarded mount.
      await Promise.resolve();
      if (signal.aborted) return;
      const handoff = takeRoomTicket();
      const join = handoff?.attempt ?? startRoomAttempt('join');
      const attemptId = join.attemptId;
      signal.addEventListener('abort', () => join.finish('cancelled'), { once: true });

      for (let attempt = 0; attempt < 2; attempt++) {
        const result =
          attempt === 0 && handoff
            ? { kind: 'ticket-issued' as const, ticket: handoff.ticket }
            : await requestStudyRoomTicket({ attemptId }, signal);
        if (signal.aborted) return;

        if (result.kind === 'sign-in-required' || result.kind === 'character-required') {
          join.finish(result.kind === 'sign-in-required' ? 'auth_required' : 'avatar_required');
          onAccountChanged();
          leavePreviewRoom();
          return;
        }
        if (result.kind === 'retry') {
          join.finish('failed');
          disconnected(result.message);
          return;
        }
        if (Date.parse(result.ticket.expiresAt) <= Date.now()) {
          if (attempt === 0) continue;
          join.finish('failed');
          disconnected(joinErrorMessage('ticket_expired'));
          return;
        }

        try {
          await connectGame(result.ticket, signal, {
            ready: (game) =>
              setStatus({ kind: 'ready', game, sceneReady: () => join.finish('success') }),
            reconnecting: () => setStatus({ kind: 'reconnecting' }),
            disconnected: () => {
              join.finish('failed');
              disconnected('Try again to return to the Study Room.');
            },
          });
          return;
        } catch (error) {
          const reason = readJoinError(error);
          if (attempt === 0 && reason === 'ticket_expired') continue;
          join.finish(reason === 'room_full' || reason === 'already_in_room' ? reason : 'failed');
          disconnected(joinErrorMessage(error));
          return;
        }
      }
    }

    void connect().catch((error) => disconnected(joinErrorMessage(error)));
    return () => controller.abort();
  }, [onAccountChanged, revision]);

  function simulateDisconnect() {
    current.current?.abort();
    setStatus({ kind: 'disconnected', message: 'Try again to return to the Study Room.' });
  }

  function reconnect() {
    current.current?.abort();
    setStatus({ kind: 'connecting' });
    setRevision((value) => value + 1);
  }

  function leave() {
    current.current?.abort();
    leavePreviewRoom();
  }

  return { status, simulateDisconnect, reconnect, leave };
}
