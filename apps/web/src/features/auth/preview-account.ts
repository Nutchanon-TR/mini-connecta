'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { isMockApi } from '@/lib/api-mode';
import { readPreview, subscribePreview, writePreview } from '@/features/preview/browser-storage';
import { leavePreviewRoom, readPreviewRoom } from '@/features/room/preview-room';
import { loadCurrentAccount, type AccountState } from './api';

type PreviewRoute = '/login' | '/character' | '/discover' | '/rooms/study-room';

function getDestination(route: PreviewRoute, account: AccountState | null, joined: boolean): PreviewRoute | null {
  if (account?.kind === 'sign-in-required') return route === '/login' ? null : '/login';
  if (account?.kind === 'character-required') return route === '/character' ? null : '/character';
  if (account?.kind !== 'ready') return null;
  if (route === '/login' || route === '/character') return '/discover';
  if (route === '/rooms/study-room' && !joined) return '/discover';
  return null;
}

const readPreviewIdentity = () => isMockApi
  ? JSON.stringify([readPreview('signed-in'), readPreview('profile')])
  : '';
const beforeHydration = () => null;

export function useAccountAccess(route: PreviewRoute) {
  const router = useRouter();
  const identity = useSyncExternalStore(subscribePreview, readPreviewIdentity, beforeHydration);
  const joined = useSyncExternalStore(subscribePreview, readPreviewRoom, beforeHydration);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  const [result, setResult] = useState<{ state: AccountState; identity: string; revision: number } | null>(null);
  const account = result?.identity === identity && result.revision === revision ? result.state : null;
  const destination = getDestination(route, account, joined === true);

  useEffect(() => {
    if (identity === null) return;
    const controller = new AbortController();
    void loadCurrentAccount(controller.signal).then(state => {
      if (!controller.signal.aborted) setResult({ state, identity, revision });
    }).catch(() => {
      if (!controller.signal.aborted) {
        setResult({ state: { kind: 'unavailable', message: 'Couldn’t load your account. Try again.' }, identity, revision });
      }
    });
    return () => controller.abort();
  }, [identity, revision]);

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  return {
    ready: account !== null && account.kind !== 'unavailable' && !destination,
    avatar: account?.kind === 'ready' ? account.avatar : null,
    error: account?.kind === 'unavailable' ? account.message : '',
    retry,
  };
}

export function signInPreview() {
  return isMockApi && writePreview('signed-in', 'true');
}

export function signOutPreview() {
  if (!isMockApi) return false;
  leavePreviewRoom();
  return writePreview('signed-in', null);
}
