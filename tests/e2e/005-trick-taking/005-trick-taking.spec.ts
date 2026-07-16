import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

async function join(page: Page, gameId: string, uid: string, name: string) {
  await page.goto(`/?e2eUid=${uid}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(gameId);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
}

async function ready(page: Page, _princess?: string) {
  await page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first().click();
  await page.getByRole('button', { name: 'Ready for the ball' }).click();
}

async function pass(page: Page, cards: string[]) {
  for (const card of cards) await page.getByRole('button', { name: card, exact: true }).click();
  await page.getByRole('button', { name: /^Pass 2/ }).click();
}

async function play(page: Page, card: string) {
  await page.getByRole('button', { name: card, exact: true }).click();
}

test('three clients follow suit, break Princes, resolve winners, and rotate leadership', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Base trick-taking loop', 'Three trustworthy clients play complete synchronized tricks through follow-suit, void, Prince-breaking, capture, and winner-led transitions.');
  const suffix = testInfo.project.name;
  const gameId = suffix === 'phone' ? 'TRICK05P' : 'TRICK05D';
  const options = { viewport: page.viewportSize() ?? undefined, reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const, deviceScaleFactor: 1 };
  const joContext = await browser.newContext(options);
  const samContext = await browser.newContext(options);
  const jo = await joContext.newPage();
  const sam = await samContext.newPage();

  await page.goto(`/?gameId=${gameId}&seed=fixed-004&e2eUid=trick-host-${suffix}`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Create a game' }).click();
  await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  await join(jo, gameId, `trick-jo-${suffix}`, 'Jo');
  await join(sam, gameId, `trick-sam-${suffix}`, 'Sam');
  await ready(page, 'Snow White');
  await ready(jo, 'The Little Mermaid');
  await ready(sam, 'Cinderella');
  for (const round of ['Once Upon a Time…', 'Invitation', 'Masquerade Ball', 'Royal Decree', 'Musical Chairs']) await page.getByRole('button', { name: round, exact: true }).click();
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();
  await pass(page, ['Fairies 3', 'Princes 2']);
  await pass(jo, ['Fairies 2', 'Fairies 8']);
  await pass(sam, ['Fairies 10', 'Queens 2']);

  await steps.step('leader-legal-cards', {
    description: 'The leader may play non-Princes but cannot lead an unbroken Prince',
    verifications: [
      { spec: 'Alex is prompted to lead the first trick', check: async () => expect(page.getByRole('alert')).toContainText('Your turn') },
      { spec: 'Every client identifies Alex as the leader', check: async () => {
        await expect(page.getByText('You lead', { exact: true })).toBeVisible();
        await expect(jo.getByLabel("Alex's hand").getByText('Leads', { exact: true })).toBeVisible();
        await expect(sam.getByLabel("Alex's hand").getByText('Leads', { exact: true })).toBeVisible();
      } },
      { spec: 'Every client sees the remaining players clockwise in play order', check: async () => {
        const seatLabels = async (client: typeof page) => client.locator('[data-clockwise-seat]').evaluateAll((seats) => seats.map((seat) => seat.getAttribute('aria-label')));
        expect(await seatLabels(page)).toEqual(["Jo's hand", "Sam's hand"]);
        expect(await seatLabels(jo)).toEqual(["Sam's hand", "Alex's hand"]);
        expect(await seatLabels(sam)).toEqual(["Alex's hand", "Jo's hand"]);
      } },
      { spec: 'The leader sees a prominent highlighted lead badge', check: async () => expect(page.locator('.local-heading')).toHaveClass(/local-leader/) },
      { spec: 'A Prince is disabled before the suit is broken', check: async () => expect(page.getByRole('button', { name: 'Princes 4', exact: true })).toBeDisabled() },
      { spec: 'A Fairy is a legal opening lead', check: async () => expect(page.getByRole('button', { name: 'Fairies 4', exact: true })).toBeEnabled() }
    ]
  });

  const animationStarted = page.evaluate(() => new Promise<string>((resolve) => document.addEventListener('animationstart', (event) => resolve((event as AnimationEvent).animationName), { once: true })));
  await play(page, 'Fairies 4');
  expect(await animationStarted).toMatch(/play-to-table$/);
  await steps.step('observer-sees-lead', {
    description: 'Every client sees the lead and Jo must follow suit',
    verifications: [
      { spec: 'The shared trick shows Alex’s Fairy 4', check: async () => expect(page.getByLabel('Alex played Fairies 4')).toBeVisible() },
      { spec: 'The played card uses the Fairies atlas graphic and visible value', check: async () => {
        const played = page.getByLabel('Alex played Fairies 4');
        await expect(played.locator('.trick-card')).toHaveCSS('background-image', /suited-card-families/);
        await expect(played.locator('strong')).toHaveText('4');
      } },
      { spec: 'The played card animates from the hand into the table', check: async () => expect(page.getByLabel('Alex played Fairies 4').locator('.trick-card')).toHaveCSS('animation-name', /play-to-table$/) },
      { spec: 'Jo can follow with a Fairy', check: async () => expect(jo.getByRole('button', { name: 'Fairies 3', exact: true })).toBeEnabled() },
      { spec: 'Jo cannot discard an off-suit Prince while holding Fairies', check: async () => expect(jo.getByRole('button', { name: 'Princes 3', exact: true })).toBeDisabled() }
    ]
  });

  await play(jo, 'Fairies 3');
  await play(sam, 'Fairies 8');
  const completedTrick = page.getByLabel('Completed trick');
  await expect(completedTrick).toHaveClass(/collecting/);
  await expect(page.getByLabel('Sam played Fairies 8')).toBeVisible();

  await page.getByLabel('Sam tricks').click();
  await steps.step('winner-collects-and-reviews-trick', {
    description: 'The completed trick pauses on the table, sweeps toward its winner, and remains available for review',
    verifications: [
      { spec: 'Sam’s trick counter records the captured trick', check: async () => expect(page.getByLabel('Sam tricks')).toHaveText('1') },
      { spec: 'Tapping the counter reveals the most recently captured cards', check: async () => {
        const review = page.getByLabel('Sam last trick');
        await expect(review).toBeVisible();
        await expect(review.getByLabel('Fairies 4')).toBeVisible();
        await expect(review.getByLabel('Fairies 3')).toBeVisible();
        await expect(review.getByLabel('Fairies 8')).toBeVisible();
      } },
      { spec: 'The collection uses the requested three-second ease-in-out motion', check: async () => {
        const completedPlay = page.getByLabel('Sam played Fairies 8');
        await expect(completedPlay).toHaveCSS('animation-duration', '3s');
        await expect(completedPlay).toHaveCSS('animation-timing-function', 'ease-in-out');
        await expect(completedPlay.locator('.trick-card')).toHaveCSS('background-image', /suited-card-families/);
      } }
    ]
  });
  await expect(sam.getByRole('alert')).toContainText('Your turn');
  await play(sam, 'Queens 3');
  await play(page, 'Queens 7');
  await play(jo, 'Queens 4');
  await expect(page.getByRole('alert')).toContainText('Your turn');
  await play(page, 'Fairies 5');

  await steps.step('void-breaks-princes', {
    description: 'A void player may discard a Prince and break the suit',
    verifications: [
      { spec: 'Jo has no Fairies remaining and may play a Prince', check: async () => expect(jo.getByRole('button', { name: 'Princes 10', exact: true })).toBeEnabled() },
      { spec: 'The current trick is synchronized through Alex’s lead', check: async () => expect(jo.getByLabel('Alex played Fairies 5')).toBeVisible() }
    ]
  });

  await play(jo, 'Princes 10');
  await play(sam, 'Fairies 2');
  await expect(page.getByRole('alert')).toContainText('Your turn');

  await steps.step('winner-leads-broken-prince', {
    description: 'The trick winner leads again and may now lead Princes',
    verifications: [
      { spec: 'Alex has captured two complete tricks', check: async () => expect(page.getByLabel('Alex captured cards')).toHaveText('6') },
      { spec: 'Prince 4 is enabled after the suit was broken', check: async () => expect(page.getByRole('button', { name: 'Princes 4', exact: true })).toBeEnabled() },
      { spec: 'The fourth trick is ready for the previous winner', check: async () => expect(page.getByRole('alert')).toContainText('Trick 4') }
    ]
  });

  await play(page, 'Princes 4');
  await play(jo, 'Princes 2');
  await play(sam, 'Princes 9');
  await expect(sam.getByRole('alert')).toContainText('Your turn');
  await joContext.close();
  await samContext.close();
  steps.generateDocs();
});
