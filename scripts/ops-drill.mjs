import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { localSessions, origin, rest } from './fixtures.mjs';

const compose = (...args) =>
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      'compose.yaml',
      '-f',
      'compose.observability.yaml',
      '--profile',
      'observability',
      ...args,
    ],
    { encoding: 'utf8', timeout: 45_000, stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();

const probe = () =>
  compose(
    'exec',
    '-T',
    'api',
    'node',
    '-e',
    'fetch("http://localhost:2568/health/ready").then(r=>console.log(r.status)).catch(()=>console.log(0))',
  );
const alerts = async () =>
  (await (await fetch('http://localhost:9093/api/v2/alerts')).json()).some(
    (alert) => alert.labels.alertname === 'MiniServiceDown' && alert.labels.job === 'api',
  );

async function waitUntil(condition, seconds) {
  for (let i = 0; i < seconds; i++) {
    if (await condition()) return;
    await pause(1_000);
  }
  throw new Error('Drill did not meet expectations in ' + seconds + ' seconds');
}

const [user] = localSessions(1, 'restore-smoke');
assert.equal((await rest(user, '/api/me')).status, 200);
try {
  compose('stop', 'postgres');
  await waitUntil(() => probe() === '503', 15);
  assert.equal((await rest(user, '/api/me')).status, 503);
} finally {
  compose('start', 'postgres');
  await waitUntil(() => probe() === '200', 25);
}
console.log('Postgres down: API readiness and account endpoint returned 503, then recovered.');

try {
  compose('stop', 'api');
  assert.equal((await fetch(origin + '/api/me')).status, 502);
  await waitUntil(alerts, 100);
  console.log('API down: Caddy returned 502 and Alertmanager received MiniServiceDown.');
} finally {
  compose('start', 'api');
  await waitUntil(() => probe() === '200', 25);
  await waitUntil(async () => !(await alerts()), 40);
}
assert.equal((await rest(user, '/api/me')).status, 200);
console.log('API recovered and the alert resolved.');
