import { api, requestJson } from '@/lib/api';
import type { components } from '@/lib/api.types';

export type Avatar = components['schemas']['Avatar'];

export type SaveAvatarState =
  | { kind: 'saved'; avatar: Avatar }
  | { kind: 'sign-in-required' }
  | { kind: 'invalid-input'; message: string; fields?: Readonly<Record<string, string>> }
  | { kind: 'unavailable'; message: string };

export async function saveAvatar(avatar: Avatar, signal?: AbortSignal): Promise<SaveAvatarState> {
  const body = { ...avatar, displayName: avatar.displayName.trim() };
  const result = await requestJson(() => api.PUT('/api/me/avatar', { body, signal }));
  if (result.ok) return { kind: 'saved', avatar: result.data };

  const { code, message, fields } = result.failure;
  if (code === 'unauthorized') return { kind: 'sign-in-required' };
  if (code === 'validation_error') return { kind: 'invalid-input', message, fields };
  return { kind: 'unavailable', message };
}
