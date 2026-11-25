import { isMockApi } from '@/lib/api-mode';
import { reportRoomAttempt, type RoomAttemptEvent } from './api';

type Finish = Extract<RoomAttemptEvent, { phase: 'finish' }>;
type Kind = Finish['kind'];
type Outcome<K extends Kind> = (Finish & { kind: K })['outcome'];

export function startRoomAttempt<K extends Kind>(kind: K) {
  const attemptId = crypto.randomUUID();
  const startedAt = performance.now();
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function finish(outcome: Outcome<K>) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (!isMockApi) {
      const common = {
        phase: 'finish' as const,
        attemptId,
        durationMs: performance.now() - startedAt,
      };
      if (kind === 'join') {
        void reportRoomAttempt({ ...common, kind: 'join', outcome });
      } else if (
        outcome === 'success' ||
        outcome === 'cancelled' ||
        outcome === 'timeout' ||
        outcome === 'failed'
      ) {
        void reportRoomAttempt({ ...common, kind, outcome });
      }
    }
  }

  if (!isMockApi) {
    void reportRoomAttempt({ kind, phase: 'start', attemptId });
    timer = setTimeout(() => finish('timeout'), 15_000);
  }
  return { attemptId, finish };
}

export type JoinAttempt = ReturnType<typeof startRoomAttempt<'join'>>;
