import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { origin } from './fixtures.mjs';

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
  args: ['--mute-audio', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
let sessionActive = false;
try {
  await page.goto(origin + '/login');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await page.waitForURL(origin + '/character');
  sessionActive = true;
  await page.getByLabel('Display name').fill('Guest Test');
  await page.getByRole('button', { name: 'Save & continue' }).click();
  await page.waitForURL(origin + '/discover');
  await page.reload();
  await page
    .locator('#account-name')
    .filter({ hasText: /^Guest Test$/ })
    .waitFor();
  const account = await page.request.get(origin + '/api/me');
  assert.equal(account.status(), 200);
  const profile = await account.json();
  assert.equal(profile.user.isGuest, true);
  assert.equal(profile.avatar.displayName, 'Guest Test');

  await page.getByRole('button', { name: 'Walk in' }).click();
  await page.locator('.room-canvas canvas').waitFor({ timeout: 16_000 });
  await page.getByText('Mic off', { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.waitForURL(origin + '/discover');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByText('Guest session', { exact: true }).waitFor();
  const deleted = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/delete-anonymous-user'),
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
  assert.equal((await deleted).status(), 200);
  sessionActive = false;
  await page.waitForURL(origin + '/login');
  assert.equal((await page.request.get(origin + '/api/me')).status(), 401);
  console.log('Guest sign-in, avatar, room join, leave, and sign-out passed.');
} finally {
  if (sessionActive) {
    await page.request
      .post(origin + '/api/auth/delete-anonymous-user', {
        headers: { Origin: origin },
        timeout: 5_000,
      })
      .catch(() => undefined);
  }
  await browser.close();
}
