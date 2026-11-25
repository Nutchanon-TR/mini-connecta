import { execFileSync } from 'node:child_process';

export const origin = 'http://localhost:8080';

export function localSessions(count, prefix) {
  const json = execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'api',
      'pnpm',
      'exec',
      'tsx',
      'scripts/local-sessions.ts',
      String(count),
      prefix,
    ],
    { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  return JSON.parse(json);
}

export function rest(session, path, options = {}) {
  const args = { ...options, signal: AbortSignal.timeout(10_000) };
  args.headers = {
    Origin: origin,
    ...(session ? { Cookie: session.cookie } : {}),
    ...options.headers,
  };
  if (args.body && typeof args.body !== 'string') {
    args.headers['Content-Type'] = 'application/json';
    args.body = JSON.stringify(args.body);
  }
  return fetch(origin + path, args);
}
