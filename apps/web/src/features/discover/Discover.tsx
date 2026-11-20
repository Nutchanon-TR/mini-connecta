'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { AccountUnavailable } from '@/features/auth/AccountUnavailable';
import { signOutPreview, useAccountAccess } from '@/features/auth/preview-account';
import { isMockApi } from '@/lib/api-mode';
import { queueMockScenario } from '@/lib/mock-api';
import { requestStudyRoomTicket } from './api';
import { enterPreviewRoom } from '@/features/room/preview-room';
import { presets } from '@/features/avatar/presets';
import { PreviewControls } from '@/features/preview/PreviewControls';
import { PreviewTheme } from '@/features/preview/PreviewTheme';
import { useApiAction } from '@/features/preview/use-api-action';

const joinScenarios = [
  ['room-full', 'Room full'],
  ['join-error', 'Connection failed'],
  ['session-expired', 'Session expired'],
] satisfies ReadonlyArray<readonly [string, string]>;

export function Discover() {
  const router = useRouter();
  const { ready, avatar, error: accountError, retry } = useAccountAccess('/discover');
  const { pending, run } = useApiAction();
  const [scenario, setScenario] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  function joinRoom() {
    setError('');
    setScenario('');
    void run(async signal => {
      queueMockScenario('join', scenario);
      const result = await requestStudyRoomTicket({ attemptId: crypto.randomUUID() }, signal);
      if (signal.aborted) return;
      switch (result.kind) {
        case 'sign-in-required':
        case 'character-required':
          retry();
          break;
        case 'retry':
          setError(result.message);
          break;
        case 'ticket-issued':
          if (isMockApi && scenario === 'room-full') {
            setError('Study Room is full. Wait for a spot to open, then try again.');
          } else if (!enterPreviewRoom()) {
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
    <PreviewTheme defaultTheme="dark">
      <div className="page-discover">
        <aside className="discover-rail" aria-label="Mini Connecta">
          <span className="rail-brand" role="img" aria-label="Mini Connecta"><BrandMark discover /></span>
          <nav aria-label="App">
            <Link href="/discover" className="app-link" aria-current="page">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
              </svg>
              Discover
            </Link>
          </nav>
          <details className="rail-account">
            <summary>
              <Image id="account-avatar" src={presets[avatar.preset].image} width={32} height={32} alt="" unoptimized />
              <span id="account-name">{avatar.displayName}</span>
            </summary>
            <div className="rail-account-menu">
              <button className="button quiet small" type="button" onClick={() => { if (!signOutPreview()) setError('Sign-out is unavailable.'); }}>Sign out</button>
            </div>
          </details>
        </aside>
        <main className="discover">
          <div className="discover-content">
            <header className="discover-heading">
              <div>
                <h1>Find your people</h1>
                <p>Walk into one of Connecta’s Common rooms, or find an open room.</p>
              </div>
              <div className="open-room-search">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" />
                </svg>
                <input
                  type="search"
                  aria-label="Search open rooms"
                  placeholder="Search open rooms"
                  aria-controls="open-rooms-status"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </header>

            <section className="discover-section" aria-labelledby="common-rooms-title">
              <h2 id="common-rooms-title">Common rooms</h2>
              <article className="study-card" aria-labelledby="room-title">
                <div className="study-cover">
                  <Image src="/assets/library-art.webp" alt="" width={640} height={640} unoptimized />
                  <span>Common room · by Connecta</span>
                </div>
                <div className="study-details">
                  <h3 id="room-title">Study Room</h3>
                  <p>Cosy Library · Proximity voice</p>
                </div>
                <button className="button primary" type="button" aria-describedby="room-title" onClick={joinRoom} disabled={pending}>
                  {pending ? 'Joining…' : 'Walk in'}
                </button>
                {error && <p className="notice error room-join-error" role="alert">{error}</p>}
              </article>
            </section>

            <section className="discover-section" aria-labelledby="open-rooms-title">
              <h2 id="open-rooms-title">Open rooms</h2>
              <p className="open-rooms-status" id="open-rooms-status" role="status">
                {search.trim() ? 'No open rooms match your search.' : 'No open rooms yet.'}
              </p>
            </section>
          </div>
        </main>
      </div>
      <PreviewControls scenario={scenario} scenarios={isMockApi ? joinScenarios : []} onScenario={setScenario} />
    </PreviewTheme>
  );
}
