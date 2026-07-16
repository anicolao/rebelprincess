import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';
import { closePrincessGame, playOneClick, setupPrincessGame } from '../helpers/princess-click-game';

const IDS = { phone: 'CIP00000', desktop: 'CIP00003' } as const;

test('The Ice Princess freezes a card entirely through clicks', async ({ page, browser }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo); steps.setMetadata('Ice Princess click activation', 'Click the Ice Princess, Jo, and one inspected card, then click the lead.');
  const game = await setupPrincessGame(browser, page, testInfo, IDS[testInfo.project.name as keyof typeof IDS], 'The Ice Princess', 'interactive');
  const princess = page.getByRole('button', { name: 'Use The Ice Princess power' });
  await expect(princess).toBeEnabled(); await princess.click();
  await steps.step('ice-princess-target-prompt', { description: 'Clicking the Ice Princess opens the player chooser', verifications: [
    { spec: 'The Princess button reports its pressed state', check: async () => expect(princess).toHaveAttribute('aria-pressed', 'true') },
    { spec: 'The chooser contains every player record', check: async () => expect(page.getByRole('group', { name: 'Ice Princess power' }).getByRole('button')).toHaveCount(3) }
  ] });
  await page.getByRole('group', { name: 'Ice Princess power' }).getByRole('button', { name: 'Jo' }).click();
  await steps.step('ice-princess-card-prompt', { description: 'Clicking Jo reveals two inspectable card choices', verifications: [
    { spec: 'Exactly two card buttons are exposed', check: async () => expect(page.getByRole('group', { name: 'Ice Princess cards' }).getByRole('button')).toHaveCount(2) },
    { spec: 'Other players wait for Alex to resolve the power', check: async () => expect(game.jo.getByRole('alert')).toContainText('Waiting for Alex') }
  ] });
  const frozen = page.getByRole('group', { name: 'Ice Princess cards' }).getByRole('button').first();
  const label = await frozen.textContent() ?? ''; await frozen.click();
  await steps.step('ice-princess-card-selected', { description: 'Clicking an inspected card stores the forced play', verifications: [
    { spec: 'The power chooser closes after the selection', check: async () => expect(page.getByRole('group', { name: 'Ice Princess cards' })).toHaveCount(0) },
    { spec: 'The Princess card is exhausted', check: async () => expect(page.locator('.local-princess')).toHaveClass(/exhausted/) }
  ] });
  await playOneClick(game.players);
  await steps.step('ice-princess-clicks-frozen-card', { description: 'Every stage is clicked and Jo receives one forced card', verifications: [
    { spec: 'Only the clicked inspected card is playable for Jo', check: async () => { await expect(game.jo.locator('.playing-card.playable:not(:disabled)')).toHaveCount(1); expect(await game.jo.locator('.playing-card.playable:not(:disabled)').getAttribute('aria-label')).toBe(label); } },
    { spec: 'The Ice Princess is exhausted', check: async () => expect(page.locator('.local-princess.exhausted')).toBeVisible() }
  ] });
  const forcedPlay = await playOneClick(game.players);
  await steps.step('ice-princess-forced-card-played', { description: `Jo clicks the only available card, ${forcedPlay}, and it appears in the trick`, verifications: [
    { spec: 'Jo plays the exact card Alex froze', check: async () => expect(forcedPlay).toBe(label) },
    { spec: 'Every player sees Jo’s frozen card in the center', check: async () => { for (const player of game.players) await expect(player.getByLabel(`Jo played ${label}`)).toBeVisible(); } }
  ] });
  steps.generateDocs(); await closePrincessGame(game);
});
