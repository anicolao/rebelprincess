import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

async function join(page: Page, gameId: string, uid: string, name: string) {
  await page.goto(`/?e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(gameId);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function ready(page: Page, princess: string) {
  await page.getByRole('button', { name: princess, exact: true }).click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
}

async function submitFirstTwo(page: Page, labels: [string, string]) {
  for (const label of labels) await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: /Pass 2 left to/ }).click();
}

async function expectExactHand(page: Page, expected: string[]) {
  const hand = page.getByRole('region', { name: 'Your hand' });
  await expect(hand.locator('.playing-card')).toHaveCount(expected.length);
  for (const label of expected) await expect(hand.getByRole('button', { name: label, exact: true })).toBeVisible();
}

test('three clients submit simultaneously and resolve a conserved left pass', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Simultaneous card passing',
    'Early submissions reveal no incoming cards; the final submission deterministically resolves all three exact hands without losing or duplicating a card.'
  );
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'PASS004P' : 'PASS004D';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const guestContext = await browser.newContext(options);
  const thirdContext = await browser.newContext(options);
  const guest = await guestContext.newPage();
  const third = await thirdContext.newPage();

  await page.goto(`/?gameId=${gameId}&seed=fixed-004&e2eUid=pass-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  await join(guest, gameId, `pass-guest-${suffix}`, 'Jo');
  await join(third, gameId, `pass-third-${suffix}`, 'Sam');
  await ready(page, 'Snow White');
  await ready(guest, 'The Little Mermaid');
  await ready(third, 'Cinderella');
  for (const round of ['Once Upon a Time…', 'Invitation', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs']) await page.getByRole('button', { name: round, exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();

  await submitFirstTwo(page, ['Fairies 3', 'Fairies 4']);
  await expect(page.getByRole('alert')).toContainText('Passing 2 left to Jo');
  await expect(page.getByRole('button', { name: 'Fairies 3' })).toContainText('To Jo');
  await page.getByRole('button', { name: 'Fairies 3' }).click();
  await expect(page.getByRole('button', { name: /Pass 2 left to Jo/ })).toBeVisible();
  await page.getByRole('button', { name: 'Fairies 5' }).click();
  await page.getByRole('button', { name: /Pass 2 left to Jo/ }).click();
  await submitFirstTwo(guest, ['Fairies 2', 'Fairies 8']);
  await expect(page.getByRole('alert')).toContainText('Waiting for 1 other player');
  await submitFirstTwo(third, ['Fairies 10', 'Queens 2']);

  const hostHand = ['Fairies 3', 'Fairies 6', 'Fairies 7', 'Fairies 9', 'Fairies 10', 'Queens 2', 'Queens 7', 'Princes 2', 'Princes 4', 'Pets 4', 'Pets 6', 'Pets 8'];
  const guestHand = ['Fairies 4', 'Fairies 5', 'Queens 4', 'Queens 9', 'Queens 10', 'Princes 3', 'Princes 5', 'Princes 6', 'Princes 7', 'Princes 10', 'Pets 2', 'Pets 5'];
  const thirdHand = ['Fairies 2', 'Fairies 8', 'Queens 3', 'Queens 5', 'Queens 6', 'Queens 8', 'Princes 8', 'Princes 9', 'Pets 3', 'Pets 7', 'Pets 9', 'Pets 10'];
  await expectExactHand(page, hostHand);
  await expectExactHand(guest, guestHand);
  await expectExactHand(third, thirdHand);
  await page.reload();

  await steps.step('resolved-left-pass', {
    description: 'All exact hands resolve after the final hidden submission',
    verifications: [
      { spec: 'The UI reports that simultaneous passing is complete', check: async () => expect(page.getByRole('alert')).toContainText('Passing complete') },
      { spec: 'The host’s revised pass and exact incoming cards survive reload', check: async () => expectExactHand(page, hostHand) },
      { spec: 'All 36 cards remain accounted for after resolution', check: async () => expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 36 cards') },
      { spec: 'The gameplay table has no horizontal or vertical scrolling', check: async () => expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth === innerWidth, height: document.documentElement.scrollHeight === innerHeight }))).toEqual({ width: true, height: true }) },
      { spec: 'Opponent hand counts remain twelve without revealing their faces', check: async () => {
        await expect(page.getByLabel('Opponents')).toContainText('Jo · 12');
        await expect(page.getByLabel('Opponents')).toContainText('Sam · 12');
        await page.evaluate(() => scrollTo(0, 0));
      } }
    ]
  });

  steps.generateDocs();
  await guestContext.close();
  await thirdContext.close();
});
