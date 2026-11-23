import { readPreview, writePreview } from '@/features/preview/browser-storage';
import type { StudyRoomTicket } from '@/features/discover/api';

const roomKey = 'joined-study-room';
let handoff: { ticket: StudyRoomTicket; attemptId: string } | null = null;

export const readPreviewRoom = () => readPreview(roomKey, 'session') === 'true';

export function enterPreviewRoom(ticket: StudyRoomTicket, attemptId: string) {
  if (!writePreview(roomKey, 'true', 'session')) return false;
  handoff = { ticket, attemptId };
  return true;
}

export function takeRoomTicket() {
  const pending = handoff;
  handoff = null;
  return pending;
}

export function leavePreviewRoom() {
  handoff = null;
  return writePreview(roomKey, null, 'session');
}
