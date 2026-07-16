import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CCI00009', desktop: 'CCI0000C' } as const;

test('Cinderella reverses a trick entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Cinderella click activation', 'Click Cinderella, then click every card in the reversed trick.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Cinderella');
  const princess = page.getByRole('button', { name: 'Use Cinderella power' });
  await steps.step('cinderella-ready', { description: 'Cinderella is available before the trick', verifications: [
    { spec: 'The Princess card is an enabled button', check: async () => expect(princess).toBeEnabled() },
    { spec: 'No Princess power is active yet', check: async () => expect(page.getByText('Princess power: Cinderella')).toHaveCount(0) }
  ] });
  await expect(princess).toBeEnabled(); await princess.click();
  await expect(page.getByText('Princess power: Cinderella')).toBeVisible();
  await expect(game.jo.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/);
  await steps.step('cinderella-clicked', { description: 'Clicking Cinderella activates the reversed trick', verifications: [
    { spec: 'The active power is exposed as shared status text', check: async () => expect(page.getByText('Princess power: Cinderella')).toBeVisible() },
    { spec: 'Observer projection records Cinderella as exhausted', check: async () => expect(game.jo.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/) }
  ] });
  for (let card = 0; card < 3; card += 1) await playOneClick(game.players);
  await steps.step('cinderella-clicks-reversal', { description: 'The clicked card visibly activates and reverses a complete clicked trick', verifications: [
    { spec: 'All clients see Cinderella exhausted', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); await expect(game.sam.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/); } },
    { spec: 'The reversed trick is awarded', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
