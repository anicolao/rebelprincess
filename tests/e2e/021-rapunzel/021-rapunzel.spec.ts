import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'RP700000', desktop: 'RD100000' } as const;

test('Rapunzel forces the leader to climb with a Prince entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Rapunzel click activation', 'Click Rapunzel before a trick, observe the leader’s hand become restricted to Princes, and click the forced Prince into the center.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'Rapunzel');
  const princess = page.getByRole('button', { name: 'Use Rapunzel power' });
  await steps.step('rapunzel-ready', { description: 'Rapunzel is upright and available before Alex leads', verifications: [
    { spec: 'Rapunzel’s card is enabled', check: async () => expect(princess).toBeEnabled() },
    { spec: 'The ordinary unopened-Prince lead contains no Princes', check: async () => expect((await page.locator('.playing-card.playable:not(:disabled)').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')))).every((label) => !label?.startsWith('Princes '))).toBe(true) }
  ] });
  await princess.click();
  await steps.step('rapunzel-forces-prince', { description: 'Clicking Rapunzel exhausts her and makes only Prince cards clickable', verifications: [
    { spec: 'Prince leads are enabled while non-Prince leads are disabled', check: async () => { await expect(page.getByRole('button', { name: /^Princes / }).first()).toBeEnabled(); await expect(page.getByRole('button', { name: /^Fairies / }).first()).toBeDisabled(); await expect(page.getByRole('button', { name: /^Pets / }).first()).toBeDisabled(); } },
    { spec: 'Every player sees Rapunzel’s active power and exhausted card', check: async () => { for (const player of game.players) await expect(player.getByText('Princess power: Rapunzel')).toBeVisible(); await expect(game.jo.getByLabel("Alex's Princess: Rapunzel")).toHaveClass(/exhausted/); } }
  ] });
  const lead = await playOneClick(game.players);
  await steps.step('rapunzel-prince-led', { description: `Alex clicks the forced ${lead}, which appears as the actual lead card`, verifications: [
    { spec: 'The clicked lead is a Prince', check: async () => expect(lead.startsWith('Princes ')).toBe(true) },
    { spec: 'Every player sees Alex’s forced Prince in the center', check: async () => { for (const player of game.players) await expect(player.getByLabel(`Alex played ${lead}`)).toBeVisible(); } }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
