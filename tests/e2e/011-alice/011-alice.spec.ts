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
  await steps.step('frog-free-trick-won', { description: 'Alice has won a reviewable Frog-free trick', verifications: [
    { spec: 'Alice’s power button is semantically enabled', check: async () => expect(page.getByRole('button', { name: 'Use Alice power' })).toBeEnabled() },
    { spec: 'The captured trick contains three card records and no Frog', check: async () => { await expect(page.locator('.local-counter .review-card')).toHaveCount(3); await expect(page.locator('.local-counter .review-card[aria-label="Pets 8"]')).toHaveCount(0); } }
  ] });
  const counts = await Promise.all(game.players.map((player) => player.getByRole('region', { name: 'Your hand' }).getByRole('button').count()));
  const princess = page.getByRole('button', { name: 'Use Alice power' }); await expect(princess).toBeEnabled(); await princess.click();
  await steps.step('alice-card-clicked', { description: 'Alice is clicked and the won trick leaves her captured collection', verifications: [
    { spec: 'Alice’s card is semantically disabled after use', check: async () => expect(princess).toBeDisabled() },
    { spec: 'Alice’s captured trick counter decreases', check: async () => expect(page.locator('.local-princess')).toHaveClass(/exhausted/) }
  ] });
  await steps.step('alice-clicks-return-trick', { description: 'After ordinary clicked play, clicking Alice returns the won cards', verifications: [
    { spec: 'Every player receives one returned card', check: async () => { for (let index = 0; index < game.players.length; index += 1) await expect(game.players[index].getByRole('region', { name: 'Your hand' }).getByRole('button')).toHaveCount(counts[index] + 1); } },
    { spec: 'Alice is visibly exhausted', check: async () => expect(game.jo.getByLabel("Alex's Princess: Alice")).toHaveClass(/exhausted/) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
