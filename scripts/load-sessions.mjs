import { mkdirSync, writeFileSync } from 'node:fs';
import { localSessions, rest } from './fixtures.mjs';

const count = Number(process.argv[2] ?? 30);
const accounts = localSessions(count, 'http-load');
await Promise.all(
  accounts.map(async (person) => {
    const result = await rest(person, '/api/me/avatar', {
      method: 'PUT',
      body: { displayName: person.name, preset: 'matcha' },
    });
    if (!result.ok) throw new Error('Fixture setup failed: HTTP ' + result.status);
  }),
);
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/load-sessions.json', JSON.stringify(accounts), { mode: 0o600 });
console.log(count + ' local load sessions saved in the ignored artifacts directory');
