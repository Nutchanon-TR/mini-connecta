import { api, requestJson } from '@/lib/api';
import type { components } from '@/lib/api.types';

type JoinRequest = components['schemas']['JoinRequest'];
export type StudyRoomTicket = components['schemas']['StudyRoomTicket'];

export type WalkInState =
  | { kind: 'ticket-issued'; ticket: StudyRoomTicket }
  | { kind: 'sign-in-required' }
  | { kind: 'character-required' }
  | { kind: 'retry'; message: string };

export async function requestStudyRoomTicket(
  body: JoinRequest,
  signal?: AbortSignal,
): Promise<WalkInState> {
  const result = await requestJson(() => api.POST('/api/rooms/study-room/join', { body, signal }));
  if (result.ok) return { kind: 'ticket-issued', ticket: result.data };

  const { code, message } = result.failure;
  if (code === 'unauthorized') return { kind: 'sign-in-required' };
  if (code === 'avatar_required') return { kind: 'character-required' };
  return { kind: 'retry', message };
}
