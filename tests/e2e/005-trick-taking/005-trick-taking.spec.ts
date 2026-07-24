import { expect, test, type Page } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { clickAndConfirm } from '../helpers/round-card-game';

async function join(page: Page, gameId: string, uid: string, name: string) {
  await page.goto(`/?e2eUid=${uid}`);
  await expect(page.locator('.status')).toHaveAttribute('data-status', 'synced');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(gameId);
  const joinBtn = page.getByRole('button', { name: 'Join' });
  await clickAndConfirm(joinBtn, async () => {
    await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  });
}

async function ready(page: Page, _princess?: string) {
  const princessBtn = page.getByLabel('Choose one of your two Princesses').getByRole('button').filter({ hasNotText: 'Mulan' }).first();
  await clickAndConfirm(princessBtn, async () => {
    await expect(princessBtn).toHaveAttribute('aria-pressed', 'true');
  });
  const readyBtn = page.getByRole('button', { name: 'Ready for the ball' });
  await clickAndConfirm(readyBtn, async () => {
    await expect(readyBtn).toHaveCount(0);
  });
}

async function pass(page: Page, cards: string[]) {
  const submit = page.locator('.pass-submit');
  for (const [index, card] of cards.entries()) {
    const specificCard = page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: card, exact: true });
    await clickAndConfirm(specificCard, async () => {
      await expect(page.locator('.playing-card.selected')).toHaveCount(index + 1);
    });
  }
  await clickAndConfirm(submit, async () => {
    await expect(submit).toHaveCount(0);
  });
}

async function play(page: Page, card: string) {
  const specificCard = page.getByRole('button', { name: card, exact: true });
  await clickAndConfirm(specificCard, async () => {
    await expect(specificCard).toHaveCount(0);
  });
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

  await page.goto(`/?gameId=${gameId}&seed=fixed-004&e2eRounds=once-upon-a-time,magic-beans,masquerade-ball,royal-decree,musical-chairs&e2eUid=trick-host-${suffix}`);
  await expect(page.locator('.status')).toHaveAttribute('data-status', 'synced');
  await page.getByLabel('Your name').fill('Alex');
  const createBtn = page.getByRole('button', { name: 'Create a game' });
  await clickAndConfirm(createBtn, async () => {
    await expect(page.getByTestId('invite-code')).toHaveText(gameId);
  });
  await join(jo, gameId, `trick-jo-${suffix}`, 'Jo');
  await join(sam, gameId, `trick-sam-${suffix}`, 'Sam');
  await ready(page, 'Snow White');
  await ready(jo, 'The Little Mermaid');
  await ready(sam, 'Cinderella');
  await page.getByRole('button', { name: 'Shuffle and deal' }).click();
  await pass(page, ['Fairies 3', 'Fairies 4', 'Fairies 5']);
  await pass(jo, ['Fairies 2', 'Fairies 8', 'Queens 4']);
  await pass(sam, ['Queens 2', 'Queens 3', 'Queens 5']);

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
      { spec: 'A Fairy is a legal opening lead', check: async () => expect(page.getByRole('button', { name: 'Fairies 6', exact: true })).toBeEnabled() }
    ]
  });

  const animationStarted = page.evaluate(() => new Promise<string>((resolve) => document.addEventListener('animationstart', (event) => resolve((event as AnimationEvent).animationName), { once: true })));
  await play(page, 'Fairies 6');
  expect(await animationStarted).toMatch(/play-to-table$/);
  await steps.step('observer-sees-lead', {
    description: 'Every client sees the lead; Jo is visibly void while Sam must follow suit',
    verifications: [
      { spec: 'The shared trick shows Alex’s Fairy 6', check: async () => expect(page.getByLabel('Alex played Fairies 6')).toBeVisible() },
      { spec: 'The played card uses the Fairies atlas graphic and visible value', check: async () => {
        const played = page.getByLabel('Alex played Fairies 6');
        await expect(played.locator('.trick-card .card-art')).toHaveCSS('background-image', /fairies/);
        await expect(played.locator('strong')).toHaveText('6');
      } },
      { spec: 'The played card animates from the hand into the table', check: async () => expect(page.getByLabel('Alex played Fairies 6').locator('.trick-card')).toHaveCSS('animation-name', /play-to-table$/) },
      { spec: 'Jo has no Fairies and may discard a Prince', check: async () => expect(jo.getByRole('button', { name: 'Princes 10', exact: true })).toBeEnabled() },
      { spec: 'Sam holds Fairies and cannot discard an off-suit Prince', check: async () => expect(sam.getByRole('button', { name: 'Princes 9', exact: true })).toBeDisabled() }
    ]
  });

  await play(jo, 'Princes 10');
  await play(sam, 'Fairies 5');
  const completedTrick = page.getByLabel('Completed trick');
  await expect(completedTrick).toHaveClass(/collecting/);
  await expect(page.getByLabel('Sam played Fairies 5')).toBeVisible();

  await page.getByLabel('Alex tricks').click();
  await steps.step('winner-collects-and-reviews-trick', {
    description: 'The completed trick pauses on the table, sweeps toward its winner, and remains available for review',
    verifications: [
      { spec: 'Alex’s trick counter records the captured trick', check: async () => expect(page.getByLabel('Alex tricks')).toHaveText('1') },
      { spec: 'Tapping the counter reveals the most recently captured cards', check: async () => {
        const review = page.getByLabel('Alex last trick');
        await expect(review).toBeVisible();
        await expect(review.getByLabel('Fairies 6')).toBeVisible();
        await expect(review.getByLabel('Princes 10')).toBeVisible();
        await expect(review.getByLabel('Fairies 5')).toBeVisible();
      } },
      { spec: 'The collection uses the requested three-second ease-in-out motion', check: async () => {
        const completedPlay = page.getByLabel('Sam played Fairies 5');
        await expect(completedPlay).toHaveCSS('animation-duration', '3s');
        await expect(completedPlay).toHaveCSS('animation-timing-function', 'ease-in-out');
        await expect(completedPlay.locator('.trick-card .card-art')).toHaveCSS('background-image', /fairies/);
      } }
    ]
  });
  await expect(page.getByRole('alert')).toContainText('Your turn');

  await steps.step('winner-leads-broken-prince', {
    description: 'Jo’s void discard broke Princes, so the trick winner may immediately lead one',
    verifications: [
      { spec: 'Alex captured the complete opening trick', check: async () => expect(page.getByLabel('Alex captured cards')).toHaveText('3') },
      { spec: 'Prince 4 is enabled after the suit was broken', check: async () => expect(page.getByRole('button', { name: 'Princes 4', exact: true })).toBeEnabled() },
      { spec: 'The second trick is ready for the previous winner', check: async () => expect(page.getByRole('alert')).toContainText('Trick 2') }
    ]
  });

  await play(page, 'Princes 4');
  await play(jo, 'Princes 3');
  await play(sam, 'Princes 9');
  await expect(sam.getByRole('alert')).toContainText('Your turn');
  await joContext.close();
  await samContext.close();
  steps.generateDocs();
});
