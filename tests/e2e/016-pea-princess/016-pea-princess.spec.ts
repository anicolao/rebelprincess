import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CPE00001', desktop: 'CPE00002' } as const;

test('The Pea Princess restricts play entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Pea Princess click activation', 'Click the Pea Princess, then click through the constrained trick.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'The Pea Princess');
  const princess = page.getByRole('button', { name: 'Use The Pea Princess power' });
  await steps.step('pea-princess-ready', { description: 'The Pea Princess is ready before any card is played', verifications: [
    { spec: 'Her Princess card is enabled', check: async () => expect(princess).toBeEnabled() },
    { spec: 'The full legal lead set is initially visible', check: async () => expect(page.locator('.playing-card.playable:not(:disabled)').first()).toBeVisible() }
  ] });
  await expect(princess).toBeEnabled(); await princess.click();
  await expect(page.getByText('Princess power: The Pea Princess')).toBeVisible();
  const ranks = await page.locator('.playing-card.playable:not(:disabled) strong').allTextContents();
  expect(ranks.length).toBeGreaterThan(0); expect(ranks.every((rank) => Number(rank) > 5)).toBe(true);
  await steps.step('pea-princess-clicked', { description: 'Clicking her visibly restricts the legal card records', verifications: [
    { spec: 'The active power is visible', check: async () => expect(page.getByText('Princess power: The Pea Princess')).toBeVisible() },
    { spec: 'Every legal card rank is above five', check: async () => expect(ranks.every((rank) => Number(rank) > 5)).toBe(true) }
  ] });
  await playOneClick(game.players);
  await steps.step('pea-princess-clicks-restriction', { description: 'The clicked Princess constrains visible legal cards and a constrained card is clicked', verifications: [
    { spec: 'Every initially legal card is above five', check: async () => expect(ranks.every((rank) => Number(rank) > 5)).toBe(true) },
    { spec: 'Observers see the active exhausted Princess', check: async () => expect(game.jo.getByLabel("Alex's Princess: The Pea Princess")).toHaveClass(/exhausted/) }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
