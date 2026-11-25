'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { AccountUnavailable } from '@/features/auth/AccountUnavailable';
import { authClient } from '@/features/auth/auth-client';
import { signOutPreview, useAccountAccess } from '@/features/auth/preview-account';
import { PreviewControls } from '@/features/preview/PreviewControls';
import { PreviewTheme } from '@/features/preview/PreviewTheme';
import { useApiAction } from '@/features/preview/use-api-action';
import { startRoomAttempt } from '@/features/room/attempt';
import { enterPreviewRoom, leavePreviewRoom } from '@/features/room/preview-room';
import { isMockApi } from '@/lib/api-mode';
import { queueMockScenario } from '@/lib/mock-api';
import { AccountMenu } from './AccountMenu';
import { requestStudyRoomTicket } from './api';

const joinScenarios = [
  ['room-full', 'Room full'],
  ['join-error', 'Connection failed'],
  ['session-expired', 'Session expired'],
] satisfies ReadonlyArray<readonly [string, string]>;

export function Discover() {
  const router = useRouter();
  const { ready, avatar, isGuest, error: accountError, retry } = useAccountAccess('/discover');
  const { pending, run } = useApiAction();
  const [scenario, setScenario] = useState('');
  const [error, setError] = useState('');

  async function signOut() {
    if (isMockApi) return signOutPreview();
    try {
      const result = isGuest ? await authClient.deleteAnonymousUser() : await authClient.signOut();
      if (result.error) return false;
      leavePreviewRoom();
      retry();
      return true;
    } catch {
      return false;
    }
  }

  function joinRoom() {
    setError('');
    setScenario('');
    void run(async (signal) => {
      queueMockScenario('join', scenario);
      const attempt = startRoomAttempt('join');
      const result = await requestStudyRoomTicket({ attemptId: attempt.attemptId }, signal);
      if (signal.aborted) {
        attempt.finish('cancelled');
        return;
      }
      switch (result.kind) {
        case 'sign-in-required':
        case 'character-required':
          attempt.finish(result.kind === 'sign-in-required' ? 'auth_required' : 'avatar_required');
          retry();
          break;
        case 'retry':
          attempt.finish('failed');
          setError(result.message);
          break;
        case 'ticket-issued':
          if (isMockApi && scenario === 'room-full') {
            attempt.finish('room_full');
            setError('Study Room is full. Wait for a spot to open, then try again.');
          } else if (!enterPreviewRoom(result.ticket, attempt)) {
            attempt.finish('failed');
            setError('Couldn’t open the Study Room on this device. Try joining again.');
          } else {
            router.replace('/rooms/study-room');
          }
      }
    });
  }

  if (accountError) return <AccountUnavailable message={accountError} onRetry={retry} />;
  if (!ready || !avatar) return null;

  return (
    <PreviewTheme defaultTheme="light">
      <div className="page-discover">
        <aside className="discover-rail" aria-label="Mini Connecta">
          <Link href="/" className="rail-brand" aria-label="Mini Connecta home">
            <BrandMark discover />
          </Link>
          <nav aria-label="App">
            <Link
              href="/discover"
              className="app-link"
              aria-current="page"
              aria-label="Discover"
              title="Discover"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
              </svg>
            </Link>
          </nav>
          <AccountMenu avatar={avatar} isGuest={isGuest} onSignOut={signOut} />
        </aside>
        <main className="discover">
          <div className="discover-content">
            <header className="discover-heading">
              <h1>Find your people</h1>
              <p>Walk into the Study Room to study alongside others.</p>
            </header>
            <section className="discover-section" aria-labelledby="common-rooms-title">
              <h2 id="common-rooms-title">Common rooms</h2>
              <article className="study-card" aria-labelledby="room-title">
                <div className="study-cover">
                  <Image
                    src="/assets/library-art.webp"
                    alt=""
                    width={640}
                    height={640}
                    unoptimized
                  />
                  <span>Common room</span>
                </div>
                <div className="study-details">
                  <h3 id="room-title">Study Room</h3>
                  <p>Walk around the library and talk with people nearby.</p>
                  <button
                    className="button primary"
                    type="button"
                    aria-describedby="room-title"
                    onClick={joinRoom}
                    disabled={pending}
                  >
                    {pending ? 'Joining…' : 'Walk in'}
                  </button>
                  {error && (
                    <p className="notice error room-join-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              </article>
            </section>
            <section className="discover-section" aria-labelledby="open-rooms-title">
              <h2 id="open-rooms-title">Open rooms</h2>
              <p className="open-rooms-status" role="status">
                No open rooms yet.
              </p>
            </section>
          </div>
        </main>
      </div>
      {isMockApi && (
        <PreviewControls scenario={scenario} scenarios={joinScenarios} onScenario={setScenario} />
      )}
    </PreviewTheme>
  );
}
