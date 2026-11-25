import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
const url = process.env.MOCK_URL ?? 'http://127.0.0.1:3215';
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function previewScenario(page, value) {
  const controls = page.locator('.preview-controls > summary');
  await controls.click();
  await page.getByLabel('Next demo action').selectOption(value);
  await controls.click();
}
async function alertHas(page, pattern) {
  const alert = page.getByRole('alert').filter({ hasText: pattern });
  await alert.waitFor();
  assert.match(await alert.innerText(), pattern);
}
async function checkWidth(page) {
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Horizontal overflow',
  );
}
(async () => {
  const dir = path.join(os.tmpdir(), 'mini-connecta-stage35');
  await fs.mkdir(dir, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
    headless: true,
    args: ['--mute-audio'],
  });
  try {
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
      [320, 670],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        colorScheme: width === 390 ? 'dark' : 'light',
        hasTouch: width < 641,
      });
      const problems = [];
      page.on('pageerror', (error) => problems.push(error.message));
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/'))
          problems.push('Unexpected network request: ' + request.url());
      });
      page.on('response', (response) => {
        if (response.status() >= 400 && !response.url().endsWith('/favicon.ico'))
          problems.push(response.status() + ' ' + response.url());
      });
      page.on('websocket', (socket) => problems.push('Unexpected socket: ' + socket.url()));
      await page.addInitScript(() => {
        window.miniTestMicRequests = 0;
        if (navigator.mediaDevices)
          navigator.mediaDevices.getUserMedia = () => {
            window.miniTestMicRequests++;
            return Promise.reject(new Error('Mock attempted microphone capture'));
          };
      });
      await page.goto(url + '/rooms/study-room');
      await page.waitForURL(url + '/login');
      await page.getByRole('heading', { name: 'Sign in' }).waitFor();
      await page.goto(url + '/');
      await page.getByRole('heading', { name: /study together somewhere cosy/i }).waitFor();
      await checkWidth(page);
      await page.screenshot({ path: path.join(dir, width + '-landing.png') });
      await page.getByRole('link', { name: 'Explore the Study Room' }).click();
      await page.waitForURL(url + '/login');
      await checkWidth(page);
      await page.screenshot({ path: path.join(dir, width + '-login.png') });
      await previewScenario(page, 'auth-error');
      await button(page, 'Continue with Google').click();
      await alertHas(page, /Sign-in failed/);
      await button(page, 'Continue with Google').click();
      await button(page, 'Cancel sign-in').click();
      await alertHas(page, /Sign-in cancelled/);
      await button(page, 'Continue with Google').click();
      await page.waitForURL(url + '/character');

      await page.getByLabel('Display name').fill('  ');
      await button(page, 'Save & continue').click();
      await alertHas(page, /Enter a display name/);
      await page.getByLabel('Display name').fill('Mook');
      await page.getByRole('radio', { name: 'Matcha' }).check();
      await page.getByRole('img', { name: 'Matcha character' }).evaluate((image) => image.decode());
      await checkWidth(page);
      await page.screenshot({ path: path.join(dir, width + '-character.png') });
      await previewScenario(page, 'save-error');
      await button(page, 'Save & continue').click();
      await alertHas(page, /service is unavailable/);
      await button(page, 'Save & continue').click();
      await page.waitForURL(url + '/discover');

      const nav = page.getByRole('navigation', { name: 'App' });
      await nav.getByRole('link', { name: 'Discover' }).waitFor();
      assert.equal(await nav.getByRole('link').count(), 1);
      const common = page.getByRole('region', { name: 'Common rooms' });
      const open = page.getByRole('region', { name: 'Open rooms' });
      assert.equal(await common.getByRole('article').count(), 1);
      assert.equal(await open.getByRole('article').count(), 0);
      assert.equal(await open.getByRole('status').innerText(), 'No open rooms yet.');
      const profile = button(page, 'Account menu');
      const profileBounds = await profile.boundingBox();
      assert(
        profileBounds.x < 24 && profileBounds.y > height - 90,
        'Profile should be at the lower left',
      );
      await profile.click();
      await page.getByLabel('Appearance').selectOption('dark');
      await page.getByRole('link', { name: 'Edit character' }).click();
      await page.waitForURL(url + '/character/edit');
      assert.equal(await page.getByLabel('Display name').inputValue(), 'Mook');
      await button(page, 'Save changes').click();
      await page.waitForURL(url + '/discover');
      await checkWidth(page);
      await page.screenshot({ path: path.join(dir, width + '-discover.png') });
      await page.reload();
      await page
        .locator('#account-name')
        .filter({ hasText: /^Mook$/ })
        .waitFor();
      assert.equal(await page.locator('#account-avatar').getAttribute('src'), '/assets/matcha.png');
      await previewScenario(page, 'session-expired');
      await button(page, 'Walk in').click();
      await page.waitForURL(url + '/login');
      await button(page, 'Continue with Google').click();
      await page.waitForURL(url + '/discover');
      await page
        .locator('#account-name')
        .filter({ hasText: /^Mook$/ })
        .waitFor();
      await previewScenario(page, 'room-full');
      await button(page, 'Walk in').click();
      await alertHas(page, /Study Room is full/);
      await previewScenario(page, 'join-error');
      await button(page, 'Walk in').click();
      await alertHas(page, /Couldn’t connect/);
      await button(page, 'Walk in').click();
      await page.waitForURL(url + '/rooms/study-room');

      await page.getByRole('heading', { name: 'Study Room' }).waitFor();
      await checkWidth(page);
      const l = await page.locator('.room-identity').boundingBox();
      const r = await page.locator('.room-presence').boundingBox();
      assert(l.x + l.width < r.x && r.x + r.width <= width, 'Room HUD overlap');
      assert.equal(
        await page
          .getByRole('img', { name: '4 people in the room' })
          .locator('.room-avatar')
          .count(),
        4,
      );
      await page.getByText('Mic off', { exact: true }).waitFor();
      const image = page.getByRole('img', { name: 'Isometric preview of the Cosy Library' });
      await image.evaluate((img) => img.decode());
      assert(
        (await image.evaluate((img) => img.currentSrc)).endsWith(
          width <= 640 ? 'library-room-mobile.png' : 'library-room.png',
        ),
      );
      await page.screenshot({ path: path.join(dir, width + '-room.png') });
      await previewScenario(page, 'mic-denied');
      await button(page, 'Turn mic on').click();
      await alertHas(page, /access is blocked/);
      await previewScenario(page, 'voice-error');
      await button(page, 'Turn mic on').click();
      await alertHas(page, /Voice couldn’t connect/);
      await button(page, 'Turn mic on').click();
      assert.equal(await page.locator('#voice-status').innerText(), 'Mic on');
      await page.locator('.preview-controls > summary').click();
      await button(page, 'Simulate disconnect').click();
      await page.getByRole('heading', { name: 'Connection lost' }).waitFor();
      assert.equal(await button(page, 'Turn mic on').isDisabled(), true);
      await button(page, 'Reconnect').click();
      await page.getByRole('heading', { name: 'Connection lost' }).waitFor({ state: 'hidden' });
      await page.getByText('Mic off', { exact: true }).waitFor();
      await button(page, 'Turn mic on').click();
      await page.getByText('Mic on', { exact: true }).waitFor();
      await page.reload();
      await page.getByText('Mic off', { exact: true }).waitFor();
      assert.match(await page.url(), /\/rooms\/study-room$/);
      assert.equal(await page.locator('.room-avatar-self').getAttribute('title'), 'Mook (you)');
      assert.deepEqual(
        await page.evaluate(() =>
          Object.entries(sessionStorage).filter(([key]) => key.startsWith('mini-connecta:')),
        ),
        [['mini-connecta:joined-study-room', 'true']],
      );
      assert.equal(await page.evaluate(() => window.miniTestMicRequests), 0);
      await button(page, 'Turn mic on').click();
      await page.getByText('Mic on', { exact: true }).waitFor();
      await button(page, 'Leave').click();
      await page.waitForURL(url + '/discover');
      assert.equal(
        await page.evaluate(() => sessionStorage.getItem('mini-connecta:joined-study-room')),
        null,
      );
      await page.goto(url + '/rooms/study-room');
      await page.waitForURL(url + '/discover');
      await button(page, 'Walk in').click();
      await page.getByText('Mic off', { exact: true }).waitFor();
      await button(page, 'Leave').click();
      await page.waitForURL(url + '/discover');
      await button(page, 'Account menu').click();
      await button(page, 'Sign out').click();
      await page.waitForURL(url + '/login');
      await button(page, 'Continue with Google').click();
      await page.waitForURL(url + '/discover');
      await page
        .locator('#account-name')
        .filter({ hasText: /^Mook$/ })
        .waitFor();
      assert.deepEqual(problems, []);
      await page.close();
      console.log(
        width +
          'px: access, onboarding, Discover, room HUD, microphone, reconnect and returning user passed',
      );
    }
    console.log('Screenshots ' + dir);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
