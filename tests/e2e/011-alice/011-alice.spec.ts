import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CAL0000I', desktop: 'CAL0000K' } as const;

test('Alice returns a won trick entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Alice click activation', 'Click every card until Alice wins a Frog-free trick, then click Alice.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Alice', 'interactive');
  let ready = false;
  for (let trick = 0; trick < 12 && !ready; trick += 1) {
    const before = Number(await page.locator('.local-counter summary').textContent());
    for (let card = 0; card < 3; card += 1) await playOneClick(game.players, page, page);
    const after = Number(await page.locator('.local-counter summary').textContent());
    ready = after > before && await page.locator('.local-counter .review-card[aria-label="Pets 8"]').count() === 0;
  }
  expect(ready).toBe(true);
  const reviewedCards = await page.locator('.local-counter .review-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
  await page.locator('.local-counter summary').click();
  await steps.step('frog-free-trick-opened', { description: 'Alice opens the trick she just won and reviews all three cards', verifications: [
    { spec: 'Alice’s power button is semantically enabled', check: async () => expect(page.getByRole('button', { name: 'Use Alice power' })).toBeEnabled() },
    { spec: 'The open review contains three card records', check: async () => { await expect(page.locator('.local-counter')).toHaveAttribute('open', ''); await expect(page.locator('.local-counter .review-card')).toHaveCount(3); } },
    { spec: 'None of the reviewed cards is the Frog', check: async () => expect(reviewedCards).not.toContain('Pets 8') }
  ] });
  const counts = await Promise.all(game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button').count()));
  const handsBefore = await Promise.all(game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))));
  const princess = page.getByRole('button', { name: 'Use Alice power' }); await expect(princess).toBeEnabled(); await princess.click();
  for (let index = 0; index < game.players.length; index += 1) await expect(game.players[index].getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(counts[index] + 1);
  const handsAfter = await Promise.all(game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''))));
  const returnedCards = handsAfter.map((hand, index) => hand.filter((card) => !handsBefore[index].includes(card)));
  await steps.step('alice-clicks-return-trick', { description: `Alice returns the reviewed trick; ${returnedCards[0][0]} is now visible in her hand`, verifications: [
    { spec: 'Every player receives one returned card', check: async () => { for (let index = 0; index < game.players.length; index += 1) await expect(game.players[index].getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(counts[index] + 1); } },
    { spec: 'Each newly added hand card came from the reviewed trick', check: async () => { expect(returnedCards.every((cards) => cards.length === 1 && reviewedCards.includes(cards[0]))).toBe(true); } },
    { spec: 'Alice’s returned card is a visible hand button', check: async () => expect(page.getByRole('region', { name: 'Your hand' }).getByRole('button', { name: returnedCards[0][0], exact: true })).toBeVisible() },
    { spec: 'Alice is visibly exhausted', check: async () => expect(game.jo.getByLabel("Alex's Princess: Alice")).toHaveClass(/exhausted/) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
