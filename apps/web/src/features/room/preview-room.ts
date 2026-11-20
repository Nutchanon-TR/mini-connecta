import { readPreview, writePreview } from '@/features/preview/browser-storage';

const roomKey = 'joined-study-room';

export const readPreviewRoom = () => readPreview(roomKey, 'session') === 'true';

export function enterPreviewRoom() {
  return writePreview(roomKey, 'true', 'session');
}

export function leavePreviewRoom() {
  return writePreview(roomKey, null, 'session');
}
