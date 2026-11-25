'use client';

import { useRef } from 'react';
import { isTheme, usePreviewTheme } from './PreviewTheme';

type PreviewControlsProps = {
  scenario: string;
  scenarios: ReadonlyArray<readonly [value: string, label: string]>;
  onScenario: (value: string) => void;
  onDisconnect?: () => void;
};

export function PreviewControls({
  scenario,
  scenarios,
  onScenario,
  onDisconnect,
}: PreviewControlsProps) {
  const details = useRef<HTMLDetailsElement>(null);
  const { theme, setTheme } = usePreviewTheme();

  return (
    <details className="preview-controls" ref={details}>
      <summary>
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4" />
        </svg>
        <span>Preview controls</span>
      </summary>
      <div className="preview-panel">
        <label htmlFor="preview-theme">Theme</label>
        <select
          id="preview-theme"
          value={theme}
          onChange={(event) => {
            const value = event.target.value;
            if (isTheme(value)) setTheme(value);
          }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        {scenarios.length > 0 && (
          <>
            <label htmlFor="preview-scenario">Next demo action</label>
            <select
              id="preview-scenario"
              value={scenario}
              onChange={(event) => onScenario(event.target.value)}
            >
              <option value="">Normal</option>
              {scenarios.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </>
        )}
        {onDisconnect && (
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              if (details.current) details.current.open = false;
              onDisconnect();
            }}
          >
            Simulate disconnect
          </button>
        )}
      </div>
    </details>
  );
}
