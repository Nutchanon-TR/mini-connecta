'use client';

import { useState, useSyncExternalStore } from 'react';
import { PreviewControls } from '@/features/preview/PreviewControls';
import { usePreviewAction } from '@/features/preview/use-preview-action';
import { isMockApi } from '@/lib/api-mode';
import { authClient } from './auth-client';
import { AccountUnavailable } from './AccountUnavailable';
import { signInPreview, useAccountAccess } from './preview-account';

const signInScenarios = [
  ['auth-cancel', 'Sign-in cancelled'],
  ['auth-error', 'Sign-in failed'],
] satisfies ReadonlyArray<readonly [string, string]>;

const subscribeToLocation = () => () => undefined;
const readOAuthError = () => new URLSearchParams(window.location.search).get('oauth') === 'failed';
const beforeHydration = () => false;

const cancelled = 'Sign-in cancelled. Continue with Google to try again.';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.1v5.1h6.6c3.9-3.6 6.1-8.9 6.1-14.9Z"
      />
      <path
        fill="#34a853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.6l-6.6-5.1c-1.8 1.2-4.2 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
      />
      <path fill="#fbbc05" d="M12.6 27.8a12 12 0 0 1 0-7.6v-5.3H5.8a20 20 0 0 0 0 18.2l6.8-5.3Z" />
      <path
        fill="#ea4335"
        d="M24 11.8c3 0 5.7 1 7.8 3l5.9-5.9C34.1 5.7 29.5 4 24 4a20 20 0 0 0-18.2 10.9l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"
      />
    </svg>
  );
}

export function SignIn() {
  const { ready, error: accountError, retry } = useAccountAccess('/login');
  const { pending, start, cancel } = usePreviewAction();
  const [scenario, setScenario] = useState('');
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState<'google' | 'guest' | null>(null);
  const oauthFailed = useSyncExternalStore(subscribeToLocation, readOAuthError, beforeHydration);

  async function signIn() {
    setError('');
    if (!isMockApi) {
      setSigningIn('google');
      try {
        const result = await authClient.signIn.social({
          provider: 'google',
          callbackURL: '/discover',
          errorCallbackURL: '/login?oauth=failed',
        });
        if (result.error || !result.data?.url) throw new Error('Sign-in unavailable');
      } catch {
        setError('Sign-in failed. Continue with Google to try again.');
        setSigningIn(null);
      }
      return;
    }
    setScenario('');
    start(700, () => {
      if (scenario === 'auth-cancel') setError(cancelled);
      else if (scenario === 'auth-error')
        setError('Sign-in failed. Continue with Google to try again.');
      else if (!signInPreview()) setError('Allow browser storage and try signing in again.');
    });
  }

  async function continueAsGuest() {
    setError('');
    if (isMockApi) {
      if (!signInPreview(true)) setError('Allow browser storage and try again.');
      return;
    }
    setSigningIn('guest');
    try {
      const { data, error } = await authClient.signIn.anonymous();
      if (error?.status === 429) setError('Too many guest attempts. Wait a minute and try again.');
      else if (error || !data) setError('Couldn’t start a guest session. Try again.');
      else retry();
    } catch {
      setError('Couldn’t start a guest session. Try again.');
    } finally {
      setSigningIn(null);
    }
  }

  const disabled = !ready || pending || signingIn !== null;
  if (accountError) return <AccountUnavailable message={accountError} onRetry={retry} />;

  return (
    <>
      <section className="sign-in-form" aria-labelledby="page-title">
        <h1 id="page-title">Sign in</h1>
        <p className="lede">Choose how to enter the Study Room.</p>
        {(error || (!signingIn && oauthFailed)) && (
          <p className="notice error" id="auth-error" role="alert">
            {error || 'Google sign-in didn’t finish. Try again.'}
          </p>
        )}
        <div className="auth-actions">
          <button
            className="button secondary wide google-button"
            id="sign-in"
            type="button"
            onClick={signIn}
            disabled={disabled}
          >
            <GoogleIcon />
            {pending || signingIn === 'google' ? 'Signing in…' : 'Continue with Google'}
          </button>
          <button
            className="button quiet wide"
            type="button"
            onClick={continueAsGuest}
            disabled={disabled}
          >
            {signingIn === 'guest' ? 'Starting guest session…' : 'Continue as guest'}
          </button>
          {pending && (
            <button
              className="button quiet wide"
              type="button"
              onClick={() => {
                cancel();
                setError(cancelled);
              }}
            >
              Cancel sign-in
            </button>
          )}
        </div>
        <p className="footnote">
          {isMockApi
            ? 'Demo sign-in uses a sample account.'
            : 'Your guest character is cleared when you sign out.'}
        </p>
      </section>
      {isMockApi && (
        <PreviewControls scenario={scenario} scenarios={signInScenarios} onScenario={setScenario} />
      )}
    </>
  );
}
