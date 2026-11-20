'use client';

import Image from 'next/image';
import { useRef, useState, type FormEvent } from 'react';
import { usePreviewAccess } from '@/features/auth/preview-account';
import { savePreviewAvatar } from './preview-avatar';
import { PreviewControls } from '@/features/preview/PreviewControls';
import { usePreviewAction } from '@/features/preview/use-preview-action';
import { presets, type Preset } from './presets';

const choices: Preset[] = ['strawberry', 'matcha'];

export function CharacterForm() {
  const { ready } = usePreviewAccess('/character');
  const { pending, start } = usePreviewAction();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<Preset>('strawberry');
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
    start(450, () => {
      if (scenario === 'save-error') setError('Your character couldn’t be saved. Try saving again.');
      else if (!savePreviewAvatar({ name: displayName, preset })) {
        setError('Allow browser storage and try saving again.');
      }
    });
  }

  return (
    <>
      <form className="form-card" id="character-form" aria-labelledby="page-title" onSubmit={submit}>
        <h1 id="page-title">Create your character</h1>
        <p className="lede">Choose how you’ll look in the Study Room.</p>
        <div className="character-options">
          <div className="character-preview">
            <Image src={presets[preset].image} width={145} height={208} alt={presets[preset].label + ' character'} unoptimized />
          </div>
          <div className="character-fields">
            <label htmlFor="display-name">Display name</label>
            <input
              ref={input}
              id="display-name"
              name="displayName"
              value={name}
              onChange={(event) => { setName(event.target.value); setInvalidName(false); setError(''); }}
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
                  <input type="radio" name="preset" value={choice} checked={choice === preset} onChange={() => setPreset(choice)} />
                  <span className={'swatch ' + choice} aria-hidden="true" />
                  {presets[choice].label}
                </label>
              ))}
            </fieldset>
          </div>
        </div>
        {error && <p className="notice error" id="save-error" role="alert">{error}</p>}
        <button className="button primary wide" id="save-character" type="submit" disabled={!ready || pending}>
          {pending ? 'Saving…' : 'Save & continue'}
        </button>
      </form>
      <PreviewControls scenario={scenario} scenarios={[['save-error', 'Character save failed']]} onScenario={setScenario} />
    </>
  );
}
