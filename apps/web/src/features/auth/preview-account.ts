'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { PreviewAvatar } from '@/features/avatar/presets';
import { parsePreviewAvatar, readPreviewAvatar } from '@/features/avatar/preview-avatar';
import { readPreview, subscribePreview, writePreview } from '@/features/preview/browser-storage';
import { leavePreviewRoom, readPreviewRoom } from '@/features/room/preview-room';

type PreviewRoute = '/login' | '/character' | '/discover' | '/rooms/study-room';

const readSignedIn = () => readPreview('signed-in') === 'true';
const loading = () => null;

function getDestination(
  route: PreviewRoute,
  signedIn: boolean,
  avatar: PreviewAvatar | null,
  joined: boolean,
): PreviewRoute | null {
  if (!signedIn) return route === '/login' ? null : '/login';
  if (!avatar) return route === '/character' ? null : '/character';
  if (route === '/login' || route === '/character') return '/discover';
  if (route === '/rooms/study-room' && !joined) return '/discover';
  return null;
}

export function usePreviewAccess(route: PreviewRoute) {
  const router = useRouter();
  const signedIn = useSyncExternalStore(subscribePreview, readSignedIn, loading);
  const avatar = parsePreviewAvatar(useSyncExternalStore(subscribePreview, readPreviewAvatar, loading));
  const joined = useSyncExternalStore(subscribePreview, readPreviewRoom, loading);
  const destination = signedIn === null ? null : getDestination(route, signedIn, avatar, joined === true);

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  return { ready: signedIn !== null && !destination, avatar };
}

export function signInPreview() {
  return writePreview('signed-in', 'true');
}

export function signOutPreview() {
  leavePreviewRoom();
  return writePreview('signed-in', null);
}
