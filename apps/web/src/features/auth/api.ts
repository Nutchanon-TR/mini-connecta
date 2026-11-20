import { api, requestJson } from '@/lib/api';
import type { components } from '@/lib/api.types';

type CurrentAccount = components['schemas']['CurrentAccount'];

export type AccountState =
  | { kind: 'ready'; user: CurrentAccount['user']; avatar: NonNullable<CurrentAccount['avatar']> }
  | { kind: 'character-required'; user: CurrentAccount['user'] }
  | { kind: 'sign-in-required' }
  | { kind: 'unavailable'; message: string };

export async function loadCurrentAccount(signal?: AbortSignal): Promise<AccountState> {
  const result = await requestJson(() => api.GET('/api/me', { signal }));
  if (!result.ok) {
    return result.failure.code === 'unauthorized'
      ? { kind: 'sign-in-required' }
      : { kind: 'unavailable', message: result.failure.message };
  }

  const { user, avatar } = result.data;
  return avatar ? { kind: 'ready', user, avatar } : { kind: 'character-required', user };
}
