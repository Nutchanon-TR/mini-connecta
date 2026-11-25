import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium } from 'playwright';
import { localSessions, origin, rest } from './fixtures.mjs';

const users = localSessions(2, 'e2e');
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
  args: [
    '--mute-audio',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--enable-unsafe-swiftshader',
  ],
});

const cases = [];
const problems = [];
const roomResults = [];
const peer = (page, name) => page.locator('.room-presence [title=' + JSON.stringify(name) + ']');

async function room(person, name) {
  const ctx = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1100, height: 720 },
  });
  await ctx.addCookies(person.cookies);
  const page = await ctx.newPage();
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('response', (response) => {
    if (
      response.status() !== 204 ||
      new URL(response.url()).pathname !== '/api/telemetry/room-attempts'
    )
      return;
    const { phase, kind, outcome } = response.request().postDataJSON();
    if (phase === 'finish') roomResults.push({ name, kind, outcome });
  });
  if (process.env.E2E_TRACE) {
    page.on('requestfailed', (request) =>
      console.log('Request failed', new URL(request.url()).pathname, request.failure()),
    );
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text().replace(/(wss?:\/\/[^\s'?]+)\?[^\s']+/g, '$1?[redacted]');
        console.log('Browser:', text);
      }
    });
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.startsWith('/matchmake'))
        console.log('Matchmaking:', response.status());
    });
  }
  await page.goto(origin + '/discover');
  await page.waitForURL(/\/(discover|character)$/);
  if (page.url().endsWith('/character')) {
    await page.getByLabel('Display name').fill(name);
    await page.getByRole('button', { name: 'Save & continue' }).click();
    await page.waitForURL(origin + '/discover');
  }
  assert.equal((await (await rest(person, '/api/me')).json()).avatar.displayName, name);
  const start = performance.now();
  const matchmaking = page.waitForResponse(
    (res) => res.ok() && new URL(res.url()).pathname.startsWith('/matchmake/joinById/'),
  );
  await page.getByRole('button', { name: 'Walk in' }).click();
  try {
    await page.locator('.room-canvas canvas').waitFor({ timeout: 12_000 });
  } catch (error) {
    console.error(await page.locator('main').innerText(), problems);
    throw error;
  }
  cases.push({ check: 'join', ms: Math.round(performance.now() - start) });
  await page.getByText('Mic off', { exact: true }).waitFor({ timeout: 20_000 });
  const { sessionId } = await (await matchmaking).json();
  assert.equal(typeof sessionId, 'string');
  return { page, sessionId };
}

try {
  const guest = await browser.newPage();
  await guest.goto(origin + '/discover');
  await guest.waitForURL(origin + '/login');
  await guest.close();

  const { page: alice, sessionId: aliceId } = await room(users[0], 'Test One');
  const { page: bob } = await room(users[1], 'Test Two');
  const aliceAudio = 'audio[data-room-audio=' + JSON.stringify(aliceId) + ']';
  await peer(alice, 'Test Two').waitFor();
  await peer(bob, 'Test One').waitFor();
  const start = performance.now();
  await alice.getByRole('button', { name: 'Turn mic on' }).click();
  await alice.getByText('Mic on', { exact: true }).waitFor();
  await bob.waitForFunction((selector) => {
    const audio = document.querySelector(selector);
    return (
      audio?.volume > 0.9 &&
      audio.srcObject?.getAudioTracks().some((track) => track.readyState === 'live')
    );
  }, aliceAudio);
  cases.push({ check: 'mic plus remote track', ms: Math.round(performance.now() - start) });

  await alice.locator('canvas').click({ position: { x: 550, y: 610 } });
  await alice.keyboard.down('KeyD');
  try {
    await bob.waitForFunction(
      (selector) => document.querySelector(selector)?.volume === 0,
      aliceAudio,
      { timeout: 8_000 },
    );
  } finally {
    await alice.keyboard.up('KeyD');
  }
  await alice.keyboard.down('KeyA');
  try {
    await bob.waitForFunction(
      (selector) => document.querySelector(selector)?.volume > 0.2,
      aliceAudio,
      { timeout: 8_000 },
    );
  } finally {
    await alice.keyboard.up('KeyA');
  }
  const fps = await alice.evaluate(
    () =>
      new Promise((resolve) => {
        const start = performance.now();
        let frames = 0;
        const sample = () => {
          frames++;
          if (performance.now() - start >= 1_500)
            resolve(Math.round((frames * 1000) / (performance.now() - start)));
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
  cases.push({ check: 'movement, attenuation and software-rendered FPS sample', fps });
  await alice.getByRole('button', { name: 'Turn mic off' }).click();
  await alice.getByText('Mic off', { exact: true }).waitFor();
  await bob.locator(aliceAudio).waitFor({ state: 'detached' });
  for (const [name, kind] of [
    ['Test One', 'voice_connect'],
    ['Test Two', 'voice_connect'],
    ['Test One', 'voice'],
  ]) {
    assert(
      roomResults.some(
        (result) => result.name === name && result.kind === kind && result.outcome === 'success',
      ),
      'Missing successful telemetry for ' + kind,
    );
  }
  cases.push({ check: 'separate LiveKit connect and mic publish telemetry' });

  await alice.reload();
  await alice.locator('.room-canvas canvas').waitFor({ timeout: 15_000 });
  await alice.getByText('Mic off', { exact: true }).waitFor({ timeout: 20_000 });
  await peer(bob, 'Test One').waitFor();

  if (process.env.E2E_VOICE_DRILL === '1') {
    const compose = (action) =>
      execFileSync('docker', ['compose', action, 'livekit'], { stdio: 'pipe', timeout: 45_000 });
    try {
      compose('stop');
      await alice.getByText('Voice unavailable', { exact: true }).waitFor();
      await peer(bob, 'Test One').waitFor();
      await alice.locator('.room-canvas canvas').click({ position: { x: 550, y: 440 } });
      cases.push({ check: 'LiveKit stops while the Game room remains connected' });
    } finally {
      compose('start');
    }
  }

  if (process.env.E2E_GAME_DRILL === '1') {
    execFileSync('docker', ['compose', 'restart', 'game'], { stdio: 'pipe', timeout: 45_000 });
    let ready = false;
    for (let i = 0; i < 15 && !ready; i++) {
      try {
        execFileSync(
          'docker',
          [
            'compose',
            'exec',
            '-T',
            'game',
            'node',
            '-e',
            'fetch("http://localhost:2569/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))',
          ],
          { stdio: 'pipe', timeout: 5_000 },
        );
        ready = true;
      } catch {
        await pause(1_000);
      }
    }
    assert(ready, 'Game did not become healthy after restart');
    for (const page of [alice, bob]) {
      await page.getByRole('button', { name: 'Reconnect', exact: true }).click({ timeout: 30_000 });
      await page.locator('.room-canvas canvas').waitFor();
      await page.getByText('Mic off', { exact: true }).waitFor();
    }
    await peer(alice, 'Test Two').waitFor();
    cases.push({ check: 'Game restart requires a fresh ticket and both players can rejoin' });
  }

  await alice.getByRole('button', { name: 'Leave', exact: true }).click();
  await alice.waitForURL(origin + '/discover');
  await peer(bob, 'Test One').waitFor({ state: 'detached' });
  await alice.reload();
  await alice
    .locator('#account-name')
    .filter({ hasText: /^Test One$/ })
    .waitFor();
  await alice.getByRole('button', { name: 'Account menu' }).click();
  await alice.getByRole('button', { name: 'Sign out' }).click();
  await alice.waitForURL(origin + '/login');
  assert.equal((await rest(users[0], '/api/me')).status, 401);
  await bob.getByRole('button', { name: 'Leave', exact: true }).click();
  assert.deepEqual(problems, []);
  console.log(JSON.stringify(cases));
} finally {
  await browser.close();
}
