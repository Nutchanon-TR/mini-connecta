'use client';

import Image from 'next/image';
import { useState } from 'react';
import { AccountUnavailable } from '@/features/auth/AccountUnavailable';
import { useAccountAccess } from '@/features/auth/preview-account';
import { leavePreviewRoom } from './preview-room';
import { PreviewControls } from '@/features/preview/PreviewControls';
import { PreviewTheme } from '@/features/preview/PreviewTheme';
import { usePreviewAction } from '@/features/preview/use-preview-action';
import { RoomHud } from './RoomHud';

const voiceScenarios = [
  ['mic-denied', 'Microphone denied'],
  ['voice-error', 'Voice unavailable'],
] satisfies ReadonlyArray<readonly [string, string]>;

const micLabels = {
  off: 'Mic off',
  on: 'Mic on',
  blocked: 'Mic blocked',
  unavailable: 'Voice unavailable',
};

const voiceErrors = {
  blocked: 'Microphone access is blocked. Allow it in site settings, then try again.',
  unavailable: 'Voice couldn’t connect. You can stay in the room and try the mic again.',
};

function MicIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {on ? (
        <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3" /></>
      ) : (
        <path d="M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M9 5a3 3 0 0 1 6 1v5m4 0v1a7 7 0 0 1-.6 2.8M5 11v1a7 7 0 0 0 12 4.9M12 19v3" />
      )}
    </svg>
  );
}

export function StudyRoom() {
  const { ready, avatar, error: accountError, retry } = useAccountAccess('/rooms/study-room');
  const { pending, start, cancel } = usePreviewAction();
  const [scenario, setScenario] = useState('');
  const [connected, setConnected] = useState(true);
  const [mic, setMic] = useState<keyof typeof micLabels>('off');

  function disconnect() {
    cancel();
    setConnected(false);
    setMic('off');
  }

  function toggleMic() {
    if (mic === 'on') {
      setMic('off');
      return;
    }
    setScenario('');
    setMic(scenario === 'mic-denied' ? 'blocked' : scenario === 'voice-error' ? 'unavailable' : 'on');
  }

  if (accountError) return <AccountUnavailable message={accountError} onRetry={retry} />;
  if (!ready || !avatar) return null;

  const error = mic === 'blocked' || mic === 'unavailable' ? voiceErrors[mic] : '';
  return (
    <PreviewTheme defaultTheme="dark">
      <main className="room-preview" aria-label="Study Room preview">
        <picture className="room-scene">
          <source srcSet="/assets/library-room-mobile.png" media="(max-width: 640px)" />
          <Image src="/assets/library-room.png" width={1440} height={1000} alt="Isometric preview of the Cosy Library" loading="eager" unoptimized />
        </picture>
        <RoomHud playerName={avatar.displayName} onLeave={() => { leavePreviewRoom(); }} />
        {!connected && (
          <section className="room-reconnect" aria-labelledby="reconnect-title">
            <h2 id="reconnect-title">Connection lost</h2>
            <p role="status">{pending ? 'Connecting to the Study Room.' : 'Try again to return to the Study Room.'}</p>
            <button className="button primary" type="button" onClick={() => start(700, () => setConnected(true))} disabled={pending}>
              {pending ? 'Reconnecting…' : 'Reconnect'}
            </button>
          </section>
        )}
        <div className="room-bottom">
          {error && <p className="notice error room-notice" role="alert">{error}</p>}
          <div className="room-dock">
            <button className="button hud-button" type="button" aria-pressed={mic === 'on'} onClick={toggleMic} disabled={!connected}>
              <MicIcon on={mic === 'on'} />
              {mic === 'on' ? 'Turn mic off' : 'Turn mic on'}
            </button>
            <span id="voice-status" role="status">{connected ? micLabels[mic] : 'Room disconnected'}</span>
          </div>
        </div>
      </main>
      <PreviewControls scenario={scenario} scenarios={voiceScenarios} onScenario={setScenario} onDisconnect={disconnect} />
    </PreviewTheme>
  );
}
