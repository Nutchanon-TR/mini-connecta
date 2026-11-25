import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { chromium } from 'playwright';
import { localSessions, origin, rest } from './fixtures.mjs';

const count = Number(process.argv[2] ?? 20);
assert(Number.isInteger(count) && count >= 5 && count <= 20);
const publisherCount = Math.min(4, Math.floor(count / 3));
const people = localSessions(count, 'mixed');
await Promise.all(
  people.map(async (person) => {
    const response = await rest(person, '/api/me/avatar', {
      method: 'PUT',
      body: { displayName: person.name, preset: 'matcha' },
    });
    assert.equal(response.status, 200);
  }),
);
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
  args: [
    '--mute-audio',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
});
const players = [];
try {
  // Ramp in groups so scene compilation does not swamp all 20 peer connections at once.
  for (let i = 0; i < people.length; i += 4) {
    await Promise.all(
      people.slice(i, i + 4).map(async (person) => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 550 },
          permissions: ['microphone'],
        });
        await context.addCookies(person.cookies);
        const page = await context.newPage();
        const player = { context, page, sent: 0 };
        page.on('websocket', (socket) => {
          if (new URL(socket.url()).port === '2567')
            socket.on('framesent', () => {
              player.sent++;
            });
        });
        await page.goto(origin + '/discover');
        const start = performance.now();
        await page.getByRole('button', { name: 'Walk in' }).click();
        await page.locator('canvas').waitFor({ timeout: 25_000 });
        player.joinMs = Math.round(performance.now() - start);
        await page.getByText('Mic off', { exact: true }).waitFor({ timeout: 30_000 });
        players.push(player);
      }),
    );
  }
  await players[0].page.getByRole('img', { name: count + ' people in the room' }).waitFor();
  await Promise.all(
    players.slice(0, publisherCount).map(async (player) => {
      await player.page.getByRole('button', { name: 'Turn mic on' }).click();
      await player.page.getByText('Mic on', { exact: true }).waitFor();
    }),
  );
  await Promise.all(
    players
      .slice(publisherCount)
      .map((player) =>
        player.page.waitForFunction(
          (expected) => document.querySelectorAll('audio[data-room-audio]').length === expected,
          publisherCount,
          { timeout: 20_000 },
        ),
      ),
  );
  const startFrames = players.map((player) => player.sent);
  await Promise.all(
    players.map((player, index) =>
      player.page.evaluate(
        (code) => window.dispatchEvent(new window.KeyboardEvent('keydown', { code })),
        index % 2 ? 'KeyA' : 'KeyD',
      ),
    ),
  );
  await pause(1_500);
  const moved = players.filter((player, index) => player.sent - startFrames[index] > 2).length;
  assert.equal(moved, count);
  const stats = execFileSync(
    'docker',
    [
      'stats',
      '--no-stream',
      '--format',
      '{{.Name}} {{.CPUPerc}} {{.MemUsage}}',
      'mini-connecta-api-1',
      'mini-connecta-game-1',
      'mini-connecta-livekit-1',
      'mini-connecta-web-1',
    ],
    { encoding: 'utf8', timeout: 20_000 },
  );
  for (let end = players.length; end > publisherCount; end -= 4) {
    await Promise.all(
      players.slice(Math.max(publisherCount, end - 4), end).map(async (player) => {
        await player.page.getByRole('button', { name: 'Leave', exact: true }).click();
        await player.page.waitForURL(origin + '/discover');
        await player.context.close();
      }),
    );
  }
  await players[0].page
    .getByRole('img', { name: publisherCount + ' people in the room' })
    .waitFor();
  const joinDurations = players.map((player) => player.joinMs).sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      connected: count,
      publishers: publisherCount,
      subscriberChecks: publisherCount * (count - publisherCount),
      moved,
      joinP95Ms: joinDurations[Math.ceil(count * 0.95) - 1],
      withinFiveSeconds: joinDurations.filter((ms) => ms <= 5_000).length,
      stats: stats.trim().split(/\r?\n/),
    }),
  );
} finally {
  await browser.close();
}
