import { readPreview, writePreview } from '@/features/preview/browser-storage';
import type { StudyRoomTicket } from '@/features/discover/api';

import type { JoinAttempt } from './attempt';

const roomKey = 'joined-study-room';
let handoff: { ticket: StudyRoomTicket; attempt: JoinAttempt } | null = null;

export const readPreviewRoom = () => readPreview(roomKey, 'session') === 'true';

export function enterPreviewRoom(ticket: StudyRoomTicket, attempt: JoinAttempt) {
  if (!writePreview(roomKey, 'true', 'session')) return false;
  handoff = { ticket, attempt };
  return true;
}

export function takeRoomTicket() {
  const pending = handoff;
  handoff = null;
  return pending;
}

export function leavePreviewRoom() {
  handoff?.attempt.finish('cancelled');
  handoff = null;
  return writePreview(roomKey, null, 'session');
}
