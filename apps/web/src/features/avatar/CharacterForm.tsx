'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { AccountUnavailable } from '@/features/auth/AccountUnavailable';
import { useAccountAccess } from '@/features/auth/preview-account';
import { saveAvatar } from './api';
import { queueMockScenario } from '@/lib/mock-api';
import { isMockApi } from '@/lib/api-mode';
import { PreviewControls } from '@/features/preview/PreviewControls';
import { useApiAction } from '@/features/preview/use-api-action';
import { presets, type Preset } from './presets';

const choices: Preset[] = ['strawberry', 'matcha'];
const saveScenarios = [
  ['save-error', 'Character save failed'],
  ['session-expired', 'Session expired'],
] satisfies ReadonlyArray<readonly [string, string]>;

export function CharacterForm({ editing = false }: { editing?: boolean }) {
  const { ready, avatar, error, retry } = useAccountAccess(
    editing ? '/character/edit' : '/character',
  );
  if (error) return <AccountUnavailable message={error} onRetry={retry} />;
  if (editing && (!ready || !avatar)) return null;

  return (
    <CharacterEditor initial={editing && avatar ? avatar : null} ready={ready} retry={retry} />
  );
}

function CharacterEditor({
  initial,
  ready,
  retry,
}: {
  initial: { displayName: string; preset: Preset } | null;
  ready: boolean;
  retry: () => void;
}) {
  const router = useRouter();
  const { pending, run } = useApiAction();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.displayName ?? '');
  const [preset, setPreset] = useState<Preset>(initial?.preset ?? 'strawberry');
  const [scenario, setScenario] = useState('');
  const [error, setError] = useState('');
  const [invalidName, setInvalidName] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName) {
      setInvalidName(true);
      setError('Enter a display name before continuing.');
      input.current?.focus();
      return;
    }
    setError('');
    setScenario('');
    void run(async (signal) => {
      queueMockScenario('avatar', scenario);
      const result = await saveAvatar({ displayName, preset }, signal);
      if (signal.aborted) return;
      if (result.kind === 'saved' && initial) router.replace('/discover');
      else if (result.kind === 'saved' || result.kind === 'sign-in-required') retry();
      else {
        if (result.kind === 'invalid-input') setInvalidName(Boolean(result.fields?.displayName));
        setError(result.message);
      }
    });
  }

  return (
    <>
      <form
        className="form-card"
        id="character-form"
        aria-labelledby="page-title"
        onSubmit={submit}
      >
        <h1 id="page-title">{initial ? 'Edit your character' : 'Create your character'}</h1>
        <p className="lede">Choose how you’ll look in the Study Room.</p>
        <div className="character-options">
          <div className="character-preview">
            <Image
              src={presets[preset].image}
              width={145}
              height={208}
              alt={presets[preset].label + ' character'}
              unoptimized
            />
          </div>
          <div className="character-fields">
            <label htmlFor="display-name">Display name</label>
            <input
              ref={input}
              id="display-name"
              name="displayName"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setInvalidName(false);
                setError('');
              }}
              maxLength={16}
              autoComplete="nickname"
              placeholder="e.g. Mai"
              aria-invalid={invalidName || undefined}
              aria-describedby={invalidName ? 'save-error' : undefined}
              disabled={pending}
              required
            />
            <fieldset disabled={pending}>
              <legend>Choose a look</legend>
              {choices.map((choice) => (
                <label className="preset" key={choice}>
                  <input
                    type="radio"
                    name="preset"
                    value={choice}
                    checked={choice === preset}
                    onChange={() => setPreset(choice)}
                  />
                  <span className={'swatch ' + choice} aria-hidden="true" />
                  {presets[choice].label}
                </label>
              ))}
            </fieldset>
          </div>
        </div>
        {error && (
          <p className="notice error" id="save-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary wide"
          id="save-character"
          type="submit"
          disabled={!ready || pending}
        >
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Save & continue'}
        </button>
        {initial && (
          <Link href="/discover" className="button quiet wide character-cancel">
            Cancel
          </Link>
        )}
      </form>
      {isMockApi && (
        <PreviewControls scenario={scenario} scenarios={saveScenarios} onScenario={setScenario} />
      )}
    </>
  );
}
