import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('two anonymous clients create, join, synchronize, and replay a game', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Create and join a live game',
    'Two independent anonymous browser clients share one append-only event stream, then the host reloads and reconstructs the same room.'
  );
  const gameId = testInfo.project.name === 'phone' ? 'LIVE02P' : 'LIVE02D';

  await page.goto(`/?gameId=${gameId}&e2eUid=host-${testInfo.project.name}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Alex');

  const guestContext = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    deviceScaleFactor: 1
  });
  const guest = await guestContext.newPage();
  await guest.goto(`/?e2eUid=guest-${testInfo.project.name}`);
  await guest.getByLabel('Your name').fill('Jo');
  await guest.getByLabel('Room code').fill(gameId);
  await guest.getByRole('button', { name: 'Join' }).click();
  await expect(guest.getByRole('heading', { name: 'Players · 2' })).toBeVisible();
  await expect(guest.getByRole('list', { name: 'Players' })).toContainText('Alex');

  await expect(page.getByRole('heading', { name: 'Players · 2' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Jo');

  await page.reload();

  await steps.step('shared-room-after-reload', {
    description: 'Both players remain in the synchronized room after reload',
    verifications: [
      {
        spec: 'The stable invite code identifies the shared game',
        check: async () => expect(page.getByTestId('invite-code')).toHaveText(gameId)
      },
      {
        spec: 'The append-only stream reconstructs both room members',
        check: async () => expect(page.getByRole('heading', { name: 'Players · 2' })).toBeVisible()
      },
      {
        spec: 'The host and guest names are both visible to the trusted client',
        check: async () => {
          const players = page.getByRole('list', { name: 'Players' });
          await expect(players).toContainText('Alex');
          await expect(players).toContainText('Jo');
        }
      }
    ]
  });

  steps.generateDocs();
  await guestContext.close();
});

test('a player can join after another player seals a Princess choice', async ({ page, browser }, testInfo) => {
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'LATE02P' : 'LATE02D';
  const contextOptions = {
    viewport: page.viewportSize() ?? undefined,
    reducedMotion: 'reduce' as const,
    serviceWorkers: 'block' as const,
    deviceScaleFactor: 1
  };
  const guestContext = await browser.newContext(contextOptions);
  const thirdContext = await browser.newContext(contextOptions);
  const lateContext = await browser.newContext(contextOptions);
  const guest = await guestContext.newPage();
  const third = await thirdContext.newPage();
  const late = await lateContext.newPage();

  const join = async (player: typeof page, uid: string, name: string) => {
    await player.goto(`/?e2eUid=${uid}`);
    await player.getByLabel('Your name').fill(name);
    await player.getByLabel('Room code').fill(gameId);
    await player.getByRole('button', { name: 'Join' }).click();
    await expect(player.getByTestId('invite-code')).toHaveText(gameId);
  };

  await page.goto(`/?gameId=${gameId}&e2eUid=late-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await join(guest, `late-guest-${suffix}`, 'Jo');
  await join(third, `late-third-${suffix}`, 'Sam');

  await page.getByLabel('Choose one of your two Princesses').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
  await expect(page.getByRole('list', { name: 'Players' }).getByRole('listitem').filter({ hasText: 'Alex' })).toContainText('Ready');

  await join(late, `late-fourth-${suffix}`, 'Taylor');
  await expect(late.getByRole('heading', { name: 'Players · 4' })).toBeVisible();
  await expect(late.getByLabel('Choose one of your two Princesses').getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Taylor');

  await guestContext.close();
  await thirdContext.close();
  await lateContext.close();
});
