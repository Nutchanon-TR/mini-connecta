'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { presets, type Preset } from '@/features/avatar/presets';
import { isTheme, usePreviewTheme } from '@/features/preview/PreviewTheme';

export function AccountMenu({
  avatar,
  isGuest,
  onSignOut,
}: {
  avatar: { displayName: string; preset: Preset };
  isGuest: boolean;
  onSignOut: () => Promise<boolean>;
}) {
  const { theme, setTheme } = usePreviewTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);

  async function signOut() {
    setSigningOut(true);
    setError(false);
    if (!(await onSignOut())) {
      setSigningOut(false);
      setError(true);
    }
  }
  const picture = presets[avatar.preset].image;
  return (
    <div className="rail-account">
      <button
        type="button"
        className="rail-account-trigger"
        popoverTarget="account-menu"
        aria-label="Account menu"
      >
        <Image id="account-avatar" src={picture} width={38} height={38} alt="" unoptimized />
        <span id="account-name">{avatar.displayName}</span>
      </button>
      <div id="account-menu" popover="auto" className="rail-account-menu" aria-label="Your profile">
        <div className="account-menu-profile">
          <Image src={picture} width={46} height={46} alt="" unoptimized />
          <div>
            <strong>{avatar.displayName}</strong>
            <p>{isGuest ? 'Guest session' : presets[avatar.preset].label}</p>
          </div>
        </div>
        <Link href="/character/edit" className="account-menu-action">
          Edit character
        </Link>
        <label className="account-menu-theme">
          Appearance
          <select
            value={theme}
            onChange={(event) => {
              if (isTheme(event.target.value)) setTheme(event.target.value);
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <button
          className="account-menu-action account-sign-out"
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        {error && (
          <p className="notice error" role="alert">
            Couldn’t sign out. Try again.
          </p>
        )}
      </div>
    </div>
  );
}
