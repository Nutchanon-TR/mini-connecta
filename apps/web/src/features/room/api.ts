import { api } from '@/lib/api';
import type { components } from '@/lib/api.types';

export type RoomAttemptEvent = components['schemas']['RoomAttemptEvent'];

export async function reportRoomAttempt(body: RoomAttemptEvent): Promise<boolean> {
  try {
    const { response } = await api.POST('/api/telemetry/room-attempts', { body, keepalive: true });
    return response.status === 204;
  } catch {
    return false;
  }
}
