import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from './helpers';

const IDS = { phone: 'CIP00000', desktop: 'CIP00003' } as const;

test('The Ice Princess freezes a card entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Ice Princess click activation', 'Click the Ice Princess, Jo, and one inspected card, then click the lead.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'The Ice Princess', 'interactive');
  const princess = page.getByRole('button', { name: 'Use The Ice Princess power' });
  await expect(princess).toBeEnabled(); await princess.click();
  await page.getByRole('group', { name: 'Ice Princess power' }).getByRole('button', { name: 'Jo' }).click();
  const frozen = page.getByRole('group', { name: 'Ice Princess cards' }).getByRole('button').first();
  const label = await frozen.textContent() ?? ''; await frozen.click();
  await playOneClick(game.players);
  await steps.step('ice-princess-clicks-frozen-card', { description: 'Every stage is clicked and Jo receives one forced card', verifications: [
    { spec: 'Only the clicked inspected card is playable for Jo', check: async () => { await expect(game.jo.locator('.playing-card.playable:not(:disabled)')).toHaveCount(1); expect(await game.jo.locator('.playing-card.playable:not(:disabled)').getAttribute('aria-label')).toBe(label); } },
    { spec: 'The Ice Princess is exhausted', check: async () => expect(page.locator('.local-princess.exhausted')).toBeVisible() }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
