'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { readPreview, subscribePreview, writePreview } from './browser-storage';

type Theme = 'system' | 'light' | 'dark';

const ThemeContext = createContext<Theme>('system');
const darkQuery = '(prefers-color-scheme: dark)';
function readTheme() {
  const saved = readPreview('theme');
  if (!saved) return null;
  try {
    const theme: unknown = JSON.parse(saved);
    return typeof theme === 'string' ? theme : null;
  } catch {
    return null;
  }
}
const prefersDark = () => window.matchMedia(darkQuery).matches;

function subscribeSystemTheme(callback: () => void) {
  const media = window.matchMedia(darkQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function PreviewTheme({
  children,
  defaultTheme,
}: {
  children: ReactNode;
  defaultTheme: Theme;
}) {
  const savedTheme = useSyncExternalStore(subscribePreview, readTheme, () => null);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, prefersDark, () => false);
  const theme = isTheme(savedTheme) ? savedTheme : defaultTheme;
  const color = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  return (
    <ThemeContext.Provider value={theme}>
      <div className="preview-page" data-theme={color}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function usePreviewTheme() {
  const theme = useContext(ThemeContext);
  return { theme, setTheme: (value: Theme) => writePreview('theme', JSON.stringify(value)) };
}
