import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from './helpers';

const IDS = { phone: 'CCI00009', desktop: 'CCI0000C' } as const;

test('Cinderella reverses a trick entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Cinderella click activation', 'Click Cinderella, then click every card in the reversed trick.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Cinderella');
  const princess = page.getByRole('button', { name: 'Use Cinderella power' });
  await expect(princess).toBeEnabled(); await princess.click();
  await expect(page.getByText('Princess power: Cinderella')).toBeVisible();
  await expect(game.jo.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/);
  for (let card = 0; card < 3; card += 1) await playOneClick(game.players);
  await steps.step('cinderella-clicks-reversal', { description: 'The clicked card visibly activates and reverses a complete clicked trick', verifications: [
    { spec: 'All clients see Cinderella exhausted', check: async () => { await expect(page.locator('.local-princess.exhausted')).toBeVisible(); await expect(game.sam.getByLabel("Alex's Princess: Cinderella")).toHaveClass(/exhausted/); } },
    { spec: 'The reversed trick is awarded', check: async () => expect(page.locator('.trick-counter summary').filter({ hasText: /^1$/ })).toHaveCount(1) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
