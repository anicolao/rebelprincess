import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

async function join(page: Page, gameId: string, uid: string, name: string) {
  await page.goto(`/?e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(gameId);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function choose(page: Page, princess: string) {
  await page.getByRole('button', { name: princess, exact: true }).click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Ready');
}

test('three clients choose setup and receive a deterministic selective deal', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Princess setup and deterministic deal',
    'Three players choose distinct Princesses, ready themselves, and receive a complete seeded deal while each client renders only its own hand.'
  );
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'SET003P' : 'SET003D';
  const contextOptions = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const guestContext = await browser.newContext(contextOptions);
  const thirdContext = await browser.newContext(contextOptions);
  const guest = await guestContext.newPage();
  const third = await thirdContext.newPage();

  await page.goto(`/?gameId=${gameId}&seed=fixed-003&e2eUid=setup-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await join(guest, gameId, `setup-guest-${suffix}`, 'Jo');
  await join(third, gameId, `setup-third-${suffix}`, 'Sam');

  await choose(page, 'Snow White');
  await choose(guest, 'The Little Mermaid');
  await choose(third, 'Cinderella');
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Alex · Snow White');
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Jo · The Little Mermaid');
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Sam · Cinderella');

  for (const round of ['Once Upon a Time…', 'Invitation', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs']) {
    await page.getByRole('button', { name: round, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();
  await expect(guest.getByRole('heading', { name: 'Round 1 · Once Upon a Time…' })).toBeVisible();
  await page.reload();
  await page.evaluate(() => scrollTo(0, 0));

  const expectedHostHand = [
    'Fairies 6', 'Fairies 7', 'Fairies 9', 'Queens 3', 'Queens 8', 'Princes 3',
    'Princes 5', 'Princes 6', 'Princes 7', 'Princes 8', 'Princes 10', 'Pets 4'
  ];
  await steps.step('fixed-three-player-deal', {
    description: 'The first round is ready with the host’s exact twelve-card hand',
    verifications: [
      { spec: 'The selected first Round card is revealed', check: async () => expect(page.getByRole('heading', { name: 'Round 1 · Once Upon a Time…' })).toBeVisible() },
      { spec: 'All 36 cards exist in the trusted shared stream', check: async () => expect(page.getByTestId('stream-card-count')).toHaveText('Shared stream contains 36 cards') },
      { spec: 'Only the local player’s exact seeded hand is rendered face-up', check: async () => {
        await expect(page.getByRole('region', { name: 'Your hand' }).locator('[aria-label]')).toHaveCount(12);
        for (const card of expectedHostHand) await expect(page.getByRole('region', { name: 'Your hand' }).getByLabel(card, { exact: true })).toBeVisible();
      } },
      { spec: 'Opponents are represented by twelve-card counts', check: async () => {
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
